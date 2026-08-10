-- LocalCheck Apple MVP: directional user blocking, reporting, and server-side
-- visibility enforcement. Additive except for replacing existing SELECT
-- policies with equivalent policies that exclude blocked relationships.

create schema if not exists private;

create table if not exists public.user_blocks (
  id uuid primary key default gen_random_uuid(),
  blocker_id uuid not null references public.profiles(id) on delete cascade,
  blocked_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (blocker_id, blocked_id),
  check (blocker_id <> blocked_id)
);

alter table public.user_blocks enable row level security;
drop policy if exists user_blocks_select_own on public.user_blocks;
create policy user_blocks_select_own on public.user_blocks
  for select to authenticated
  using (blocker_id = (select auth.uid()));
revoke all on public.user_blocks from anon, authenticated;
grant select on public.user_blocks to authenticated;

create table if not exists public.user_reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid not null references public.profiles(id) on delete cascade,
  reported_id uuid not null references public.profiles(id) on delete cascade,
  reason text not null check (reason in ('spam', 'harassment', 'impersonation', 'unsafe_behavior', 'other')),
  details text check (details is null or char_length(details) <= 1000),
  status text not null default 'open' check (status in ('open', 'reviewing', 'resolved', 'dismissed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (reporter_id <> reported_id)
);

alter table public.user_reports enable row level security;
revoke all on public.user_reports from anon, authenticated;

create or replace function private.users_are_blocked(p_user_a uuid, p_user_b uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select p_user_a is not null and p_user_b is not null and exists (
    select 1
    from public.user_blocks b
    where (b.blocker_id = p_user_a and b.blocked_id = p_user_b)
       or (b.blocker_id = p_user_b and b.blocked_id = p_user_a)
  );
$$;
revoke execute on function private.users_are_blocked(uuid, uuid) from public, anon;
grant usage on schema private to authenticated;
grant execute on function private.users_are_blocked(uuid, uuid) to authenticated;

create or replace function public.block_user(p_blocked_id uuid)
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
  if p_blocked_id is null or p_blocked_id = v_user_id then
    raise exception 'invalid blocked user' using errcode = '22023';
  end if;
  if not exists (select 1 from public.profiles where id = p_blocked_id) then
    raise exception 'profile not found' using errcode = '23503';
  end if;

  insert into public.user_blocks (blocker_id, blocked_id)
  values (v_user_id, p_blocked_id)
  on conflict (blocker_id, blocked_id) do nothing;

  delete from public.friendships
  where (requester_id = v_user_id and addressee_id = p_blocked_id)
     or (requester_id = p_blocked_id and addressee_id = v_user_id);
  return true;
end;
$$;

create or replace function public.unblock_user(p_blocked_id uuid)
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
  delete from public.user_blocks
  where blocker_id = v_user_id and blocked_id = p_blocked_id;
  return found;
end;
$$;

-- Profile RLS intentionally hides blocked identities from ordinary reads. This
-- caller-scoped function returns only identities the current user blocked so
-- the app can present a reversible safety-management screen.
create or replace function public.list_blocked_users()
returns table (
  blocked_id uuid,
  display_name text,
  username text,
  avatar_url text,
  blocked_at timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    profile.id,
    profile.display_name,
    profile.username,
    profile.avatar_url,
    block.created_at
  from public.user_blocks block
  join public.profiles profile on profile.id = block.blocked_id
  where block.blocker_id = (select auth.uid())
  order by block.created_at desc, profile.id;
$$;

create or replace function public.report_user(
  p_reported_id uuid,
  p_reason text,
  p_details text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_report_id uuid;
begin
  if v_user_id is null then
    raise exception 'not authenticated' using errcode = '42501';
  end if;
  if p_reported_id is null or p_reported_id = v_user_id then
    raise exception 'invalid reported user' using errcode = '22023';
  end if;
  if p_reason not in ('spam', 'harassment', 'impersonation', 'unsafe_behavior', 'other') then
    raise exception 'invalid report reason' using errcode = '22023';
  end if;
  insert into public.user_reports (reporter_id, reported_id, reason, details)
  values (v_user_id, p_reported_id, p_reason, nullif(btrim(p_details), ''))
  returning id into v_report_id;
  return v_report_id;
end;
$$;

revoke execute on function public.block_user(uuid) from public, anon;
revoke execute on function public.unblock_user(uuid) from public, anon;
revoke execute on function public.list_blocked_users() from public, anon;
revoke execute on function public.report_user(uuid, text, text) from public, anon;
grant execute on function public.block_user(uuid) to authenticated;
grant execute on function public.unblock_user(uuid) to authenticated;
grant execute on function public.list_blocked_users() to authenticated;
grant execute on function public.report_user(uuid, text, text) to authenticated;

-- Blocked users do not appear in profile search/embedded profile results.
drop policy if exists profiles_select_authenticated on public.profiles;
create policy profiles_select_authenticated on public.profiles
  for select to authenticated
  using (
    id = (select auth.uid())
    or not private.users_are_blocked((select auth.uid()), id)
  );

-- Preserve each existing visibility contract and add the block boundary.
drop policy if exists check_ins_select_visible on public.check_ins;
create policy check_ins_select_visible on public.check_ins
  for select to authenticated
  using (
    user_id = (select auth.uid())
    or (
      not private.users_are_blocked((select auth.uid()), user_id)
      and (
        visibility = 'public'
        or (visibility = 'friends' and exists (
          select 1 from public.friendships f
          where f.status = 'accepted'
            and ((f.requester_id = (select auth.uid()) and f.addressee_id = check_ins.user_id)
              or (f.addressee_id = (select auth.uid()) and f.requester_id = check_ins.user_id))
        ))
      )
    )
  );

drop policy if exists activity_events_select_visible on public.activity_events;
create policy activity_events_select_visible on public.activity_events
  for select to authenticated
  using (
    actor_id = (select auth.uid())
    or (
      not private.users_are_blocked((select auth.uid()), actor_id)
      and (
        visibility = 'public'
        or (visibility = 'friends' and exists (
          select 1 from public.friendships f
          where f.status = 'accepted'
            and ((f.requester_id = (select auth.uid()) and f.addressee_id = activity_events.actor_id)
              or (f.addressee_id = (select auth.uid()) and f.requester_id = activity_events.actor_id))
        ))
      )
    )
  );

drop policy if exists planned_visits_select_visible on public.planned_visits;
create policy planned_visits_select_visible on public.planned_visits
  for select to authenticated
  using (
    user_id = (select auth.uid())
    or (
      not private.users_are_blocked((select auth.uid()), user_id)
      and (
        visibility = 'public'
        or (visibility = 'friends' and exists (
          select 1 from public.friendships f
          where f.status = 'accepted'
            and ((f.requester_id = (select auth.uid()) and f.addressee_id = planned_visits.user_id)
              or (f.addressee_id = (select auth.uid()) and f.requester_id = planned_visits.user_id))
        ))
      )
    )
  );

drop policy if exists runs_select_visible on public.runs;
create policy runs_select_visible on public.runs
  for select to authenticated
  using (
    organizer_id = (select auth.uid())
    or (is_open_invite and not private.users_are_blocked((select auth.uid()), organizer_id))
  );

-- Prevent the social write paths from crossing an existing block.
create or replace function private.prevent_blocked_run_interaction()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if private.users_are_blocked(new.inviter_id, new.invitee_id) then
    raise exception 'interaction is blocked' using errcode = '42501';
  end if;
  return new;
end;
$$;
revoke execute on function private.prevent_blocked_run_interaction() from public, anon, authenticated;
drop trigger if exists prevent_blocked_run_interaction on public.run_invitations;
create trigger prevent_blocked_run_interaction
before insert or update on public.run_invitations
for each row execute function private.prevent_blocked_run_interaction();

-- Protect every participant write, including SECURITY DEFINER RPCs such as
-- join_run that insert directly without creating an invitation first.
create or replace function private.prevent_blocked_run_participation()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_organizer_id uuid;
begin
  select r.organizer_id into v_organizer_id
  from public.runs r where r.id = new.run_id;
  if v_organizer_id is not null
     and private.users_are_blocked(v_organizer_id, new.user_id) then
    raise exception 'interaction is blocked' using errcode = '42501';
  end if;
  return new;
end;
$$;
revoke execute on function private.prevent_blocked_run_participation() from public, anon, authenticated;
drop trigger if exists prevent_blocked_run_participation on public.run_participants;
create trigger prevent_blocked_run_participation
before insert or update on public.run_participants
for each row execute function private.prevent_blocked_run_participation();

-- The client probes this function before rendering safety actions. On a backend
-- where this migration is not yet applied, the missing RPC keeps them hidden.
create or replace function public.safety_controls_available()
returns boolean
language sql
stable
security invoker
set search_path = ''
as $$ select true $$;
revoke execute on function public.safety_controls_available() from public, anon;
grant execute on function public.safety_controls_available() to authenticated;

create or replace function public.request_friend(p_addressee_id uuid)
returns public.friendships
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_row public.friendships;
begin
  if v_user_id is null then raise exception 'not authenticated' using errcode = '42501'; end if;
  if p_addressee_id is null or p_addressee_id = v_user_id then
    raise exception 'invalid addressee' using errcode = '22023';
  end if;
  if private.users_are_blocked(v_user_id, p_addressee_id) then
    raise exception 'interaction is blocked' using errcode = '42501';
  end if;
  if not exists (select 1 from public.profiles p where p.id = p_addressee_id) then
    raise exception 'profile not found' using errcode = '23503';
  end if;
  insert into public.friendships (requester_id, addressee_id, status)
  values (v_user_id, p_addressee_id, 'pending')
  on conflict (user_low, user_high) do nothing
  returning * into v_row;
  if v_row.id is null then
    select * into v_row from public.friendships f
    where f.user_low = least(v_user_id, p_addressee_id)
      and f.user_high = greatest(v_user_id, p_addressee_id)
    for update;
  end if;
  return v_row;
end;
$$;
revoke execute on function public.request_friend(uuid) from public, anon;
grant execute on function public.request_friend(uuid) to authenticated;
