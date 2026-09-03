begin;

create table if not exists private.court_verification_attempt_states (
  user_id uuid primary key references auth.users(id) on delete cascade,
  failed_attempts smallint not null default 0
    check (failed_attempts between 0 and 2),
  attempt_window_started_at timestamptz,
  cooldown_until timestamptz,
  reservation_id uuid,
  reservation_expires_at timestamptz,
  updated_at timestamptz not null default now(),
  check (
    (reservation_id is null and reservation_expires_at is null)
    or (reservation_id is not null and reservation_expires_at is not null)
  ),
  check (
    (failed_attempts = 0 and attempt_window_started_at is null)
    or (failed_attempts > 0 and attempt_window_started_at is not null)
  )
);

alter table private.court_verification_attempt_states enable row level security;

revoke all on table private.court_verification_attempt_states
  from public, anon, authenticated;
grant select, insert, update, delete on table private.court_verification_attempt_states
  to service_role;

create policy "No client access"
  on private.court_verification_attempt_states
  as restrictive
  for all
  to anon, authenticated
  using (false)
  with check (false);

comment on table private.court_verification_attempt_states is
  'Server-only state for two failed Add Court photo checks followed by a 24-hour cooldown.';
comment on column private.court_verification_attempt_states.reservation_id is
  'Single in-flight verification token; prevents concurrent requests from bypassing the attempt limit.';

create or replace function public.reserve_court_verification_attempt(
  p_user_id uuid
)
returns table (
  allowed boolean,
  reservation_id uuid,
  attempts_used integer,
  attempt_limit integer,
  cooldown_until timestamptz,
  reason text
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_state private.court_verification_attempt_states%rowtype;
  v_now timestamptz := now();
  v_reservation_id uuid;
begin
  if p_user_id is null then
    raise exception 'court submitter is required' using errcode = '22023';
  end if;

  insert into private.court_verification_attempt_states (user_id)
  values (p_user_id)
  on conflict (user_id) do nothing;

  select * into v_state
  from private.court_verification_attempt_states s
  where s.user_id = p_user_id
  for update;

  if v_state.cooldown_until is not null and v_state.cooldown_until <= v_now then
    update private.court_verification_attempt_states s
    set failed_attempts = 0,
        cooldown_until = null,
        attempt_window_started_at = null,
        reservation_id = null,
        reservation_expires_at = null,
        updated_at = v_now
    where s.user_id = p_user_id
    returning * into v_state;
  elsif v_state.cooldown_until is null
    and v_state.failed_attempts > 0
    and v_state.attempt_window_started_at <= v_now - interval '24 hours' then
    update private.court_verification_attempt_states s
    set failed_attempts = 0,
        attempt_window_started_at = null,
        reservation_id = null,
        reservation_expires_at = null,
        updated_at = v_now
    where s.user_id = p_user_id
    returning * into v_state;
  elsif v_state.reservation_expires_at is not null
    and v_state.reservation_expires_at <= v_now then
    update private.court_verification_attempt_states s
    set reservation_id = null,
        reservation_expires_at = null,
        updated_at = v_now
    where s.user_id = p_user_id
    returning * into v_state;
  end if;

  if v_state.cooldown_until is not null and v_state.cooldown_until > v_now then
    return query select false, null::uuid, v_state.failed_attempts::integer, 2,
      v_state.cooldown_until, 'cooldown'::text;
    return;
  end if;

  if v_state.reservation_id is not null then
    return query select false, null::uuid, v_state.failed_attempts::integer, 2,
      null::timestamptz, 'in_progress'::text;
    return;
  end if;

  v_reservation_id := gen_random_uuid();
  update private.court_verification_attempt_states s
  set reservation_id = v_reservation_id,
      reservation_expires_at = v_now + interval '5 minutes',
      updated_at = v_now
  where s.user_id = p_user_id;

  return query select true, v_reservation_id, v_state.failed_attempts::integer, 2,
    null::timestamptz, null::text;
end;
$$;

create or replace function public.cancel_court_verification_attempt(
  p_user_id uuid,
  p_reservation_id uuid
)
returns void
language sql
security definer
set search_path = ''
as $$
  update private.court_verification_attempt_states s
  set reservation_id = null,
      reservation_expires_at = null,
      updated_at = now()
  where s.user_id = p_user_id
    and s.reservation_id = p_reservation_id;
$$;

create or replace function public.reject_court_verification_attempt(
  p_user_id uuid,
  p_reservation_id uuid
)
returns table (
  attempts_used integer,
  attempt_limit integer,
  cooldown_until timestamptz
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_state private.court_verification_attempt_states%rowtype;
  v_attempts smallint;
  v_cooldown_until timestamptz;
begin
  select * into v_state
  from private.court_verification_attempt_states s
  where s.user_id = p_user_id
  for update;

  if not found or v_state.reservation_id is distinct from p_reservation_id then
    raise exception 'court verification reservation is invalid' using errcode = 'P0001';
  end if;

  v_attempts := least(2, v_state.failed_attempts + 1);
  v_cooldown_until := case
    when v_attempts >= 2 then now() + interval '24 hours'
    else null
  end;

  update private.court_verification_attempt_states s
  set failed_attempts = v_attempts,
      attempt_window_started_at = coalesce(v_state.attempt_window_started_at, now()),
      cooldown_until = v_cooldown_until,
      reservation_id = null,
      reservation_expires_at = null,
      updated_at = now()
  where s.user_id = p_user_id;

  return query select v_attempts::integer, 2, v_cooldown_until;
end;
$$;

create or replace function public.create_live_court_submission_v4(
  p_added_by uuid,
  p_reservation_id uuid,
  p_slug text,
  p_source_official_name text,
  p_source_short_name text,
  p_official_name text,
  p_short_name text,
  p_address text,
  p_city text,
  p_state text,
  p_latitude double precision,
  p_longitude double precision,
  p_sport_type text,
  p_setting text,
  p_source_url text,
  p_name_review_ok boolean,
  p_name_review_reason text
)
returns public.courts
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_state private.court_verification_attempt_states%rowtype;
  v_row public.courts;
begin
  select * into v_state
  from private.court_verification_attempt_states s
  where s.user_id = p_added_by
  for update;

  if not found or v_state.reservation_id is distinct from p_reservation_id then
    raise exception 'court verification reservation is invalid' using errcode = 'P0001';
  end if;

  select * into v_row
  from public.create_court_submission_v3(
    p_added_by,
    p_slug,
    p_source_official_name,
    p_source_short_name,
    p_official_name,
    p_short_name,
    p_address,
    p_city,
    p_state,
    p_latitude,
    p_longitude,
    p_sport_type,
    p_setting,
    p_source_url,
    p_name_review_ok,
    p_name_review_reason
  );

  update public.courts c
  set verification_status = 'source_and_detection',
      launch_reason = 'Community submission verified from a current live court photo.'
  where c.id = v_row.id
  returning * into v_row;

  update private.court_verification_attempt_states s
  set failed_attempts = 0,
      attempt_window_started_at = null,
      cooldown_until = null,
      reservation_id = null,
      reservation_expires_at = null,
      updated_at = now()
  where s.user_id = p_added_by;

  return v_row;
end;
$$;

revoke execute on function public.reserve_court_verification_attempt(uuid)
  from public, anon, authenticated;
revoke execute on function public.cancel_court_verification_attempt(uuid, uuid)
  from public, anon, authenticated;
revoke execute on function public.reject_court_verification_attempt(uuid, uuid)
  from public, anon, authenticated;
revoke execute on function public.create_live_court_submission_v4(
  uuid, uuid, text, text, text, text, text, text, text, text,
  double precision, double precision, text, text, text, boolean, text
) from public, anon, authenticated;

grant execute on function public.reserve_court_verification_attempt(uuid)
  to service_role;
grant execute on function public.cancel_court_verification_attempt(uuid, uuid)
  to service_role;
grant execute on function public.reject_court_verification_attempt(uuid, uuid)
  to service_role;
grant execute on function public.create_live_court_submission_v4(
  uuid, uuid, text, text, text, text, text, text, text, text,
  double precision, double precision, text, text, text, boolean, text
) to service_role;

notify pgrst, 'reload schema';

commit;
