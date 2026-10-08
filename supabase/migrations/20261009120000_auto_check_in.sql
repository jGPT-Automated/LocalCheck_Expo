-- Auto check-in at the player's local court (D35, D36; plan doc Spec 8).
--
-- The phone watches one circle around the player's local court. On arrival
-- the app calls auto_check_in_arrive; on leaving, auto_check_in_leave.
--
--   * Arrival is held 3 minutes in private.auto_check_in_arrivals. Leaving
--     inside those 3 minutes deletes it, so driving past never posts anything.
--   * Every minute private.promote_auto_check_ins turns held arrivals older
--     than 3 minutes into a real check-in (source 'auto', the player's own
--     privacy setting). The usual check-in triggers then run: feed, metrics,
--     Realtime.
--   * Leaving after that checks the player out.
--   * undo_auto_check_in removes the auto check-in and its feed rows, as if
--     it never happened.
--   * Auto check-ins end when the player leaves; the stale sweep closes them
--     after 3 hours as a backstop (manual check-ins keep 45 minutes).
--   * Changing local court drops a held arrival and closes an open auto
--     check-in at the old court (the old circle never reports "left").
--   * Friend alerts (D37): when an auto check-in goes live, friends get a
--     push only if the player has "Share my auto check-ins" on, the friend
--     has "Friends' auto check-ins" on, and the check-in isn't Private.
--     Either switch off and nothing is sent.
--   * When the 3-hour backstop ends an auto check-in, the player gets
--     "You've been checked out" with "Check back in" (D38);
--     resume_auto_check_in does that.

begin;

set local lock_timeout = '5s';
set local statement_timeout = '60s';

alter table public.check_ins
  add column if not exists source text not null default 'manual'
  check (source in ('manual', 'auto'));

comment on column public.check_ins.source is
  'manual = tapped Check in; auto = the local-court geofence (D35/D36). Auto check-ins last until the player leaves (3-hour backstop).';

create table if not exists private.auto_check_in_arrivals (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  court_id uuid not null references public.courts (id) on delete cascade,
  arrived_at timestamptz not null default now()
);

comment on table private.auto_check_in_arrivals is
  'Geofence arrivals held 3 minutes before they become a check-in (D36). One per player.';

-- Friend alerts for auto check-ins (D37). Both must be on for a push to go.
alter table public.profiles
  add column if not exists share_auto_check_ins boolean not null default false,
  add column if not exists notify_friend_check_ins boolean not null default true;

comment on column public.profiles.share_auto_check_ins is
  'Send: friends may get a push when this player is auto-checked in (never when Private). D37.';
comment on column public.profiles.notify_friend_check_ins is
  'Receive: get a push when a friend who shares is auto-checked in. D37.';

alter table public.notifications drop constraint if exists notifications_type_check;
alter table public.notifications add constraint notifications_type_check check (type in (
  'friend_request', 'friend_accepted', 'run_invite',
  'match_review', 'match_confirmed', 'match_rejected',
  'challenge', 'friend_check_in', 'auto_check_out'
));

create or replace function public.set_auto_check_in_alerts(
  p_share boolean default null,
  p_receive boolean default null
)
returns public.profiles
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_row public.profiles;
begin
  if (select auth.uid()) is null then
    raise exception 'not authenticated' using errcode = '42501';
  end if;
  update public.profiles
  set share_auto_check_ins = coalesce(p_share, share_auto_check_ins),
      notify_friend_check_ins = coalesce(p_receive, notify_friend_check_ins)
  where id = (select auth.uid())
  returning * into v_row;
  return v_row;
end
$$;

revoke execute on function public.set_auto_check_in_alerts(boolean, boolean) from public, anon;
grant execute on function public.set_auto_check_in_alerts(boolean, boolean) to authenticated;

-- ── Arrive ────────────────────────────────────────────────────────────────
-- Returns {"status": "pending" | "already" | "not_local", "arrived_at", "court_name"}.
-- The app schedules its "Checked in" notification for arrived_at + 3 minutes.
create or replace function public.auto_check_in_arrive(p_court_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_local uuid;
  v_arrived timestamptz;
  v_name text;
begin
  if v_user_id is null then
    raise exception 'not authenticated' using errcode = '42501';
  end if;

  select p.local_court_id into v_local
  from public.profiles p
  where p.id = v_user_id;

  -- Only the player's own local court, and only a court that still exists.
  select coalesce(nullif(btrim(c.short_name), ''), c.name) into v_name
  from public.courts c
  where c.id = p_court_id and not c.is_archived;
  if v_local is distinct from p_court_id or v_name is null then
    return jsonb_build_object('status', 'not_local');
  end if;

  if exists (
    select 1 from public.check_ins ci
    where ci.user_id = v_user_id
      and ci.court_id = p_court_id
      and ci.checked_out_at is null
  ) then
    delete from private.auto_check_in_arrivals where user_id = v_user_id;
    return jsonb_build_object('status', 'already');
  end if;

  -- iOS repeats "inside" on every app start; keep the first arrival time.
  insert into private.auto_check_in_arrivals (user_id, court_id, arrived_at)
  values (v_user_id, p_court_id, now())
  on conflict (user_id) do update
    set court_id = excluded.court_id,
        arrived_at = case
          when private.auto_check_in_arrivals.court_id = excluded.court_id
            then private.auto_check_in_arrivals.arrived_at
          else excluded.arrived_at
        end
  returning arrived_at into v_arrived;
  return jsonb_build_object('status', 'pending', 'arrived_at', v_arrived, 'court_name', v_name);
end
$$;

-- ── Leave ─────────────────────────────────────────────────────────────────
create or replace function public.auto_check_in_leave(p_court_id uuid)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
begin
  if v_user_id is null then
    raise exception 'not authenticated' using errcode = '42501';
  end if;

  delete from private.auto_check_in_arrivals
  where user_id = v_user_id and court_id = p_court_id;
  if found then
    return 'cancelled';
  end if;

  -- Only auto check-ins: a check-in the player tapped is theirs to end
  -- (or the 45-minute timer). iOS also reports "outside" whenever the app
  -- opens away from the court, which lands here and closes a stale auto
  -- check-in (for example after the phone died at the court).
  update public.check_ins
  set checked_out_at = now()
  where user_id = v_user_id
    and court_id = p_court_id
    and source = 'auto'
    and checked_out_at is null;
  if found then
    return 'checked_out';
  end if;

  return 'none';
end
$$;

-- ── Undo ──────────────────────────────────────────────────────────────────
-- Removes the player's latest auto check-in (from the last 3 hours) and its
-- feed rows. Also drops a held arrival.
create or replace function public.undo_auto_check_in()
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_id uuid;
  v_held boolean;
begin
  if v_user_id is null then
    raise exception 'not authenticated' using errcode = '42501';
  end if;

  delete from private.auto_check_in_arrivals where user_id = v_user_id;
  v_held := found;

  select ci.id into v_id
  from public.check_ins ci
  where ci.user_id = v_user_id
    and ci.source = 'auto'
    and ci.checked_in_at > now() - interval '3 hours'
  order by ci.checked_in_at desc
  limit 1
  for update;

  if v_id is null then
    return v_held;
  end if;

  delete from public.activity_events where check_in_id = v_id;
  delete from public.check_ins where id = v_id;
  return true;
end
$$;

revoke execute on function public.auto_check_in_arrive(uuid) from public, anon;
revoke execute on function public.auto_check_in_leave(uuid) from public, anon;
revoke execute on function public.undo_auto_check_in() from public, anon;
grant execute on function public.auto_check_in_arrive(uuid) to authenticated;
grant execute on function public.auto_check_in_leave(uuid) to authenticated;
grant execute on function public.undo_auto_check_in() to authenticated;

-- ── Promote held arrivals (cron, every minute) ────────────────────────────
create or replace function private.promote_auto_check_ins()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v record;
  v_count integer := 0;
  v_check_in uuid;
begin
  -- Arrivals that sat too long without an exit (phone off, app removed).
  delete from private.auto_check_in_arrivals
  where arrived_at < now() - interval '3 hours';

  for v in
    select a.user_id, a.court_id,
           coalesce(p.visibility, 'public') as visibility,
           p.share_auto_check_ins as share,
           coalesce(nullif(btrim(p.display_name), ''), p.username, 'A friend') as player_name,
           coalesce(nullif(btrim(c.short_name), ''), c.name) as court_name
    from private.auto_check_in_arrivals a
    join public.profiles p on p.id = a.user_id
    join public.courts c on c.id = a.court_id
    where a.arrived_at <= now() - interval '3 minutes'
    order by a.arrived_at
    for update of a skip locked
  loop
    delete from private.auto_check_in_arrivals where user_id = v.user_id;

    -- Same court, still checked in: nothing to do.
    if exists (
      select 1 from public.check_ins ci
      where ci.user_id = v.user_id and ci.court_id = v.court_id and ci.checked_out_at is null
    ) then
      continue;
    end if;

    -- Close any check-in elsewhere, exactly like check_in does.
    update public.check_ins
    set checked_out_at = now()
    where user_id = v.user_id and checked_out_at is null;

    insert into public.check_ins (user_id, court_id, visibility, source)
    values (v.user_id, v.court_id, v.visibility, 'auto')
    returning id into v_check_in;
    v_count := v_count + 1;

    -- Friend alerts (D37): sender shares, receiver wants them, not Private,
    -- not blocked, test accounts only reach insiders (D34), at most one per
    -- friend per 2 hours.
    if v.share and v.visibility <> 'private' then
      insert into public.notifications (user_id, type, actor_id, title, body, data, dedupe_key)
      select fr.friend_id, 'friend_check_in', v.user_id,
             left(v.player_name || ' is at ' || v.court_name, 80),
             'Checked in just now.',
             jsonb_build_object('path', '/court/' || v.court_id),
             'friend_check_in:' || v_check_in || ':' || fr.friend_id
      from (
        select case when f.requester_id = v.user_id then f.addressee_id else f.requester_id end as friend_id
        from public.friendships f
        where f.status = 'accepted'
          and (f.requester_id = v.user_id or f.addressee_id = v.user_id)
      ) fr
      join public.profiles fp on fp.id = fr.friend_id
      where fp.notify_friend_check_ins
        and not private.users_are_blocked(v.user_id, fr.friend_id)
        and (not private.is_hidden_account(v.user_id)
             or fp.account_tag in ('TEST', 'REVIEWER', 'FOUNDER'))
        and not exists (
          select 1 from public.notifications n
          where n.user_id = fr.friend_id
            and n.actor_id = v.user_id
            and n.type = 'friend_check_in'
            and n.created_at > now() - interval '2 hours'
        )
      on conflict (dedupe_key) do nothing;
    end if;
  end loop;

  return v_count;
end
$$;

revoke all on function private.promote_auto_check_ins() from public, anon, authenticated;

-- ── Stale sweep: auto 3 hours (then tell them, D38), manual 45 minutes ──
create or replace function private.auto_checkout_stale_check_ins()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_closed integer;
begin
  with closed as (
    update public.check_ins
    set checked_out_at = checked_in_at
      + case when source = 'auto' then interval '3 hours' else interval '45 minutes' end
    where checked_out_at is null
      and checked_in_at < now()
        - case when source = 'auto' then interval '3 hours' else interval '45 minutes' end
    returning id, user_id, court_id, source
  ), told as (
    insert into public.notifications (id, user_id, type, title, body, data, dedupe_key)
    select n.id, n.user_id, 'auto_check_out',
           'You''ve been checked out',
           left('Your auto check-in at ' || n.court_name || ' ended after 3 hours. Still playing?', 240),
           jsonb_build_object(
             'path', '/court/' || n.court_id,
             'kind', 'auto_check_out',
             'court_id', n.court_id,
             'notification_id', n.id,
             'category', 'auto-check-out'
           ),
           'auto_check_out:' || n.check_in_id
    from (
      select gen_random_uuid() as id, cl.id as check_in_id, cl.user_id, cl.court_id,
             coalesce(nullif(btrim(c.short_name), ''), c.name) as court_name
      from closed cl
      join public.courts c on c.id = cl.court_id
      where cl.source = 'auto'
    ) n
    on conflict (dedupe_key) do nothing
    returning 1
  )
  select count(*) into v_closed from closed;
  return v_closed;
end
$$;

-- ── "Check back in" from that notification (D38) ──────────────────────────
-- Starts an auto check-in right away (no hold: they said they're there).
-- Only at their local court; does nothing if they're already checked in there.
create or replace function public.resume_auto_check_in(p_court_id uuid)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_visibility text;
begin
  if v_user_id is null then
    raise exception 'not authenticated' using errcode = '42501';
  end if;

  select coalesce(p.visibility, 'public') into v_visibility
  from public.profiles p
  where p.id = v_user_id and p.local_court_id = p_court_id
  for update;
  if not found or not exists (
    select 1 from public.courts c where c.id = p_court_id and not c.is_archived
  ) then
    return 'not_local';
  end if;

  if exists (
    select 1 from public.check_ins ci
    where ci.user_id = v_user_id and ci.court_id = p_court_id and ci.checked_out_at is null
  ) then
    return 'already';
  end if;

  update public.check_ins
  set checked_out_at = now()
  where user_id = v_user_id and checked_out_at is null;

  insert into public.check_ins (user_id, court_id, visibility, source)
  values (v_user_id, p_court_id, v_visibility, 'auto');
  return 'checked_in';
end
$$;

revoke execute on function public.resume_auto_check_in(uuid) from public, anon;
grant execute on function public.resume_auto_check_in(uuid) to authenticated;

-- ── Local court changed: end what the old circle started ─────────────────
-- The phone moves the circle to the new court, so the old court never sends
-- a "left" event. Drop a held arrival and close an open auto check-in there.
create or replace function private.end_auto_check_in_on_court_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if old.local_court_id is distinct from new.local_court_id then
    delete from private.auto_check_in_arrivals where user_id = new.id;
    if old.local_court_id is not null then
      update public.check_ins
      set checked_out_at = now()
      where user_id = new.id
        and court_id = old.local_court_id
        and source = 'auto'
        and checked_out_at is null;
    end if;
  end if;
  return new;
end
$$;

drop trigger if exists end_auto_check_in_on_court_change on public.profiles;
create trigger end_auto_check_in_on_court_change
  after update of local_court_id on public.profiles
  for each row execute function private.end_auto_check_in_on_court_change();

-- ── Schedule ──────────────────────────────────────────────────────────────
do $cron$
begin
  if not exists (select 1 from cron.job where jobname = 'localcheck-promote-auto-check-ins') then
    perform cron.schedule(
      'localcheck-promote-auto-check-ins',
      '* * * * *',
      'select private.promote_auto_check_ins()'
    );
  end if;
end
$cron$;

commit;
