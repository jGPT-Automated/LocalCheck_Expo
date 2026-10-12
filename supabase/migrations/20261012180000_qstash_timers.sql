-- Timed work runs on QStash instead of repeating jobs (Oct 12, 2026).
--
-- Before: five pg_cron jobs woke up every 1, 5 or 15 minutes and looked for
-- work (3-minute auto check-in hold, check-in time limits, score auto-approve,
-- challenge reminder, challenge expiry).
--
-- Now: when something happens that needs a follow-up at a set time, a trigger
-- writes one row in private.timers and asks the `timers` Edge Function to book
-- a QStash message for that exact time. At that time QStash calls `timers`,
-- which checks the QStash signature and runs public.fire_timer. fire_timer
-- runs the same, already-proven function the old job ran; those functions only
-- act on rows that are actually due, so a late, early or repeated delivery is
-- harmless, and a cancelled challenge or an undone check-in simply has nothing
-- left to do.
--
--   kind                 booked when                         runs at
--   challenge_expiry     a challenge is pending with a time  its game time
--   challenge_reminder   a challenge is accepted 30+ min out  30 min before
--   auto_check_in_hold   a geofence arrival is held           arrival + 3 min
--   check_in_end         a check-in starts                    + 45 min (manual)
--                                                             + 3 h (auto)
--   match_due            a score goes to review / is held     its due time
--
-- Safety net: the 2-minute push job that already runs (it resends failed
-- pushes) also calls private.sweep_timers, which books any timer whose booking
-- didn't go out and runs any timer more than 3 minutes overdue. No new job.
--
-- Also in this script (decided Oct 12): challenges need a day and time, up to
-- 7 days ahead, future times only, and an unanswered challenge expires at its
-- game time. The two Oct 12 morning scripts that were run in the SQL editor
-- are recorded as applied.
--
-- Needs: Edge Function `timers` deployed, Edge secrets QSTASH_URL,
-- QSTASH_TOKEN, QSTASH_CURRENT_SIGNING_KEY, QSTASH_NEXT_SIGNING_KEY and
-- NOTIFICATION_WEBHOOK_SECRET; Vault secrets localcheck_supabase_url and
-- localcheck_notification_webhook_secret (both already used by push).

begin;

set local lock_timeout = '5s';
set local statement_timeout = '60s';

-- ── 1. The timers table ─────────────────────────────────────────────────────
create table if not exists private.timers (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in (
    'challenge_expiry', 'challenge_reminder', 'auto_check_in_hold',
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
  'One row per timed follow-up, delivered by QStash at run_at (see migration 20261012180000).';

create index if not exists timers_unfired_run_at_idx
  on private.timers (run_at) where fired_at is null;

revoke all on table private.timers from public, anon, authenticated;

-- ── 2. Book a timer: ask the `timers` Edge Function to publish to QStash ────
-- Same pattern and secrets as private.dispatch_push_webhook. pg_net sends the
-- request after this transaction commits, and never blocks or fails it.
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
  values (p_kind, p_ref_id, date_trunc('second', p_run_at))
  on conflict (kind, ref_id, run_at) do nothing
  returning id into v_id;
  if v_id is not null then
    perform private.book_timer(v_id);
  end if;
  return v_id;
end
$$;

revoke all on function private.schedule_timer(text, uuid, timestamptz) from public, anon, authenticated;

-- ── 3. Challenge rules (Oct 12) ─────────────────────────────────────────────
-- Expire: a pending challenge expires at its game time. Older challenges with
-- no time keep the old day rule.
create or replace function private.expire_stale_challenges()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_count integer;
begin
  update public.challenges c
  set status = 'expired', updated_at = now()
  where c.status = 'pending'
    and (
      (c.play_at is not null and c.play_at <= now())
      or (c.play_at is null and c.play_on is not null
        and c.play_on < (now() at time zone 'America/Chicago')::date)
      or (c.play_at is null and c.play_on is null
        and c.created_at < now() - interval '7 days')
    );
  get diagnostics v_count = row_count;
  return v_count;
end
$$;

-- Remind: both players, 30 minutes before, only for challenges accepted at
-- least 30 minutes before the game. The dedupe key keeps it to one each.
create or replace function private.remind_upcoming_challenges()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_row record;
  v_count integer := 0;
  v_place text;
begin
  for v_row in
    select c.id, c.challenger_id, c.opponent_id, c.court_id, c.play_at, c.ranked,
      coalesce(pa.username, 'Your opponent') as challenger_name,
      coalesce(pb.username, 'Your opponent') as opponent_name
    from public.challenges c
    left join public.profiles pa on pa.id = c.challenger_id
    left join public.profiles pb on pb.id = c.opponent_id
    where c.status = 'accepted'
      and c.play_at is not null
      and c.play_at > now()
      and c.play_at - interval '30 minutes' <= now() + interval '30 seconds'
      and c.responded_at <= c.play_at - interval '30 minutes'
  loop
    select ' at ' || coalesce(nullif(ct.short_name, ''), ct.name)
    into v_place
    from public.courts ct where ct.id = v_row.court_id;

    perform private.create_notification(
      v_row.challenger_id, 'challenge', v_row.opponent_id, null, null, null,
      case when v_row.ranked then 'RANKED GAME' else 'CASUAL GAME' end,
      left('With ' || v_row.opponent_name || coalesce(v_place, '') || ' in 30 minutes', 240),
      jsonb_build_object('path', '/challenge/' || v_row.id::text, 'challenge_id', v_row.id),
      'challenge-reminder:' || v_row.id::text || ':' || v_row.challenger_id::text
    );
    perform private.create_notification(
      v_row.opponent_id, 'challenge', v_row.challenger_id, null, null, null,
      case when v_row.ranked then 'RANKED GAME' else 'CASUAL GAME' end,
      left('With ' || v_row.challenger_name || coalesce(v_place, '') || ' in 30 minutes', 240),
      jsonb_build_object('path', '/challenge/' || v_row.id::text, 'challenge_id', v_row.id),
      'challenge-reminder:' || v_row.id::text || ':' || v_row.opponent_id::text
    );
    v_count := v_count + 1;
  end loop;
  return v_count;
end
$$;

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

-- ── 4. Run a timer (called by the `timers` Edge Function, or the sweep) ─────
-- Returns {"result": "ran" | "already" | "early" | "missing", "run_at": ...}.
-- "early" means QStash delivered before run_at (its free plan delays at most
-- 7 days); the Edge Function books it again.
create or replace function private.run_timer(p_timer_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_timer private.timers;
begin
  select * into v_timer from private.timers where id = p_timer_id for update;
  if not found then
    return jsonb_build_object('result', 'missing');
  end if;
  if v_timer.fired_at is not null then
    return jsonb_build_object('result', 'already', 'run_at', v_timer.run_at);
  end if;
  if v_timer.run_at > now() + interval '30 seconds' then
    return jsonb_build_object('result', 'early', 'run_at', v_timer.run_at);
  end if;

  case v_timer.kind
    when 'challenge_expiry' then perform private.expire_stale_challenges();
    when 'challenge_reminder' then perform private.remind_upcoming_challenges();
    when 'auto_check_in_hold' then perform private.promote_auto_check_ins();
    when 'check_in_end' then perform private.auto_checkout_stale_check_ins();
    when 'match_due' then perform private.auto_confirm_due_matches();
  end case;

  update private.timers
  set fired_at = now(), result = 'ran'
  where id = p_timer_id;
  return jsonb_build_object('result', 'ran', 'run_at', v_timer.run_at);
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

-- ── 5. Safety net, run by the existing 2-minute push job ────────────────────
create or replace function private.sweep_timers()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v record;
  v_count integer := 0;
begin
  -- A booking request that never reached QStash: try again (up to 5 times).
  for v in
    select t.id from private.timers t
    where t.fired_at is null
      and t.booked_at is null
      and t.booking_attempts < 5
      and t.created_at < now() - interval '2 minutes'
      and t.run_at > now() + interval '1 minute'
    limit 50
  loop
    perform private.book_timer(v.id);
  end loop;

  -- A timer QStash never delivered: run it here.
  for v in
    select t.id from private.timers t
    where t.fired_at is null
      and t.run_at < now() - interval '3 minutes'
    order by t.run_at
    limit 50
  loop
    perform private.run_timer(v.id);
    v_count := v_count + 1;
  end loop;
  return v_count;
end
$$;

revoke all on function private.sweep_timers() from public, anon, authenticated;

-- ── 6. Triggers that book timers ────────────────────────────────────────────
-- A booking problem must never block the change that caused it; the sweep
-- retries it.
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
        perform private.schedule_timer('challenge_expiry', new.id, new.play_at + interval '5 seconds');
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
          + case when new.source = 'auto' then interval '3 hours' else interval '45 minutes' end
          + interval '5 seconds'
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

create or replace function private.book_auto_check_in_hold_timer()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  begin
    perform private.schedule_timer(
      'auto_check_in_hold', new.user_id, new.arrived_at + interval '3 minutes 5 seconds'
    );
  exception when others then
    raise warning 'book_auto_check_in_hold_timer: %', sqlerrm;
  end;
  return new;
end
$$;

drop trigger if exists book_auto_check_in_hold_timer on private.auto_check_in_arrivals;
create trigger book_auto_check_in_hold_timer
  after insert or update of arrived_at, court_id on private.auto_check_in_arrivals
  for each row execute function private.book_auto_check_in_hold_timer();

create or replace function private.book_match_timer()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  begin
    if new.status = 'pending' and new.review_due_at is not null then
      perform private.schedule_timer('match_due', new.id, new.review_due_at + interval '5 seconds');
    elsif new.status = 'held' and new.resolution_due_at is not null then
      perform private.schedule_timer('match_due', new.id, new.resolution_due_at + interval '5 seconds');
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
revoke all on function private.book_auto_check_in_hold_timer() from public, anon, authenticated;
revoke all on function private.book_match_timer() from public, anon, authenticated;

-- ── 7. Jobs: the five that polled are removed; the push job also sweeps ─────
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
    'localcheck-notification-dispatch',
    '*/2 * * * *',
    'select private.dispatch_push_webhook(null), private.sweep_timers()'
  );
end
$cron$;

-- ── 8. Catch up, then book timers for everything already open ───────────────
select private.promote_auto_check_ins();
select private.auto_checkout_stale_check_ins();
select private.auto_confirm_due_matches();
select private.expire_stale_challenges();

select private.schedule_timer(
  'check_in_end', ci.id,
  ci.checked_in_at
    + case when ci.source = 'auto' then interval '3 hours' else interval '45 minutes' end
    + interval '5 seconds'
)
from public.check_ins ci
where ci.checked_out_at is null;

select private.schedule_timer('auto_check_in_hold', a.user_id, a.arrived_at + interval '3 minutes 5 seconds')
from private.auto_check_in_arrivals a;

select private.schedule_timer(
  'match_due', m.id,
  case when m.status = 'pending' then m.review_due_at else m.resolution_due_at end + interval '5 seconds'
)
from public.matches m
where (m.status = 'pending' and m.review_due_at is not null)
   or (m.status = 'held' and m.resolution_due_at is not null);

select private.schedule_timer('challenge_expiry', c.id, c.play_at + interval '5 seconds')
from public.challenges c
where c.status = 'pending' and c.play_at is not null;

select private.schedule_timer('challenge_reminder', c.id, c.play_at - interval '30 minutes')
from public.challenges c
where c.status = 'accepted'
  and c.play_at is not null
  and c.play_at - interval '30 minutes' > now();

-- ── 9. Record the migrations ────────────────────────────────────────────────
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
