-- Reconstructed from the LocalCheckProd migration ledger on 2026-08-08.
-- This migration is already applied to production. Do not edit it.

-- NOT YET APPLIED.
-- Intended target: LocalCheckProd (qkrnmyexzvaxiqfxwwfb).
-- Server-owned invariants, aggregate court metrics, activity projection, and
-- transactional RPCs. Internal SECURITY DEFINER trigger functions live in the
-- unexposed private schema; public RPCs use an empty search_path, validate
-- auth.uid(), revoke PUBLIC execution, and grant only authenticated.

begin;

set local lock_timeout = '5s';
set local statement_timeout = '90s';

create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

create or replace function private.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end
$$;

revoke execute on function private.set_updated_at() from public, anon, authenticated;

drop trigger if exists set_profiles_updated_at on public.profiles;
create trigger set_profiles_updated_at
before update on public.profiles
for each row execute function private.set_updated_at();

drop trigger if exists set_user_settings_updated_at on public.user_settings;
create trigger set_user_settings_updated_at
before update on public.user_settings
for each row execute function private.set_updated_at();

drop trigger if exists set_runs_updated_at on public.runs;
create trigger set_runs_updated_at
before update on public.runs
for each row execute function private.set_updated_at();

drop trigger if exists set_run_participants_updated_at on public.run_participants;
create trigger set_run_participants_updated_at
before update on public.run_participants
for each row execute function private.set_updated_at();

drop trigger if exists set_matches_updated_at on public.matches;
create trigger set_matches_updated_at
before update on public.matches
for each row execute function private.set_updated_at();

drop trigger if exists set_friendships_updated_at on public.friendships;
create trigger set_friendships_updated_at
before update on public.friendships
for each row execute function private.set_updated_at();

drop trigger if exists set_planned_visits_updated_at on public.planned_visits;
create trigger set_planned_visits_updated_at
before update on public.planned_visits
for each row execute function private.set_updated_at();

drop trigger if exists set_subscriptions_updated_at on public.subscriptions;
create trigger set_subscriptions_updated_at
before update on public.subscriptions
for each row execute function private.set_updated_at();

create or replace function private.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_base text;
  v_display_name text;
begin
  v_base := lower(regexp_replace(
    coalesce(
      nullif(new.raw_user_meta_data ->> 'preferred_username', ''),
      nullif(new.raw_user_meta_data ->> 'user_name', ''),
      nullif(new.raw_user_meta_data ->> 'display_name', ''),
      nullif(new.raw_user_meta_data ->> 'full_name', ''),
      nullif(split_part(coalesce(new.email, ''), '@', 1), ''),
      'player'
    ),
    '[^a-zA-Z0-9_]+', '', 'g'
  ));
  if v_base = '' then
    v_base := 'player';
  end if;

  v_display_name := left(coalesce(
    nullif(btrim(new.raw_user_meta_data ->> 'display_name'), ''),
    nullif(btrim(new.raw_user_meta_data ->> 'full_name'), ''),
    nullif(btrim(new.raw_user_meta_data ->> 'name'), ''),
    nullif(btrim(split_part(coalesce(new.email, ''), '@', 1)), ''),
    'Player'
  ), 80);

  insert into public.profiles (
    id, display_name, username
  ) values (
    new.id,
    v_display_name,
    left(v_base, 15) || '_' || substr(replace(new.id::text, '-', ''), 1, 16)
  )
  on conflict (id) do nothing;

  insert into public.user_settings (user_id, apple_private_email)
  values (
    new.id,
    coalesce(new.email, '') ilike '%privaterelay.appleid.com'
  )
  on conflict (user_id) do nothing;

  return new;
end
$$;

revoke execute on function private.handle_new_user() from public, anon, authenticated;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function private.handle_new_user();

create or replace function private.sync_profile_is_pro()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid;
begin
  if tg_op = 'DELETE' then
    v_user_id := old.user_id;
  else
    v_user_id := new.user_id;
  end if;

  update public.profiles p
  set is_pro = exists (
    select 1
    from public.subscriptions s
    where s.user_id = v_user_id
      and s.status in ('active', 'trialing')
      and (s.expires_at is null or s.expires_at > now())
  )
  where p.id = v_user_id;

  -- A service-side reassignment is unusual, but keep both profiles correct if
  -- it occurs. Clients never receive UPDATE on subscriptions.
  if tg_op = 'UPDATE' and old.user_id is distinct from new.user_id then
    update public.profiles p
    set is_pro = exists (
      select 1
      from public.subscriptions s
      where s.user_id = old.user_id
        and s.status in ('active', 'trialing')
        and (s.expires_at is null or s.expires_at > now())
    )
    where p.id = old.user_id;
  end if;

  if tg_op = 'DELETE' then return old; else return new; end if;
end
$$;

revoke execute on function private.sync_profile_is_pro() from public, anon, authenticated;

drop trigger if exists sync_profile_is_pro on public.subscriptions;
create trigger sync_profile_is_pro
after insert or update or delete on public.subscriptions
for each row execute function private.sync_profile_is_pro();

-- Incremental aggregate maintenance keeps public court reads O(1) without
-- granting anonymous access to check-in or profile rows.
create or replace function private.apply_check_in_metrics()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_old_minutes integer := 0;
  v_new_minutes integer := 0;
begin
  if tg_op in ('UPDATE', 'DELETE') then
    if old.checked_out_at is not null then
      v_old_minutes := greatest(
        0,
        floor(extract(epoch from (old.checked_out_at - old.checked_in_at)) / 60)::integer
      );
    end if;
  end if;
  if tg_op in ('INSERT', 'UPDATE') then
    if new.checked_out_at is not null then
      v_new_minutes := greatest(
        0,
        floor(extract(epoch from (new.checked_out_at - new.checked_in_at)) / 60)::integer
      );
    end if;
  end if;

  if tg_op = 'INSERT' then
    insert into public.court_metrics (
      court_id, active_check_in_count, total_check_ins, local_player_count
    ) values (
      new.court_id,
      case when new.checked_out_at is null then 1 else 0 end,
      1,
      0
    )
    on conflict (court_id) do update
      set active_check_in_count = public.court_metrics.active_check_in_count
            + case when new.checked_out_at is null then 1 else 0 end,
          total_check_ins = public.court_metrics.total_check_ins + 1,
          updated_at = now();
  elsif tg_op = 'UPDATE' then
    if old.court_id <> new.court_id then
      update public.court_metrics
      set active_check_in_count = greatest(
            0,
            active_check_in_count - case when old.checked_out_at is null then 1 else 0 end
          ),
          total_check_ins = greatest(0, total_check_ins - 1),
          updated_at = now()
      where court_id = old.court_id;

      insert into public.court_metrics (
        court_id, active_check_in_count, total_check_ins, local_player_count
      ) values (
        new.court_id,
        case when new.checked_out_at is null then 1 else 0 end,
        1,
        0
      )
      on conflict (court_id) do update
        set active_check_in_count = public.court_metrics.active_check_in_count
              + case when new.checked_out_at is null then 1 else 0 end,
            total_check_ins = public.court_metrics.total_check_ins + 1,
            updated_at = now();
    elsif old.checked_out_at is null and new.checked_out_at is not null then
      update public.court_metrics
      set active_check_in_count = greatest(0, active_check_in_count - 1),
          updated_at = now()
      where court_id = new.court_id;
    elsif old.checked_out_at is not null and new.checked_out_at is null then
      update public.court_metrics
      set active_check_in_count = active_check_in_count + 1,
          updated_at = now()
      where court_id = new.court_id;
    end if;
  elsif tg_op = 'DELETE' then
    update public.court_metrics
    set active_check_in_count = greatest(
          0,
          active_check_in_count - case when old.checked_out_at is null then 1 else 0 end
        ),
        total_check_ins = greatest(0, total_check_ins - 1),
        updated_at = now()
    where court_id = old.court_id;
  end if;

  -- Court time is a stored aggregate of completed check-in rows. Applying the
  -- old/new duration delta makes checkout retries and corrections exactly-once.
  if tg_op = 'INSERT' and v_new_minutes <> 0 then
    update public.profiles
    set total_court_time_minutes = total_court_time_minutes + v_new_minutes
    where id = new.user_id;
  elsif tg_op = 'UPDATE' and old.user_id = new.user_id
        and v_old_minutes <> v_new_minutes then
    update public.profiles
    set total_court_time_minutes = greatest(
      0, total_court_time_minutes + v_new_minutes - v_old_minutes
    )
    where id = new.user_id;
  elsif tg_op = 'UPDATE' and old.user_id <> new.user_id then
    update public.profiles
    set total_court_time_minutes = greatest(
      0, total_court_time_minutes - v_old_minutes
    )
    where id = old.user_id;
    update public.profiles
    set total_court_time_minutes = total_court_time_minutes + v_new_minutes
    where id = new.user_id;
  elsif tg_op = 'DELETE' and v_old_minutes <> 0 then
    update public.profiles
    set total_court_time_minutes = greatest(
      0, total_court_time_minutes - v_old_minutes
    )
    where id = old.user_id;
  end if;

  return coalesce(new, old);
end
$$;

revoke execute on function private.apply_check_in_metrics() from public, anon, authenticated;

drop trigger if exists apply_check_in_metrics on public.check_ins;
create trigger apply_check_in_metrics
after insert or update or delete on public.check_ins
for each row execute function private.apply_check_in_metrics();

create or replace function private.apply_profile_local_metrics()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'DELETE' and old.local_court_id is not null then
    update public.court_metrics
    set local_player_count = greatest(0, local_player_count - 1),
        updated_at = now()
    where court_id = old.local_court_id;
    return old;
  elsif tg_op = 'UPDATE'
        and old.local_court_id is distinct from new.local_court_id then
    if old.local_court_id is not null then
      update public.court_metrics
      set local_player_count = greatest(0, local_player_count - 1),
          updated_at = now()
      where court_id = old.local_court_id;
    end if;
    if new.local_court_id is not null then
      insert into public.court_metrics (
        court_id, active_check_in_count, total_check_ins, local_player_count
      ) values (new.local_court_id, 0, 0, 1)
      on conflict (court_id) do update
        set local_player_count = public.court_metrics.local_player_count + 1,
            updated_at = now();
    end if;
    return new;
  elsif tg_op = 'INSERT' and new.local_court_id is not null then
    insert into public.court_metrics (
      court_id, active_check_in_count, total_check_ins, local_player_count
    ) values (new.local_court_id, 0, 0, 1)
    on conflict (court_id) do update
      set local_player_count = public.court_metrics.local_player_count + 1,
          updated_at = now();
  end if;

  return new;
end
$$;

revoke execute on function private.apply_profile_local_metrics() from public, anon, authenticated;

drop trigger if exists apply_profile_local_metrics on public.profiles;
create trigger apply_profile_local_metrics
after insert or update of local_court_id or delete on public.profiles
for each row execute function private.apply_profile_local_metrics();

-- Reconciliation also initializes all 56 canonical courts. It is idempotent
-- and can be rerun after an approved fixture import.
insert into public.court_metrics (
  court_id, active_check_in_count, total_check_ins, local_player_count, updated_at
)
select
  c.id,
  count(distinct ci.id) filter (where ci.checked_out_at is null),
  count(distinct ci.id),
  count(distinct p.id),
  now()
from public.courts c
left join public.check_ins ci on ci.court_id = c.id
left join public.profiles p on p.local_court_id = c.id
group by c.id
on conflict (court_id) do update
set active_check_in_count = excluded.active_check_in_count,
    total_check_ins = excluded.total_check_ins,
    local_player_count = excluded.local_player_count,
    updated_at = excluded.updated_at;

-- The existing target view already has this exact shape. CREATE OR REPLACE
-- preserves dependent objects and fails closed if its columns ever drift.
create or replace view public.courts_with_stats
with (security_invoker = true)
as
select
  c.*,
  coalesce(cm.active_check_in_count, 0) as active_check_in_count,
  coalesce(cm.total_check_ins, 0) as total_check_ins,
  coalesce(cm.local_player_count, 0) as local_player_count,
  (c.verification_status in ('source_verified', 'source_and_detection')) as is_confirmed
from public.courts c
left join public.court_metrics cm on cm.court_id = c.id
where not c.is_archived;

revoke all on public.courts_with_stats from public, anon, authenticated;
grant select on public.courts_with_stats to anon, authenticated;

-- Activity projection. Fixture imports set localcheck.suppress_activity='on'
-- and backfill a curated event stream once core rows validate.
create or replace function private.project_check_in_activity()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if current_setting('localcheck.suppress_activity', true) = 'on' then
    return new;
  end if;

  if tg_op = 'INSERT' then
    insert into public.activity_events (
      event_type, actor_id, court_id, check_in_id, visibility, payload, occurred_at
    ) values (
      'check_in', new.user_id, new.court_id, new.id, new.visibility,
      jsonb_build_object('note', new.note), new.checked_in_at
    );
  elsif tg_op = 'UPDATE'
        and old.checked_out_at is null
        and new.checked_out_at is not null then
    insert into public.activity_events (
      event_type, actor_id, court_id, check_in_id, visibility, occurred_at
    ) values (
      'check_out', new.user_id, new.court_id, new.id, new.visibility,
      new.checked_out_at
    );
  end if;

  return new;
end
$$;

revoke execute on function private.project_check_in_activity() from public, anon, authenticated;

drop trigger if exists project_check_in_activity on public.check_ins;
create trigger project_check_in_activity
after insert or update of checked_out_at on public.check_ins
for each row execute function private.project_check_in_activity();

create or replace function private.project_run_activity()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if current_setting('localcheck.suppress_activity', true) = 'on' then
    return new;
  end if;

  insert into public.activity_events (
    event_type, actor_id, court_id, run_id, visibility, payload, occurred_at
  ) values (
    'run_created', new.organizer_id, new.court_id, new.id,
    case when new.is_open_invite then 'public' else 'private' end,
    jsonb_build_object('title', new.title, 'start_time', new.start_time),
    new.created_at
  );
  return new;
end
$$;

revoke execute on function private.project_run_activity() from public, anon, authenticated;

drop trigger if exists project_run_activity on public.runs;
create trigger project_run_activity
after insert on public.runs
for each row execute function private.project_run_activity();

create or replace function private.project_run_participant_activity()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_row public.run_participants;
  v_court_id uuid;
  v_open boolean;
begin
  if tg_op = 'DELETE' then
    v_row := old;
  else
    v_row := new;
  end if;

  if current_setting('localcheck.suppress_activity', true) = 'on' then
    return v_row;
  end if;

  select r.court_id, r.is_open_invite
  into v_court_id, v_open
  from public.runs r
  where r.id = v_row.run_id;

  if (tg_op = 'INSERT' and new.status = 'going')
     or (tg_op = 'UPDATE' and old.status <> 'going' and new.status = 'going') then
    insert into public.activity_events (
      event_type, actor_id, court_id, run_id, visibility, occurred_at
    ) values (
      'run_joined', new.user_id, v_court_id, new.run_id,
      case when v_open then 'public' else 'private' end,
      new.joined_at
    );
  elsif (tg_op = 'DELETE' and old.status = 'going')
        or (tg_op = 'UPDATE' and old.status = 'going' and new.status <> 'going') then
    insert into public.activity_events (
      event_type, actor_id, court_id, run_id, visibility, occurred_at
    ) values (
      'run_left', old.user_id, v_court_id, old.run_id,
      case when v_open then 'public' else 'private' end,
      now()
    );
  end if;

  return v_row;
end
$$;

revoke execute on function private.project_run_participant_activity() from public, anon, authenticated;

drop trigger if exists project_run_participant_activity on public.run_participants;
create trigger project_run_participant_activity
after insert or update of status or delete on public.run_participants
for each row execute function private.project_run_participant_activity();

create or replace function private.project_planned_visit_activity()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_row public.planned_visits;
begin
  if tg_op = 'DELETE' then v_row := old; else v_row := new; end if;

  if current_setting('localcheck.suppress_activity', true) = 'on' then
    return v_row;
  end if;

  if tg_op = 'DELETE' then
    delete from public.activity_events
    where planned_visit_id = old.id;
    return old;
  end if;

  insert into public.activity_events (
    event_type, actor_id, court_id, planned_visit_id, visibility, payload,
    occurred_at
  ) values (
    'planned_visit_created', new.user_id, new.court_id, new.id,
    new.visibility,
    jsonb_build_object('planned_at', new.planned_at, 'note', new.note), new.created_at
  )
  on conflict (planned_visit_id) do update
  set actor_id = excluded.actor_id,
      court_id = excluded.court_id,
      visibility = excluded.visibility,
      payload = excluded.payload;
  return new;
end
$$;

revoke execute on function private.project_planned_visit_activity() from public, anon, authenticated;

drop trigger if exists project_planned_visit_activity on public.planned_visits;
create trigger project_planned_visit_activity
after insert or update or delete on public.planned_visits
for each row execute function private.project_planned_visit_activity();

create or replace function public.check_in(
  p_court_id uuid,
  p_visibility text default 'public',
  p_note text default null
)
returns public.check_ins
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_row public.check_ins;
  v_note text := nullif(btrim(p_note), '');
begin
  if v_user_id is null then
    raise exception 'not authenticated' using errcode = '42501';
  end if;
  if p_visibility not in ('public', 'friends', 'private') then
    raise exception 'invalid visibility' using errcode = '22023';
  end if;
  if p_note is not null and char_length(p_note) > 280 then
    raise exception 'note exceeds 280 characters' using errcode = '22001';
  end if;
  if not exists (
    select 1 from public.courts c
    where c.id = p_court_id and not c.is_archived
  ) then
    raise exception 'court not found' using errcode = '23503';
  end if;

  -- One user-row lock plus the partial unique index serialize concurrent taps.
  perform 1 from public.profiles p where p.id = v_user_id for update;
  if not found then
    raise exception 'profile not found' using errcode = '23503';
  end if;

  select * into v_row
  from public.check_ins ci
  where ci.user_id = v_user_id and ci.checked_out_at is null
  for update;

  -- Retries and double taps at the same court are state-idempotent. They do not
  -- create another history row, feed item, or burst of Realtime messages.
  if found and v_row.court_id = p_court_id then
    if v_row.visibility is distinct from p_visibility
       or v_row.note is distinct from v_note then
      update public.check_ins
      set visibility = p_visibility,
          note = v_note
      where id = v_row.id
      returning * into v_row;

      -- Keep the projected feed row consistent with a privacy/note change on
      -- the still-active check-in.
      update public.activity_events
      set visibility = p_visibility,
          payload = jsonb_build_object('note', v_note)
      where check_in_id = v_row.id and event_type = 'check_in';
    end if;
    return v_row;
  end if;

  if found then
    update public.check_ins
    set checked_out_at = now()
    where id = v_row.id;
  end if;

  insert into public.check_ins (user_id, court_id, visibility, note)
  values (v_user_id, p_court_id, p_visibility, v_note)
  returning * into v_row;

  return v_row;
end
$$;

revoke execute on function public.check_in(uuid, text, text)
  from public, anon, authenticated;
grant execute on function public.check_in(uuid, text, text) to authenticated;

create or replace function public.check_out()
returns public.check_ins
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_row public.check_ins;
begin
  if v_user_id is null then
    raise exception 'not authenticated' using errcode = '42501';
  end if;

  select * into v_row
  from public.check_ins ci
  where ci.user_id = v_user_id and ci.checked_out_at is null
  order by ci.checked_in_at desc
  limit 1
  for update;

  if not found then
    return null;
  end if;

  update public.check_ins
  set checked_out_at = now()
  where id = v_row.id
  returning * into v_row;

  return v_row;
end
$$;

revoke execute on function public.check_out() from public, anon, authenticated;
grant execute on function public.check_out() to authenticated;

create or replace function public.create_run(
  p_court_id uuid,
  p_title text,
  p_start_time timestamptz,
  p_max_players integer,
  p_note text default null,
  p_is_open_invite boolean default true,
  p_client_request_id uuid default null
)
returns public.runs
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_run public.runs;
  v_note text := nullif(btrim(p_note), '');
  v_request_id uuid := coalesce(p_client_request_id, gen_random_uuid());
begin
  if v_user_id is null then
    raise exception 'not authenticated' using errcode = '42501';
  end if;
  if not exists (
    select 1 from public.courts c
    where c.id = p_court_id and not c.is_archived
  ) then
    raise exception 'court not found' using errcode = '23503';
  end if;
  if p_start_time <= now() then
    raise exception 'run must start in the future' using errcode = '22023';
  end if;

  insert into public.runs (
    court_id, organizer_id, client_request_id, title, note, start_time,
    max_players, is_open_invite
  ) values (
    p_court_id, v_user_id, v_request_id, btrim(p_title), v_note,
    p_start_time, p_max_players, p_is_open_invite
  )
  on conflict (organizer_id, client_request_id) do nothing
  returning * into v_run;

  if v_run.id is null then
    select * into v_run
    from public.runs r
    where r.organizer_id = v_user_id
      and r.client_request_id = v_request_id;

    if v_run.court_id is distinct from p_court_id
       or v_run.title is distinct from btrim(p_title)
       or v_run.note is distinct from v_note
       or v_run.start_time is distinct from p_start_time
       or v_run.max_players is distinct from p_max_players
       or v_run.is_open_invite is distinct from p_is_open_invite then
      raise exception 'client request id reused with different run data'
        using errcode = '23505';
    end if;
    return v_run;
  end if;

  insert into public.run_participants (run_id, user_id, status)
  values (v_run.id, v_user_id, 'going');

  return v_run;
end
$$;

revoke execute on function public.create_run(uuid, text, timestamptz, integer, text, boolean, uuid)
  from public, anon, authenticated;
grant execute on function public.create_run(uuid, text, timestamptz, integer, text, boolean, uuid)
  to authenticated;

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
  if v_user_id is null then
    raise exception 'not authenticated' using errcode = '42501';
  end if;

  select * into v_run
  from public.runs r
  where r.id = p_run_id
  for update;

  if not found then
    raise exception 'run not found' using errcode = 'P0002';
  end if;
  if v_run.status <> 'scheduled' or v_run.start_time <= now() then
    raise exception 'run is not joinable' using errcode = '22023';
  end if;
  if not v_run.is_open_invite and v_run.organizer_id <> v_user_id then
    raise exception 'run is invite-only' using errcode = '42501';
  end if;

  select count(*) into v_going_count
  from public.run_participants rp
  where rp.run_id = p_run_id and rp.status = 'going';

  if not exists (
    select 1 from public.run_participants rp
    where rp.run_id = p_run_id
      and rp.user_id = v_user_id
      and rp.status = 'going'
  ) and v_going_count >= v_run.max_players then
    raise exception 'run is full' using errcode = 'P0001';
  end if;

  insert into public.run_participants (run_id, user_id, status, joined_at)
  values (p_run_id, v_user_id, 'going', now())
  on conflict (run_id, user_id) do update
    set status = 'going', joined_at = now(), updated_at = now()
  returning * into v_row;

  return v_row;
end
$$;

revoke execute on function public.join_run(uuid) from public, anon, authenticated;
grant execute on function public.join_run(uuid) to authenticated;

create or replace function public.leave_run(p_run_id uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_organizer_id uuid;
begin
  if v_user_id is null then
    raise exception 'not authenticated' using errcode = '42501';
  end if;

  select r.organizer_id into v_organizer_id
  from public.runs r
  where r.id = p_run_id
  for update;

  if not found then
    return false;
  end if;
  if v_organizer_id = v_user_id then
    raise exception 'organizer must cancel the run' using errcode = '22023';
  end if;

  delete from public.run_participants
  where run_id = p_run_id and user_id = v_user_id;

  return found;
end
$$;

revoke execute on function public.leave_run(uuid) from public, anon, authenticated;
grant execute on function public.leave_run(uuid) to authenticated;

create or replace function public.cancel_run(p_run_id uuid)
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

  update public.runs
  set status = 'cancelled'
  where id = p_run_id
    and organizer_id = v_user_id
    and status = 'scheduled';

  return found;
end
$$;

revoke execute on function public.cancel_run(uuid) from public, anon, authenticated;
grant execute on function public.cancel_run(uuid) to authenticated;

create or replace function public.log_match(
  p_court_id uuid,
  p_opponent_id uuid,
  p_my_score integer,
  p_opponent_score integer,
  p_notes text default null,
  p_visibility text default 'public',
  p_client_request_id uuid default null
)
returns public.matches
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_match public.matches;
  v_winner_side text;
  v_notes text := nullif(btrim(p_notes), '');
  v_request_id uuid := coalesce(p_client_request_id, gen_random_uuid());
begin
  if v_user_id is null then
    raise exception 'not authenticated' using errcode = '42501';
  end if;
  if p_opponent_id is null or p_opponent_id = v_user_id then
    raise exception 'opponent must be another user' using errcode = '22023';
  end if;
  if p_my_score < 0 or p_opponent_score < 0 or p_my_score = p_opponent_score then
    raise exception 'scores must be non-negative and cannot tie' using errcode = '22023';
  end if;
  if p_visibility not in ('public', 'friends', 'private') then
    raise exception 'invalid visibility' using errcode = '22023';
  end if;
  if not exists (
    select 1 from public.courts c
    where c.id = p_court_id and not c.is_archived
  ) then
    raise exception 'court not found' using errcode = '23503';
  end if;
  if not exists (
    select 1 from public.profiles p where p.id = p_opponent_id
  ) then
    raise exception 'opponent profile not found' using errcode = '23503';
  end if;

  if p_my_score > p_opponent_score then
    v_winner_side := 'a';
  else
    v_winner_side := 'b';
  end if;

  insert into public.matches (
    court_id, created_by, opponent_id, client_request_id, score_a, score_b,
    winner_side, notes, visibility
  ) values (
    p_court_id, v_user_id, p_opponent_id, v_request_id, p_my_score,
    p_opponent_score, v_winner_side, v_notes, p_visibility
  )
  on conflict (created_by, client_request_id) do nothing
  returning * into v_match;

  if v_match.id is null then
    select * into v_match
    from public.matches m
    where m.created_by = v_user_id
      and m.client_request_id = v_request_id;

    if v_match.court_id is distinct from p_court_id
       or v_match.opponent_id is distinct from p_opponent_id
       or v_match.score_a is distinct from p_my_score
       or v_match.score_b is distinct from p_opponent_score
       or v_match.winner_side is distinct from v_winner_side
       or v_match.notes is distinct from v_notes
       or v_match.visibility is distinct from p_visibility then
      raise exception 'client request id reused with different match data'
        using errcode = '23505';
    end if;
    return v_match;
  end if;

  insert into public.match_participants (
    match_id, user_id, side, display_order
  ) values
    (v_match.id, v_user_id, 'a', 1),
    (v_match.id, p_opponent_id, 'b', 2);

  return v_match;
end
$$;

revoke execute on function public.log_match(uuid, uuid, integer, integer, text, text, uuid)
  from public, anon, authenticated;
grant execute on function public.log_match(uuid, uuid, integer, integer, text, text, uuid)
  to authenticated;

create or replace function public.confirm_match(p_match_id uuid)
returns public.matches
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_match public.matches;
  v_creator_elo integer;
  v_opponent_elo integer;
  v_creator_after integer;
  v_opponent_after integer;
  v_expected numeric;
  v_delta integer;
  v_winner_id uuid;
begin
  if v_user_id is null then
    raise exception 'not authenticated' using errcode = '42501';
  end if;

  select * into v_match
  from public.matches m
  where m.id = p_match_id
  for update;

  if not found then
    raise exception 'match not found' using errcode = 'P0002';
  end if;
  if v_match.opponent_id <> v_user_id then
    raise exception 'only the named opponent can confirm this match'
      using errcode = '42501';
  end if;
  if v_match.status = 'confirmed' then
    return v_match;
  end if;
  if v_match.status <> 'pending' then
    raise exception 'match is not pending' using errcode = '22023';
  end if;
  if (select count(*) from public.match_participants mp
      where mp.match_id = v_match.id) <> 2
     or not exists (
       select 1 from public.match_participants mp
       where mp.match_id = v_match.id
         and mp.user_id = v_match.created_by and mp.side = 'a'
     )
     or not exists (
       select 1 from public.match_participants mp
       where mp.match_id = v_match.id
         and mp.user_id = v_match.opponent_id and mp.side = 'b'
     ) then
    raise exception 'match participant invariant failed' using errcode = '23514';
  end if;

  -- Deterministic UUID lock ordering prevents reciprocal confirmations from
  -- deadlocking. Elo is calculated at confirmation, not proposal time.
  perform 1
  from public.profiles p
  where p.id in (v_match.created_by, v_match.opponent_id)
  order by p.id
  for update;

  select p.elo_rating into v_creator_elo
  from public.profiles p where p.id = v_match.created_by;
  select p.elo_rating into v_opponent_elo
  from public.profiles p where p.id = v_match.opponent_id;
  if v_creator_elo is null or v_opponent_elo is null then
    raise exception 'player profile not found' using errcode = '23503';
  end if;

  v_expected := 1.0 / (
    1.0 + power(10.0, (v_opponent_elo - v_creator_elo) / 400.0)
  );

  if v_match.winner_side = 'a' then
    v_winner_id := v_match.created_by;
    v_delta := greatest(1, round(32 * (1.0 - v_expected))::integer);
    v_creator_after := least(5000, v_creator_elo + v_delta);
    v_opponent_after := greatest(0, v_opponent_elo - v_delta);
  else
    v_winner_id := v_match.opponent_id;
    v_delta := greatest(1, round(32 * v_expected)::integer);
    v_creator_after := greatest(0, v_creator_elo - v_delta);
    v_opponent_after := least(5000, v_opponent_elo + v_delta);
  end if;

  update public.match_participants
  set elo_before = case
        when user_id = v_match.created_by then v_creator_elo
        else v_opponent_elo
      end,
      elo_after = case
        when user_id = v_match.created_by then v_creator_after
        else v_opponent_after
      end
  where match_id = v_match.id;

  update public.profiles
  set elo_rating = v_creator_after,
      wins = wins + case when v_winner_id = v_match.created_by then 1 else 0 end,
      losses = losses + case when v_winner_id <> v_match.created_by then 1 else 0 end
  where id = v_match.created_by;

  update public.profiles
  set elo_rating = v_opponent_after,
      wins = wins + case when v_winner_id = v_match.opponent_id then 1 else 0 end,
      losses = losses + case when v_winner_id <> v_match.opponent_id then 1 else 0 end
  where id = v_match.opponent_id;

  update public.matches
  set status = 'confirmed',
      confirmed_at = now()
  where id = v_match.id
  returning * into v_match;

  if coalesce(current_setting('localcheck.suppress_activity', true), '') <> 'on' then
    insert into public.activity_events (
      event_type, actor_id, court_id, match_id, visibility, payload, occurred_at
    ) values (
      'match_result', v_winner_id, v_match.court_id, v_match.id,
      v_match.visibility,
      jsonb_build_object(
        'score_a', v_match.score_a,
        'score_b', v_match.score_b,
        'winner_side', v_match.winner_side,
        'player_a_id', v_match.created_by,
        'player_b_id', v_match.opponent_id
      ),
      v_match.confirmed_at
    );
  end if;

  return v_match;
end
$$;

revoke execute on function public.confirm_match(uuid)
  from public, anon, authenticated;
grant execute on function public.confirm_match(uuid) to authenticated;

create or replace function public.reject_match(p_match_id uuid)
returns public.matches
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_match public.matches;
begin
  if v_user_id is null then
    raise exception 'not authenticated' using errcode = '42501';
  end if;

  update public.matches
  set status = 'rejected'
  where id = p_match_id
    and status = 'pending'
    and (created_by = v_user_id or opponent_id = v_user_id)
  returning * into v_match;

  if v_match.id is null then
    if exists (
      select 1 from public.matches m
      where m.id = p_match_id and m.status = 'rejected'
        and (m.created_by = v_user_id or m.opponent_id = v_user_id)
    ) then
      select * into v_match from public.matches m where m.id = p_match_id;
      return v_match;
    end if;
    raise exception 'pending match not found' using errcode = 'P0002';
  end if;

  return v_match;
end
$$;

revoke execute on function public.reject_match(uuid)
  from public, anon, authenticated;
grant execute on function public.reject_match(uuid) to authenticated;

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
  if v_user_id is null then
    raise exception 'not authenticated' using errcode = '42501';
  end if;
  if p_addressee_id is null or p_addressee_id = v_user_id then
    raise exception 'invalid addressee' using errcode = '22023';
  end if;
  if not exists (select 1 from public.profiles p where p.id = p_addressee_id) then
    raise exception 'profile not found' using errcode = '23503';
  end if;

  insert into public.friendships (requester_id, addressee_id, status)
  values (v_user_id, p_addressee_id, 'pending')
  on conflict (user_low, user_high) do nothing
  returning * into v_row;

  if v_row.id is null then
    select * into v_row
    from public.friendships f
    where f.user_low = least(v_user_id, p_addressee_id)
      and f.user_high = greatest(v_user_id, p_addressee_id)
    for update;

    if v_row.status = 'blocked' then
      raise exception 'friendship is blocked' using errcode = '42501';
    end if;
  end if;

  return v_row;
end
$$;

revoke execute on function public.request_friend(uuid) from public, anon, authenticated;
grant execute on function public.request_friend(uuid) to authenticated;

create or replace function public.accept_friend_request(p_requester_id uuid)
returns public.friendships
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_row public.friendships;
begin
  if v_user_id is null then
    raise exception 'not authenticated' using errcode = '42501';
  end if;

  update public.friendships
  set status = 'accepted'
  where requester_id = p_requester_id
    and addressee_id = v_user_id
    and status = 'pending'
  returning * into v_row;

  if v_row.id is null then
    raise exception 'pending request not found' using errcode = 'P0002';
  end if;
  return v_row;
end
$$;

revoke execute on function public.accept_friend_request(uuid)
  from public, anon, authenticated;
grant execute on function public.accept_friend_request(uuid) to authenticated;

create or replace function public.remove_friendship(p_other_user_id uuid)
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

  delete from public.friendships f
  where f.user_low = least(v_user_id, p_other_user_id)
    and f.user_high = greatest(v_user_id, p_other_user_id)
    and (f.requester_id = v_user_id or f.addressee_id = v_user_id);

  return found;
end
$$;

revoke execute on function public.remove_friendship(uuid)
  from public, anon, authenticated;
grant execute on function public.remove_friendship(uuid) to authenticated;

commit;

