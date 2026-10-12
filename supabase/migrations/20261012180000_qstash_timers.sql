-- Timed work runs on QStash instead of repeating jobs (Oct 12, 2026; D50, D51).
--
-- Each timed follow-up is booked once, for its exact time, and acts on its
-- one thing only. When something happens, a trigger writes a row in
-- private.timers and asks the `timers` Edge Function to book a QStash message
-- for that time. At that time QStash calls `timers`, which checks QStash's
-- signature and runs public.fire_timer for that row. If the call fails,
-- QStash tries again (after about 12 seconds, 2.5 minutes and 30 minutes).
--
--   what                         booked when                    runs at
--   challenge_expiry   (challenge)  sent, with a game time        the game time
--   challenge_reminder (challenge)  accepted 30+ minutes ahead    30 min before
--   auto_check_in_post (player)     the phone reports arrival     arrival + 5 min
--   check_in_end       (check-in)   a check-in starts             + 45 min manual,
--                                                                 + 1.5 h auto
--   match_due          (game)       a score goes to review/held   its deadline
--
-- At run time each one checks its own thing first: a challenge that was
-- accepted, a check-in already ended, an arrival that was hidden or left, a
-- game already approved: nothing happens.
--
-- Auto check-in (Jesse, Oct 12): checked in privately on arrival; posted
-- 5 minutes later (friends' alerts, "Check-in posted"); ends when the phone
-- reports leaving, or 1.5 hours after arrival ("Auto checked out", with
-- I'm still here). The check-in time is the arrival time.
--
-- Challenges (Jesse, Oct 12): a day and time are required, up to 7 days
-- ahead; an unanswered challenge expires at its game time.
--
-- The 5 repeating jobs that polled for this work are removed. One small job
-- re-sends any booking QStash didn't confirm (pg_net sends once, no retry);
-- it never runs timers itself. The 2-minute push job is not touched.
--
-- Undo: supabase/rollbacks/20261012180000_qstash_timers.sql, using the copy
-- this script saves in private.migration_backups before changing anything.
--
-- Needs: Edge Function `timers` deployed; Edge secrets QSTASH_URL,
-- QSTASH_TOKEN, QSTASH_CURRENT_SIGNING_KEY, QSTASH_NEXT_SIGNING_KEY and
-- NOTIFICATION_WEBHOOK_SECRET; Vault secrets localcheck_supabase_url and
-- localcheck_notification_webhook_secret (both already used by push).

begin;

set local lock_timeout = '5s';
set local statement_timeout = '60s';

-- ── 1. Save what this script replaces, so it can be undone ──────────────────
create table if not exists private.migration_backups (
  migration text not null,
  kind text not null check (kind in ('function', 'cron_job', 'constraint')),
  name text not null,
  definition text not null,
  saved_at timestamptz not null default now(),
  primary key (migration, kind, name)
);
revoke all on table private.migration_backups from public, anon, authenticated;
alter table private.migration_backups enable row level security;

insert into private.migration_backups (migration, kind, name, definition)
select '20261012180000', 'function', p.oid::regprocedure::text, pg_get_functiondef(p.oid)
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where (n.nspname, p.proname) in (('public', 'create_challenge'), ('public', 'respond_to_challenge'))
on conflict do nothing;

insert into private.migration_backups (migration, kind, name, definition)
select '20261012180000', 'cron_job', j.jobname, j.schedule || E'\n' || j.command
from cron.job j
where j.jobname like 'localcheck-%'
on conflict do nothing;

insert into private.migration_backups (migration, kind, name, definition)
select '20261012180000', 'constraint', c.conname, pg_get_constraintdef(c.oid)
from pg_constraint c
where c.conrelid = 'public.notifications'::regclass and c.conname = 'notifications_type_check'
on conflict do nothing;

-- ── 2. The timers table ─────────────────────────────────────────────────────
create table if not exists private.timers (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in (
    'challenge_expiry', 'challenge_reminder', 'auto_check_in_post',
    'check_in_end', 'match_due'
  )),
  ref_id uuid not null,
  run_at timestamptz not null,
  created_at timestamptz not null default now(),
  booking_attempts integer not null default 0,
  booked_at timestamptz,
  qstash_message_id text,
  fired_at timestamptz,
  result text,
  unique (kind, ref_id, run_at)
);

comment on table private.timers is
  'One row per timed follow-up, delivered by QStash at run_at (migration 20261012180000).';

create index if not exists timers_unfired_run_at_idx
  on private.timers (run_at) where fired_at is null;

revoke all on table private.timers from public, anon, authenticated;
-- No policies: only the security-definer functions below (owned by postgres,
-- which bypasses RLS as the table owner) read or write it.
alter table private.timers enable row level security;

-- ── 3. Book a timer: ask the `timers` Edge Function to publish to QStash ────
-- Same pattern and secrets as private.dispatch_push_webhook. pg_net sends the
-- request after the transaction commits and never blocks or fails it.
create or replace function private.book_timer(p_timer_id uuid)
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_timer private.timers;
  v_supabase_url text;
  v_webhook_secret text;
  v_request_id bigint;
begin
  select * into v_timer from private.timers where id = p_timer_id;
  if not found or v_timer.fired_at is not null then
    return null;
  end if;

  select decrypted_secret into v_supabase_url
  from vault.decrypted_secrets
  where name = 'localcheck_supabase_url'
  order by created_at desc
  limit 1;

  select decrypted_secret into v_webhook_secret
  from vault.decrypted_secrets
  where name = 'localcheck_notification_webhook_secret'
  order by created_at desc
  limit 1;

  update private.timers
  set booking_attempts = booking_attempts + 1
  where id = p_timer_id;

  if nullif(btrim(v_supabase_url), '') is null
     or nullif(btrim(v_webhook_secret), '') is null then
    return null;
  end if;

  select net.http_post(
    url := rtrim(v_supabase_url, '/') || '/functions/v1/timers',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-localcheck-webhook-secret', v_webhook_secret
    ),
    body := jsonb_build_object(
      'action', 'book',
      'timer_id', v_timer.id,
      'run_at', v_timer.run_at
    ),
    timeout_milliseconds := 10000
  ) into v_request_id;

  return v_request_id;
end
$$;

revoke all on function private.book_timer(uuid) from public, anon, authenticated;

-- The exact time is kept (no rounding down), so a timer never runs before the
-- thing it checks is due.
create or replace function private.schedule_timer(p_kind text, p_ref_id uuid, p_run_at timestamptz)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
begin
  if p_ref_id is null or p_run_at is null then
    return null;
  end if;
  insert into private.timers (kind, ref_id, run_at)
  values (p_kind, p_ref_id, p_run_at)
  on conflict (kind, ref_id, run_at) do nothing
  returning id into v_id;
  if v_id is not null then
    perform private.book_timer(v_id);
  end if;
  return v_id;
end
$$;

revoke all on function private.schedule_timer(text, uuid, timestamptz) from public, anon, authenticated;

-- ── 4. Challenge rules (Oct 12) ─────────────────────────────────────────────
-- Create: a day and time are required, up to 7 days ahead, future only.
create or replace function public.create_challenge(
  p_opponent_id uuid,
  p_court_id uuid default null,
  p_play_on date default null,
  p_ranked boolean default true,
  p_play_at timestamptz default null
)
returns public.challenges
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_row public.challenges;
  v_name text;
begin
  if v_user_id is null then
    raise exception 'not authenticated' using errcode = '42501';
  end if;
  if p_opponent_id is null or p_opponent_id = v_user_id then
    raise exception 'You can''t challenge yourself.' using errcode = 'LC101';
  end if;
  if private.users_are_blocked(v_user_id, p_opponent_id) then
    raise exception 'interaction is blocked' using errcode = '42501';
  end if;
  if not exists (
    select 1 from public.friendships f
    where f.status = 'accepted'
      and ((f.requester_id = v_user_id and f.addressee_id = p_opponent_id)
        or (f.addressee_id = v_user_id and f.requester_id = p_opponent_id))
  ) then
    raise exception 'Challenges are between friends. Add them as a friend first.' using errcode = 'LC102';
  end if;
  if p_court_id is not null and not exists (
    select 1 from public.courts c where c.id = p_court_id and not c.is_archived
  ) then
    raise exception 'court not found' using errcode = 'P0002';
  end if;
  if p_play_at is null then
    raise exception 'Pick a day and time.' using errcode = 'LC103';
  end if;
  if p_play_at <= now() or p_play_at > now() + interval '7 days' then
    raise exception 'Pick a time in the next 7 days.' using errcode = 'LC103';
  end if;
  -- The client sends its own local day; Central is only a fallback.
  p_play_on := coalesce(p_play_on, (p_play_at at time zone 'America/Chicago')::date);
  if p_play_on < current_date - 1 or p_play_on > current_date + 8 then
    raise exception 'Pick a time in the next 7 days.' using errcode = 'LC103';
  end if;

  update public.challenges c
  set status = 'completed', updated_at = now()
  where least(c.challenger_id, c.opponent_id) = least(v_user_id, p_opponent_id)
    and greatest(c.challenger_id, c.opponent_id) = greatest(v_user_id, p_opponent_id)
    and c.status = 'accepted'
    and not c.ranked
    and c.play_on is not null
    and c.play_on < current_date;

  update public.challenges c
  set status = 'expired', updated_at = now()
  where least(c.challenger_id, c.opponent_id) = least(v_user_id, p_opponent_id)
    and greatest(c.challenger_id, c.opponent_id) = greatest(v_user_id, p_opponent_id)
    and c.status = 'pending'
    and ((c.play_at is not null and c.play_at <= now())
      or (c.play_at is null and c.play_on is not null
          and c.play_on < (now() at time zone 'America/Chicago')::date)
      or (c.play_at is null and c.play_on is null
          and c.created_at < now() - interval '7 days'));

  if exists (
    select 1 from public.challenges c
    where least(c.challenger_id, c.opponent_id) = least(v_user_id, p_opponent_id)
      and greatest(c.challenger_id, c.opponent_id) = greatest(v_user_id, p_opponent_id)
      and c.status in ('pending', 'accepted')
  ) then
    raise exception 'You already have an open challenge with this player.' using errcode = 'LC104';
  end if;
  if (
    select count(*) from public.challenges c
    where c.challenger_id = v_user_id and c.created_at > now() - interval '1 day'
  ) >= 10 then
    raise exception 'That''s 10 challenges today. Try again tomorrow.' using errcode = 'LC105';
  end if;

  insert into public.challenges (challenger_id, opponent_id, court_id, play_on, play_at, ranked)
  values (v_user_id, p_opponent_id, p_court_id, p_play_on, p_play_at, coalesce(p_ranked, true))
  returning * into v_row;

  select coalesce(display_name, username, 'A player') into v_name
  from public.profiles where id = v_user_id;

  perform private.create_notification(
    p_opponent_id, 'challenge', v_user_id, null, null, null,
    'NEW CHALLENGE',
    left(v_name || ' challenged you to a '
      || case when v_row.ranked then 'ranked' else 'casual' end || ' 1v1'
      || coalesce(private.challenge_place(v_row.court_id, v_row.play_on), '')
      || coalesce(' at ' || to_char(v_row.play_at at time zone 'America/Chicago', 'FMHH12:MI AM'), '')
      || '.', 240),
    jsonb_build_object('path', '/challenge/' || v_row.id::text, 'challenge_id', v_row.id),
    'challenge-new:' || v_row.id::text
  );
  return v_row;
end
$$;

revoke execute on function public.create_challenge(uuid, uuid, date, boolean, timestamptz) from public, anon;
grant execute on function public.create_challenge(uuid, uuid, date, boolean, timestamptz) to authenticated;

-- Respond: a challenge whose game time has passed can't be accepted.
create or replace function public.respond_to_challenge(p_challenge_id uuid, p_accept boolean)
returns public.challenges
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_row public.challenges;
  v_name text;
begin
  if v_user_id is null then
    raise exception 'not authenticated' using errcode = '42501';
  end if;
  select * into v_row from public.challenges where id = p_challenge_id for update;
  if not found or v_row.opponent_id <> v_user_id then
    raise exception 'challenge not found' using errcode = 'P0002';
  end if;
  if v_row.status = 'expired'
    or (v_row.status = 'pending'
      and ((v_row.play_at is not null and v_row.play_at <= now())
        or (v_row.play_at is null and v_row.play_on is not null
            and v_row.play_on < (now() at time zone 'America/Chicago')::date)
        or (v_row.play_at is null and v_row.play_on is null
            and v_row.created_at < now() - interval '7 days'))) then
    raise exception 'This challenge expired.' using errcode = 'LC112';
  end if;
  if v_row.status <> 'pending' then
    raise exception 'This challenge was already answered.' using errcode = 'LC106';
  end if;

  update public.challenges
  set status = case when p_accept then 'accepted' else 'declined' end,
      responded_at = now(), updated_at = now()
  where id = v_row.id
  returning * into v_row;

  select coalesce(display_name, username, 'Your opponent') into v_name
  from public.profiles where id = v_user_id;

  perform private.create_notification(
    v_row.challenger_id, 'challenge', v_user_id, null, null, null,
    case when p_accept then 'CHALLENGE ACCEPTED' else 'CHALLENGE DECLINED' end,
    case when p_accept
      then v_name || case when v_row.ranked
        then ' is in. Log the score here after you play.'
        else ' is in. See you there.' end
      else v_name || ' passed on your challenge.'
    end,
    jsonb_build_object('path', '/challenge/' || v_row.id::text, 'challenge_id', v_row.id),
    'challenge-response:' || v_row.id::text
  );
  return v_row;
end
$$;

revoke execute on function public.respond_to_challenge(uuid, boolean) from public, anon;
grant execute on function public.respond_to_challenge(uuid, boolean) to authenticated;

-- ── 5. One action per timer, each for one thing ─────────────────────────────
-- Each locks its row and checks it is still due before doing anything, and
-- returns what it did (kept in private.timers.result).

-- A challenge nobody answered expires at its game time.
create or replace function private.expire_challenge(p_challenge_id uuid)
returns text
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.challenges
  set status = 'expired', updated_at = now()
  where id = p_challenge_id
    and status = 'pending'
    and play_at is not null
    and play_at <= now();
  return case when found then 'expired' else 'nothing to do' end;
end
$$;

-- 30 minutes before an accepted challenge, both players get a reminder, but
-- only while the game hasn't started.
create or replace function private.remind_challenge(p_challenge_id uuid)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v record;
  v_place text;
begin
  select c.id, c.challenger_id, c.opponent_id, c.court_id, c.ranked,
    coalesce(pa.username, 'Your opponent') as challenger_name,
    coalesce(pb.username, 'Your opponent') as opponent_name
  into v
  from public.challenges c
  left join public.profiles pa on pa.id = c.challenger_id
  left join public.profiles pb on pb.id = c.opponent_id
  where c.id = p_challenge_id
    and c.status = 'accepted'
    and c.play_at is not null
    and c.play_at > now()
    and c.play_at - interval '30 minutes' <= now();
  if not found then
    return 'nothing to do';
  end if;

  select ' at ' || coalesce(nullif(ct.short_name, ''), ct.name)
  into v_place
  from public.courts ct where ct.id = v.court_id;

  perform private.create_notification(
    v.challenger_id, 'challenge', v.opponent_id, null, null, null,
    case when v.ranked then 'RANKED GAME' else 'CASUAL GAME' end,
    left('With ' || v.opponent_name || coalesce(v_place, '') || ' in 30 minutes', 240),
    jsonb_build_object('path', '/challenge/' || v.id::text, 'challenge_id', v.id),
    'challenge-reminder:' || v.id::text || ':' || v.challenger_id::text
  );
  perform private.create_notification(
    v.opponent_id, 'challenge', v.challenger_id, null, null, null,
    case when v.ranked then 'RANKED GAME' else 'CASUAL GAME' end,
    left('With ' || v.challenger_name || coalesce(v_place, '') || ' in 30 minutes', 240),
    jsonb_build_object('path', '/challenge/' || v.id::text, 'challenge_id', v.id),
    'challenge-reminder:' || v.id::text || ':' || v.opponent_id::text
  );
  return 'reminded both players';
end
$$;

-- 5 minutes after arriving (and not hidden or left), the auto check-in is
-- posted: it shows at the court and in the feed, friends with alerts on are
-- told, and the player gets "Check-in posted" (with Hide). The check-in time
-- is the arrival time.
create or replace function private.post_auto_check_in(p_user_id uuid)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v record;
  v_check_in uuid;
begin
  select a.user_id, a.court_id, a.arrived_at,
         coalesce(p.visibility, 'public') as visibility,
         p.share_auto_check_ins as shares_alerts,
         coalesce(nullif(btrim(p.display_name), ''), p.username, 'A friend') as player_name,
         coalesce(nullif(btrim(c.short_name), ''), c.name) as court_name
  into v
  from private.auto_check_in_arrivals a
  join public.profiles p on p.id = a.user_id
  join public.courts c on c.id = a.court_id
  where a.user_id = p_user_id
    and a.arrived_at <= now() - interval '5 minutes'
  for update of a;
  if not found then
    return 'nothing to do';
  end if;

  delete from private.auto_check_in_arrivals where user_id = p_user_id;

  -- Same court, still checked in: nothing to post.
  if exists (
    select 1 from public.check_ins ci
    where ci.user_id = p_user_id and ci.court_id = v.court_id and ci.checked_out_at is null
  ) then
    return 'already checked in';
  end if;

  -- Close any check-in elsewhere, exactly like check_in does.
  update public.check_ins
  set checked_out_at = now()
  where user_id = p_user_id and checked_out_at is null;

  insert into public.check_ins (user_id, court_id, visibility, source, checked_in_at)
  values (p_user_id, v.court_id, v.visibility, 'auto', v.arrived_at)
  returning id into v_check_in;

  -- Friend alerts (D37): sender shares, receiver wants them, not Private,
  -- not blocked, test accounts only reach insiders (D34), at most one per
  -- friend per 2 hours.
  if v.shares_alerts and v.visibility <> 'private' then
    insert into public.notifications (user_id, type, actor_id, title, body, data, dedupe_key)
    select fr.friend_id, 'friend_check_in', p_user_id,
           'A friend just checked in',
           left(v.player_name || ' is at ' || v.court_name, 240),
           jsonb_build_object('path', '/court/' || v.court_id),
           'friend_check_in:' || v_check_in || ':' || fr.friend_id
    from (
      select case when f.requester_id = p_user_id then f.addressee_id else f.requester_id end as friend_id
      from public.friendships f
      where f.status = 'accepted'
        and (f.requester_id = p_user_id or f.addressee_id = p_user_id)
    ) fr
    join public.profiles fp on fp.id = fr.friend_id
    where fp.notify_friend_check_ins
      and not private.users_are_blocked(p_user_id, fr.friend_id)
      and (not private.is_hidden_account(p_user_id)
           or fp.account_tag in ('TEST', 'REVIEWER', 'FOUNDER'))
      and not exists (
        select 1 from public.notifications n
        where n.user_id = fr.friend_id
          and n.actor_id = p_user_id
          and n.type = 'friend_check_in'
          and n.created_at > now() - interval '2 hours'
      )
    on conflict (dedupe_key) do nothing;
  end if;

  perform private.create_notification(
    p_user_id, 'auto_check_in', null, null, null, null,
    'Check-in posted',
    left('You''re at ' || v.court_name || '. Not playing? Tap Hide.', 240),
    jsonb_build_object(
      'path', '/court/' || v.court_id,
      'kind', 'auto_check_in',
      'court_id', v.court_id,
      'category', 'auto-check-in',
      -- Replaces the phone's own "Checked in at ..." notice (same id).
      'collapse_id', 'localcheck-auto-check-in'
    ),
    'auto_check_in_posted:' || v_check_in::text
  );
  return 'posted';
end
$$;

-- A check-in ends 45 minutes after a manual check-in, or 1.5 hours after an
-- auto check-in's arrival, unless it already ended. An auto check-in that ends
-- this way tells the player ("Auto checked out", with I'm still here).
create or replace function private.end_check_in(p_check_in_id uuid)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v public.check_ins;
  v_limit interval;
  v_court_name text;
begin
  select * into v from public.check_ins where id = p_check_in_id for update;
  if not found or v.checked_out_at is not null then
    return 'nothing to do';
  end if;
  v_limit := case when v.source = 'auto' then interval '90 minutes' else interval '45 minutes' end;
  if v.checked_in_at + v_limit > now() then
    return 'not due yet';
  end if;

  update public.check_ins
  set checked_out_at = v.checked_in_at + v_limit
  where id = p_check_in_id;

  if v.source = 'auto' then
    select coalesce(nullif(btrim(c.short_name), ''), c.name) into v_court_name
    from public.courts c where c.id = v.court_id;
    perform private.create_notification(
      v.user_id, 'auto_check_out', null, null, null, null,
      'Auto checked out',
      left('Still at ' || coalesce(v_court_name, 'the court') || '? Tap I''m still here.', 240),
      jsonb_build_object(
        'path', '/court/' || v.court_id,
        'kind', 'auto_check_out',
        'court_id', v.court_id,
        'category', 'auto-check-out'
      ),
      'auto_check_out:' || p_check_in_id::text
    );
  end if;
  return 'checked out';
end
$$;

-- A score waiting on review is approved at its 3-day deadline; a held game
-- is voided at its deadline. Same rules as the old job, for this game only.
create or replace function private.settle_due_match(p_match_id uuid)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v public.matches;
begin
  select * into v from public.matches where id = p_match_id for update;
  if not found then
    return 'nothing to do';
  end if;
  if v.status = 'held' and v.resolution_due_at <= now() then
    update public.matches set
      status = 'voided', resolution_due_at = null,
      reviewed_at = now(), updated_at = now()
    where id = v.id;
    return 'voided';
  end if;
  if v.status = 'pending' and v.review_due_at <= now() then
    if v.run_id is not null then
      perform private.apply_scheduled_match_elo(v.id, 'automatic');
    elsif v.team_size > 1 then
      perform private.apply_ad_hoc_team_elo(v.id, 'automatic');
    else
      perform private.apply_match_elo(v.id, 'automatic');
    end if;
    return 'approved';
  end if;
  return 'nothing to do';
end
$$;

revoke all on function private.expire_challenge(uuid) from public, anon, authenticated;
revoke all on function private.remind_challenge(uuid) from public, anon, authenticated;
revoke all on function private.post_auto_check_in(uuid) from public, anon, authenticated;
revoke all on function private.end_check_in(uuid) from public, anon, authenticated;
revoke all on function private.settle_due_match(uuid) from public, anon, authenticated;

-- "Check-in posted" is a new kind of notification.
alter table public.notifications drop constraint notifications_type_check;
alter table public.notifications add constraint notifications_type_check check (type = any (array[
  'friend_request', 'friend_accepted', 'run_invite', 'match_review', 'match_confirmed',
  'match_rejected', 'challenge', 'friend_check_in', 'auto_check_out', 'auto_check_in'
]));

-- Home shows "Checked in · posts at 4:05 · Hide" while an arrival waits to post.
create or replace function public.my_pending_auto_check_in()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'court_id', a.court_id,
    'arrived_at', a.arrived_at,
    'posts_at', a.arrived_at + interval '5 minutes'
  )
  from private.auto_check_in_arrivals a
  where a.user_id = (select auth.uid());
$$;

revoke all on function public.my_pending_auto_check_in() from public, anon;
grant execute on function public.my_pending_auto_check_in() to authenticated;

-- ── 6. Re-send bookings that weren't confirmed (the outbox sender) ──────────
-- pg_net sends each booking request once and never retries. A booking not
-- confirmed (booked_at) within a minute is sent again, up to 10 times. This
-- only books; QStash still runs every timer. On a normal day it finds nothing.
create or replace function private.rebook_unconfirmed_timers()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v record;
  v_count integer := 0;
begin
  for v in
    select t.id from private.timers t
    where t.fired_at is null
      and t.booked_at is null
      and t.created_at < now() - interval '1 minute'
      and t.booking_attempts < 10
    order by t.created_at
    limit 100
  loop
    begin
      perform private.book_timer(v.id);
      v_count := v_count + 1;
    exception when others then
      raise warning 'rebook_unconfirmed_timers: %: %', v.id, sqlerrm;
    end;
  end loop;
  return v_count;
end
$$;

revoke all on function private.rebook_unconfirmed_timers() from public, anon, authenticated;

-- ── 6b. Run a timer (called by the `timers` Edge Function) ──────────────────
-- Returns {"result": "ran" | "already" | "early" | "missing", "did": ..., "run_at": ...}.
-- "early" means QStash delivered before run_at (its free plan delays at most
-- 7 days); the Edge Function books it again. An error makes the Edge Function
-- answer 500, and QStash tries again.
create or replace function private.run_timer(p_timer_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_timer private.timers;
  v_did text;
begin
  select * into v_timer from private.timers where id = p_timer_id for update;
  if not found then
    return jsonb_build_object('result', 'missing');
  end if;
  if v_timer.fired_at is not null then
    return jsonb_build_object('result', 'already', 'run_at', v_timer.run_at);
  end if;
  if v_timer.run_at > now() then
    return jsonb_build_object('result', 'early', 'run_at', v_timer.run_at);
  end if;

  v_did := case v_timer.kind
    when 'challenge_expiry' then private.expire_challenge(v_timer.ref_id)
    when 'challenge_reminder' then private.remind_challenge(v_timer.ref_id)
    when 'auto_check_in_post' then private.post_auto_check_in(v_timer.ref_id)
    when 'check_in_end' then private.end_check_in(v_timer.ref_id)
    when 'match_due' then private.settle_due_match(v_timer.ref_id)
  end;

  update private.timers
  set fired_at = now(), result = v_did
  where id = p_timer_id;
  return jsonb_build_object('result', 'ran', 'did', v_did, 'run_at', v_timer.run_at);
end
$$;

revoke all on function private.run_timer(uuid) from public, anon, authenticated;

create or replace function public.fire_timer(p_timer_id uuid)
returns jsonb
language sql
security definer
set search_path = ''
as $$
  select private.run_timer(p_timer_id);
$$;

create or replace function public.timer_booked(p_timer_id uuid, p_message_id text)
returns void
language sql
security definer
set search_path = ''
as $$
  update private.timers
  set booked_at = now(), qstash_message_id = p_message_id
  where id = p_timer_id;
$$;

-- Only the Edge Function (service role) may call these.
revoke all on function public.fire_timer(uuid) from public, anon, authenticated;
revoke all on function public.timer_booked(uuid, text) from public, anon, authenticated;
grant execute on function public.fire_timer(uuid) to service_role;
grant execute on function public.timer_booked(uuid, text) to service_role;

-- ── 7. Triggers that book timers ────────────────────────────────────────────
-- A booking problem never blocks the change that caused it.
create or replace function private.book_challenge_timers()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  begin
    if new.play_at is not null then
      if new.status = 'pending' then
        perform private.schedule_timer('challenge_expiry', new.id, new.play_at);
      elsif new.status = 'accepted' and new.play_at - interval '30 minutes' > now() then
        perform private.schedule_timer('challenge_reminder', new.id, new.play_at - interval '30 minutes');
      end if;
    end if;
  exception when others then
    raise warning 'book_challenge_timers: %', sqlerrm;
  end;
  return new;
end
$$;

drop trigger if exists book_challenge_timers on public.challenges;
create trigger book_challenge_timers
  after insert or update of status, play_at on public.challenges
  for each row execute function private.book_challenge_timers();

create or replace function private.book_check_in_timer()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  begin
    if new.checked_out_at is null then
      perform private.schedule_timer(
        'check_in_end', new.id,
        new.checked_in_at
          + case when new.source = 'auto' then interval '90 minutes' else interval '45 minutes' end
      );
    end if;
  exception when others then
    raise warning 'book_check_in_timer: %', sqlerrm;
  end;
  return new;
end
$$;

drop trigger if exists book_check_in_timer on public.check_ins;
create trigger book_check_in_timer
  after insert on public.check_ins
  for each row execute function private.book_check_in_timer();

create or replace function private.book_auto_check_in_post_timer()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  begin
    perform private.schedule_timer('auto_check_in_post', new.user_id, new.arrived_at + interval '5 minutes');
  exception when others then
    raise warning 'book_auto_check_in_post_timer: %', sqlerrm;
  end;
  return new;
end
$$;

drop trigger if exists book_auto_check_in_post_timer on private.auto_check_in_arrivals;
create trigger book_auto_check_in_post_timer
  after insert or update of arrived_at, court_id on private.auto_check_in_arrivals
  for each row execute function private.book_auto_check_in_post_timer();

create or replace function private.book_match_timer()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  begin
    if new.status = 'pending' and new.review_due_at is not null then
      perform private.schedule_timer('match_due', new.id, new.review_due_at);
    elsif new.status = 'held' and new.resolution_due_at is not null then
      perform private.schedule_timer('match_due', new.id, new.resolution_due_at);
    end if;
  exception when others then
    raise warning 'book_match_timer: %', sqlerrm;
  end;
  return new;
end
$$;

drop trigger if exists book_match_timer on public.matches;
create trigger book_match_timer
  after insert or update of status, review_due_at, resolution_due_at on public.matches
  for each row execute function private.book_match_timer();

revoke all on function private.book_challenge_timers() from public, anon, authenticated;
revoke all on function private.book_check_in_timer() from public, anon, authenticated;
revoke all on function private.book_auto_check_in_post_timer() from public, anon, authenticated;
revoke all on function private.book_match_timer() from public, anon, authenticated;

-- ── 8. Remove the 5 repeating jobs; add the booking re-sender ───────────────
-- The 2-minute push job stays as it is.
do $cron$
declare
  v_name text;
begin
  foreach v_name in array array[
    'localcheck-promote-auto-check-ins',
    'localcheck-auto-checkout-stale-check-ins',
    'localcheck-auto-confirm-due-matches',
    'localcheck-challenge-reminders',
    'localcheck-expire-challenges'
  ] loop
    if exists (select 1 from cron.job where jobname = v_name) then
      perform cron.unschedule(v_name);
    end if;
  end loop;
  perform cron.schedule(
    'localcheck-timer-bookings',
    '* * * * *',
    'select private.rebook_unconfirmed_timers()'
  );
end
$cron$;

-- ── 9. Book timers for everything already open ──────────────────────────────
-- Anything already past its time is delivered right away.
select private.schedule_timer(
  'check_in_end', ci.id,
  ci.checked_in_at + case when ci.source = 'auto' then interval '90 minutes' else interval '45 minutes' end
)
from public.check_ins ci
where ci.checked_out_at is null;

select private.schedule_timer('auto_check_in_post', a.user_id, a.arrived_at + interval '5 minutes')
from private.auto_check_in_arrivals a;

select private.schedule_timer(
  'match_due', m.id,
  case when m.status = 'pending' then m.review_due_at else m.resolution_due_at end
)
from public.matches m
where (m.status = 'pending' and m.review_due_at is not null)
   or (m.status = 'held' and m.resolution_due_at is not null);

select private.schedule_timer('challenge_expiry', c.id, c.play_at)
from public.challenges c
where c.status = 'pending' and c.play_at is not null;

select private.schedule_timer('challenge_reminder', c.id, c.play_at - interval '30 minutes')
from public.challenges c
where c.status = 'accepted'
  and c.play_at is not null
  and c.play_at - interval '30 minutes' > now();

-- ── 10. Record the migrations ───────────────────────────────────────────────
insert into supabase_migrations.schema_migrations (version, name, statements)
values
  ('20261010120000', 'expire_stale_challenges',
    array['-- applied by Jesse in the SQL editor on 2026-10-12 (~12:05 pm Central), together with 20261012120000']),
  ('20261012120000', 'challenge_time_and_short_usernames',
    array['-- applied by Jesse in the SQL editor on 2026-10-12 (~12:05 pm Central)']),
  ('20261012180000', 'qstash_timers',
    array['-- applied by Jesse in the SQL editor on 2026-10-12; see supabase/migrations/20261012180000_qstash_timers.sql'])
on conflict (version) do nothing;

commit;
