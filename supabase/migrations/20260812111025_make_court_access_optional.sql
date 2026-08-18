-- Access classification is no longer collected for community-submitted courts.
-- Preserve all existing values and the original RPC for installed-client
-- compatibility; new submissions use the explicitly named v2 contract.

alter table public.courts
  alter column access_type drop not null;

create or replace function public.create_verified_court_v2(
  p_added_by uuid,
  p_slug text,
  p_name text,
  p_address text,
  p_city text,
  p_state text,
  p_latitude double precision,
  p_longitude double precision,
  p_sport_type text,
  p_setting text,
  p_source_url text
)
returns public.courts
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_market text;
  v_duplicate_name text;
  v_quota_reached boolean;
  v_row public.courts;
begin
  perform pg_advisory_xact_lock(20260803, 1);

  select count(*) >= 5 into v_quota_reached
  from public.courts c
  where c.added_by = p_added_by
    and c.created_at >= date_trunc('day', now() at time zone 'UTC') at time zone 'UTC';
  if v_quota_reached then
    raise exception 'court submission limit reached' using errcode = 'P0001';
  end if;

  select c.name into v_duplicate_name
  from public.courts c
  where not c.is_archived
    and c.sport_type = p_sport_type
    and 6371000 * 2 * asin(sqrt(
      power(sin(radians(c.latitude - p_latitude) / 2), 2) +
      cos(radians(p_latitude)) * cos(radians(c.latitude)) *
      power(sin(radians(c.longitude - p_longitude) / 2), 2)
    )) <= 150
  limit 1;
  if v_duplicate_name is not null then
    raise exception 'duplicate court: %', v_duplicate_name using errcode = '23505';
  end if;

  select c.market into v_market
  from public.courts c
  where not c.is_archived and nullif(btrim(c.market), '') is not null
    and 6371000 * 2 * asin(sqrt(
      power(sin(radians(c.latitude - p_latitude) / 2), 2) +
      cos(radians(p_latitude)) * cos(radians(c.latitude)) *
      power(sin(radians(c.longitude - p_longitude) / 2), 2)
    )) <= 80000
  order by power(c.latitude - p_latitude, 2) + power(c.longitude - p_longitude, 2)
  limit 1;
  v_market := coalesce(v_market, p_city);

  insert into public.courts (
    slug, name, short_name, address, city, state, market, location,
    latitude, longitude, sport_type, access_type, setting, launch_reason,
    verification_status, source_url, source_tier, image_url, added_by
  ) values (
    p_slug, p_name, left(p_name, 32), p_address, p_city, p_state, v_market, p_city,
    p_latitude, p_longitude, p_sport_type, null, p_setting,
    'Community submission verified from a current court photo.',
    'source_and_detection', p_source_url, 'community', null, p_added_by
  ) returning * into v_row;
  return v_row;
end;
$$;

revoke execute on function public.create_verified_court_v2(uuid, text, text, text, text, text, double precision, double precision, text, text, text)
  from public, anon, authenticated;
grant execute on function public.create_verified_court_v2(uuid, text, text, text, text, text, double precision, double precision, text, text, text)
  to service_role;
