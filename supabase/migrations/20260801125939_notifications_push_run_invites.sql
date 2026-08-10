-- Reconstructed from the LocalCheckProd migration ledger on 2026-08-08.
-- This migration is already applied to production. Do not edit it.

-- LocalCheck: durable notifications, push token registration, and direct run
-- invitations. Extracted from 20260729_mvp_notifications_and_sport_elo.sql,
-- which bundled this with a sport-specific Elo rewrite that mutates existing
-- player ratings. Everything in THIS file is purely additive (new tables,
-- new columns' worth of nothing on existing tables, new functions) and has
-- zero effect on any existing row. The Elo-split portion is deliberately
-- deferred to a separate, later migration/decision.
--
-- Intended target: LocalCheckProd (qkrnmyexzvaxiqfxwwfb).

begin;

set local lock_timeout = '5s';
set local statement_timeout = '90s';

-- Required by register_push_token / set_push_notifications_enabled below.
-- New column, defaults false for every existing row — no mutation of
-- existing data, unlike the Elo columns this migration deliberately omits.
alter table public.profiles
  add column if not exists push_notifications_enabled boolean not null default false;

-- -------------------------------------------------------------------------
-- Durable notification inbox and device tokens.
-- -------------------------------------------------------------------------

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  type text not null check (type in (
    'friend_request', 'friend_accepted', 'run_invite',
    'match_review', 'match_confirmed', 'match_rejected'
  )),
  actor_id uuid references public.profiles(id) on delete set null,
  friendship_id uuid references public.friendships(id) on delete cascade,
  run_id uuid references public.runs(id) on delete cascade,
  match_id uuid references public.matches(id) on delete cascade,
  title text not null check (char_length(title) between 1 and 80),
  body text not null check (char_length(body) between 1 and 240),
  data jsonb not null default '{}'::jsonb,
  read_at timestamptz,
  push_status text not null default 'pending'
    check (push_status in ('pending', 'processing', 'sent', 'failed', 'skipped')),
  push_attempts integer not null default 0 check (push_attempts >= 0),
  push_sent_at timestamptz,
  last_push_error text,
  dedupe_key text not null unique,
  created_at timestamptz not null default now()
);

create index if not exists notifications_user_created_idx
  on public.notifications (user_id, created_at desc);
create index if not exists notifications_user_unread_idx
  on public.notifications (user_id, created_at desc)
  where read_at is null;
create index if not exists notifications_push_pending_idx
  on public.notifications (created_at)
  where push_status = 'pending';

alter table public.notifications enable row level security;
drop policy if exists notifications_select_own on public.notifications;
create policy notifications_select_own on public.notifications
  for select to authenticated
  using (user_id = (select auth.uid()));

revoke all on public.notifications from anon, authenticated;
grant select on public.notifications to authenticated;

create table if not exists public.push_tokens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  expo_push_token text not null unique,
  platform text not null check (platform in ('ios', 'android')),
  device_id text,
  enabled boolean not null default true,
  last_seen_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (expo_push_token ~ '^(Expo|Exponent)PushToken\\[[A-Za-z0-9_-]+\\]$')
);

create index if not exists push_tokens_user_enabled_idx
  on public.push_tokens (user_id)
  where enabled;

alter table public.push_tokens enable row level security;
drop policy if exists push_tokens_select_own on public.push_tokens;
create policy push_tokens_select_own on public.push_tokens
  for select to authenticated
  using (user_id = (select auth.uid()));

revoke all on public.push_tokens from anon, authenticated;
grant select on public.push_tokens to authenticated;

create table if not exists public.run_invitations (
  id uuid primary key default gen_random_uuid(),
  run_id uuid not null references public.runs(id) on delete cascade,
  inviter_id uuid not null references public.profiles(id) on delete cascade,
  invitee_id uuid not null references public.profiles(id) on delete cascade,
  status text not null default 'pending'
    check (status in ('pending', 'accepted', 'declined')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (run_id, invitee_id),
  check (inviter_id <> invitee_id)
);

create index if not exists run_invitations_invitee_status_idx
  on public.run_invitations (invitee_id, status, created_at desc);

alter table public.run_invitations enable row level security;
drop policy if exists run_invitations_select_participant on public.run_invitations;
create policy run_invitations_select_participant on public.run_invitations
  for select to authenticated
  using (inviter_id = (select auth.uid()) or invitee_id = (select auth.uid()));

revoke all on public.run_invitations from anon, authenticated;
grant select on public.run_invitations to authenticated;

create or replace function public.mark_notification_read(p_notification_id uuid)
returns public.notifications
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_row public.notifications;
begin
  if (select auth.uid()) is null then
    raise exception 'not authenticated' using errcode = '42501';
  end if;
  update public.notifications
  set read_at = coalesce(read_at, now())
  where id = p_notification_id and user_id = (select auth.uid())
  returning * into v_row;
  if v_row.id is null then
    raise exception 'notification not found' using errcode = 'P0002';
  end if;
  return v_row;
end
$$;

create or replace function public.mark_all_notifications_read()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_count integer;
begin
  if (select auth.uid()) is null then
    raise exception 'not authenticated' using errcode = '42501';
  end if;
  update public.notifications set read_at = now()
  where user_id = (select auth.uid()) and read_at is null;
  get diagnostics v_count = row_count;
  return v_count;
end
$$;

create or replace function public.register_push_token(
  p_expo_push_token text,
  p_platform text,
  p_device_id text default null
)
returns public.push_tokens
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_row public.push_tokens;
begin
  if v_user_id is null then
    raise exception 'not authenticated' using errcode = '42501';
  end if;
  if p_platform not in ('ios', 'android') then
    raise exception 'invalid platform' using errcode = '22023';
  end if;
  insert into public.push_tokens (
    user_id, expo_push_token, platform, device_id, enabled, last_seen_at, updated_at
  ) values (
    v_user_id, p_expo_push_token, p_platform, nullif(btrim(p_device_id), ''), true, now(), now()
  )
  on conflict (expo_push_token) do update set
    user_id = excluded.user_id,
    platform = excluded.platform,
    device_id = excluded.device_id,
    enabled = true,
    last_seen_at = now(),
    updated_at = now()
  returning * into v_row;

  update public.profiles
  set push_notifications_enabled = true, updated_at = now()
  where id = v_user_id;
  return v_row;
end
$$;

create or replace function public.set_push_notifications_enabled(p_enabled boolean)
returns boolean
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
  update public.profiles
  set push_notifications_enabled = p_enabled, updated_at = now()
  where id = v_user_id;
  update public.push_tokens
  set enabled = p_enabled, updated_at = now()
  where user_id = v_user_id;
  return p_enabled;
end
$$;

create or replace function public.invite_to_run(p_run_id uuid, p_invitee_id uuid)
returns public.run_invitations
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_run public.runs;
  v_row public.run_invitations;
begin
  if v_user_id is null then
    raise exception 'not authenticated' using errcode = '42501';
  end if;
  select * into v_run from public.runs where id = p_run_id for update;
  if not found then raise exception 'run not found' using errcode = 'P0002'; end if;
  if v_run.organizer_id <> v_user_id then
    raise exception 'only the organizer can invite players' using errcode = '42501';
  end if;
  if v_run.status <> 'scheduled' or v_run.start_time <= now() then
    raise exception 'run is not inviteable' using errcode = '22023';
  end if;
  if not exists (
    select 1 from public.friendships f
    where f.status = 'accepted'
      and ((f.requester_id = v_user_id and f.addressee_id = p_invitee_id)
        or (f.addressee_id = v_user_id and f.requester_id = p_invitee_id))
  ) then
    raise exception 'only accepted friends can be invited' using errcode = '42501';
  end if;

  insert into public.run_invitations (run_id, inviter_id, invitee_id)
  values (p_run_id, v_user_id, p_invitee_id)
  on conflict (run_id, invitee_id) do update
    set status = case
          when public.run_invitations.status = 'accepted' then 'accepted'
          else 'pending'
        end,
        updated_at = now()
  returning * into v_row;
  return v_row;
end
$$;

create or replace function public.decline_run_invitation(p_run_id uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (select auth.uid()) is null then
    raise exception 'not authenticated' using errcode = '42501';
  end if;
  update public.run_invitations
  set status = 'declined', updated_at = now()
  where run_id = p_run_id and invitee_id = (select auth.uid()) and status = 'pending';
  return found;
end
$$;

revoke execute on function public.mark_notification_read(uuid) from public, anon;
revoke execute on function public.mark_all_notifications_read() from public, anon;
revoke execute on function public.register_push_token(text, text, text) from public, anon;
revoke execute on function public.set_push_notifications_enabled(boolean) from public, anon;
revoke execute on function public.invite_to_run(uuid, uuid) from public, anon;
revoke execute on function public.decline_run_invitation(uuid) from public, anon;
grant execute on function public.mark_notification_read(uuid) to authenticated;
grant execute on function public.mark_all_notifications_read() to authenticated;
grant execute on function public.register_push_token(text, text, text) to authenticated;
grant execute on function public.set_push_notifications_enabled(boolean) to authenticated;
grant execute on function public.invite_to_run(uuid, uuid) to authenticated;
grant execute on function public.decline_run_invitation(uuid) to authenticated;

-- -------------------------------------------------------------------------
-- One internal notification writer. Clients cannot insert notification rows.
-- -------------------------------------------------------------------------

create or replace function private.create_notification(
  p_user_id uuid,
  p_type text,
  p_actor_id uuid,
  p_friendship_id uuid,
  p_run_id uuid,
  p_match_id uuid,
  p_title text,
  p_body text,
  p_data jsonb,
  p_dedupe_key text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_user_id is null then return; end if;
  insert into public.notifications (
    user_id, type, actor_id, friendship_id, run_id, match_id,
    title, body, data, dedupe_key
  ) values (
    p_user_id, p_type, p_actor_id, p_friendship_id, p_run_id, p_match_id,
    p_title, p_body, coalesce(p_data, '{}'::jsonb), p_dedupe_key
  ) on conflict (dedupe_key) do nothing;
end
$$;

revoke execute on function private.create_notification(
  uuid, text, uuid, uuid, uuid, uuid, text, text, jsonb, text
) from public, anon, authenticated;

create or replace function private.notify_friendship_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_name text;
begin
  if tg_op = 'INSERT' and new.status = 'pending' then
    select coalesce(display_name, username, 'A player') into v_name
    from public.profiles where id = new.requester_id;
    perform private.create_notification(
      new.addressee_id, 'friend_request', new.requester_id, new.id, null, null,
      'FRIEND REQUEST', v_name || ' wants to connect.',
      jsonb_build_object('path', '/friends'), 'friend-request:' || new.id::text
    );
  elsif tg_op = 'UPDATE' and old.status = 'pending' and new.status = 'accepted' then
    select coalesce(display_name, username, 'A player') into v_name
    from public.profiles where id = new.addressee_id;
    perform private.create_notification(
      new.requester_id, 'friend_accepted', new.addressee_id, new.id, null, null,
      'FRIEND ADDED', v_name || ' accepted your request.',
      jsonb_build_object('path', '/friends'), 'friend-accepted:' || new.id::text
    );
  end if;
  return new;
end
$$;

create or replace function private.notify_match_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_name text;
  v_target uuid;
  v_actor uuid;
begin
  if tg_op = 'INSERT' and new.status = 'pending' then
    select coalesce(display_name, username, 'A player') into v_name
    from public.profiles where id = new.created_by;
    perform private.create_notification(
      new.opponent_id, 'match_review', new.created_by, null, null, new.id,
      'CONFIRM FINAL SCORE',
      v_name || ' logged ' || new.score_a::text || '–' || new.score_b::text || '.',
      jsonb_build_object('path', '/match/' || new.id::text),
      'match-review:' || new.id::text
    );
  elsif tg_op = 'UPDATE' and old.status = 'pending' and new.status = 'confirmed' then
    v_actor := new.opponent_id;
    perform private.create_notification(
      new.created_by, 'match_confirmed', v_actor, null, null, new.id,
      'SCORE CONFIRMED', 'Your opponent confirmed the final score.',
      jsonb_build_object('path', '/match/' || new.id::text),
      'match-confirmed:' || new.id::text
    );
  elsif tg_op = 'UPDATE' and old.status = 'pending' and new.status = 'rejected' then
    v_actor := (select auth.uid());
    v_target := case when v_actor = new.created_by then new.opponent_id else new.created_by end;
    perform private.create_notification(
      v_target, 'match_rejected', v_actor, null, null, new.id,
      'SCORE OBJECTED', 'The score was placed on hold and no rating changed.',
      jsonb_build_object('path', '/match/' || new.id::text),
      'match-rejected:' || new.id::text
    );
  end if;
  return new;
end
$$;

create or replace function private.notify_run_invitation()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_name text;
  v_title text;
begin
  if new.status = 'pending' and (tg_op = 'INSERT' or old.status is distinct from new.status) then
    select coalesce(display_name, username, 'A player') into v_name
    from public.profiles where id = new.inviter_id;
    select title into v_title from public.runs where id = new.run_id;
    perform private.create_notification(
      new.invitee_id, 'run_invite', new.inviter_id, null, new.run_id, null,
      'RUN INVITE', v_name || ' invited you to ' || coalesce(v_title, 'a run') || '.',
      jsonb_build_object('path', '/run/' || new.run_id::text),
      'run-invite:' || new.id::text
    );
  end if;
  return new;
end
$$;

revoke execute on function private.notify_friendship_change() from public, anon, authenticated;
revoke execute on function private.notify_match_change() from public, anon, authenticated;
revoke execute on function private.notify_run_invitation() from public, anon, authenticated;

drop trigger if exists notify_friendship_change on public.friendships;
create trigger notify_friendship_change
after insert or update of status on public.friendships
for each row execute function private.notify_friendship_change();

drop trigger if exists notify_match_change on public.matches;
create trigger notify_match_change
after insert or update of status on public.matches
for each row execute function private.notify_match_change();

drop trigger if exists notify_run_invitation on public.run_invitations;
create trigger notify_run_invitation
after insert or update of status on public.run_invitations
for each row execute function private.notify_run_invitation();

create or replace function private.broadcast_notification_invalidation()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform private.send_invalidation(
    'user:' || new.user_id::text, 'notifications', tg_op
  );
  return new;
end
$$;

revoke execute on function private.broadcast_notification_invalidation()
  from public, anon, authenticated;
drop trigger if exists broadcast_notification_invalidation on public.notifications;
create trigger broadcast_notification_invalidation
after insert or update of read_at on public.notifications
for each row execute function private.broadcast_notification_invalidation();

-- -------------------------------------------------------------------------
-- Run invitations: gate joining an invite-only run. Uses only columns that
-- already exist on public.runs (organizer_id, start_time, max_players,
-- is_open_invite, status) — verified live before writing this file.
-- -------------------------------------------------------------------------

create or replace function public.join_run(p_run_id uuid)
returns public.run_participants
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_run public.runs;
  v_going_count integer;
  v_row public.run_participants;
begin
  if v_user_id is null then raise exception 'not authenticated' using errcode = '42501'; end if;
  select * into v_run from public.runs where id = p_run_id for update;
  if not found then raise exception 'run not found' using errcode = 'P0002'; end if;
  if v_run.status <> 'scheduled' or v_run.start_time <= now() then
    raise exception 'run is not joinable' using errcode = '22023';
  end if;
  if not v_run.is_open_invite and v_run.organizer_id <> v_user_id
     and not exists (
       select 1 from public.run_invitations
       where run_id = p_run_id and invitee_id = v_user_id and status = 'pending'
     ) then
    raise exception 'run is invite-only' using errcode = '42501';
  end if;
  select count(*) into v_going_count from public.run_participants
  where run_id = p_run_id and status = 'going';
  if not exists (
    select 1 from public.run_participants
    where run_id = p_run_id and user_id = v_user_id and status = 'going'
  ) and v_going_count >= v_run.max_players then
    raise exception 'run is full' using errcode = 'P0001';
  end if;
  insert into public.run_participants (run_id, user_id, status, joined_at)
  values (p_run_id, v_user_id, 'going', now())
  on conflict (run_id, user_id) do update
    set status = 'going', joined_at = now(), updated_at = now()
  returning * into v_row;
  update public.run_invitations set status = 'accepted', updated_at = now()
  where run_id = p_run_id and invitee_id = v_user_id and status = 'pending';
  return v_row;
end
$$;

revoke execute on function public.join_run(uuid) from public, anon;
grant execute on function public.join_run(uuid) to authenticated;

-- Backfill actionable inbox entries without sending duplicate pushes.
-- Uses only pre-existing columns (status, opponent_id, created_by, score_a/b).
insert into public.notifications (
  user_id, type, actor_id, match_id, title, body, data, dedupe_key, push_status
)
select
  m.opponent_id, 'match_review', m.created_by, m.id, 'CONFIRM FINAL SCORE',
  coalesce(p.display_name, p.username, 'A player') || ' logged '
    || m.score_a::text || '–' || m.score_b::text || '.',
  jsonb_build_object('path', '/match/' || m.id::text),
  'match-review:' || m.id::text, 'skipped'
from public.matches m
join public.profiles p on p.id = m.created_by
where m.status = 'pending'
on conflict (dedupe_key) do nothing;

insert into public.notifications (
  user_id, type, actor_id, friendship_id, title, body, data, dedupe_key, push_status
)
select
  f.addressee_id, 'friend_request', f.requester_id, f.id, 'FRIEND REQUEST',
  coalesce(p.display_name, p.username, 'A player') || ' wants to connect.',
  jsonb_build_object('path', '/friends'),
  'friend-request:' || f.id::text, 'skipped'
from public.friendships f
join public.profiles p on p.id = f.requester_id
where f.status = 'pending'
on conflict (dedupe_key) do nothing;

commit;

