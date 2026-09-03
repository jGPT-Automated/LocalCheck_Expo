begin;

create table if not exists private.court_submission_reviews (
  court_id uuid primary key references public.courts(id) on delete cascade,
  submitted_by uuid references auth.users(id) on delete set null,
  source_official_name text not null
    check (char_length(source_official_name) between 2 and 120),
  source_short_name text not null
    check (char_length(source_short_name) between 2 and 32),
  submitted_official_name text not null
    check (char_length(submitted_official_name) between 2 and 120),
  submitted_short_name text not null
    check (char_length(submitted_short_name) between 2 and 32),
  name_was_edited boolean not null,
  gemini_name_ok boolean,
  gemini_name_reason text
    check (gemini_name_reason is null or char_length(gemini_name_reason) <= 240),
  gemini_reviewed_at timestamptz,
  created_at timestamptz not null default now()
);

alter table private.court_submission_reviews enable row level security;

revoke all on table private.court_submission_reviews
  from public, anon, authenticated;
grant select, insert, update, delete on table private.court_submission_reviews
  to service_role;

comment on table private.court_submission_reviews is
  'Private evidence for manual review of community-submitted court names.';
comment on column private.court_submission_reviews.name_was_edited is
  'True when the submitter changed either reverse-geocoded name prefill.';
comment on column private.court_submission_reviews.gemini_name_ok is
  'Advisory content-safety result only; never an approval or source-of-truth decision.';

create or replace function public.create_court_submission_v3(
  p_added_by uuid,
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
  v_market text;
  v_duplicate_name text;
  v_quota_reached boolean;
  v_name_was_edited boolean;
  v_row public.courts;
begin
  if p_added_by is null then
    raise exception 'court submitter is required' using errcode = '22023';
  end if;
  if coalesce(char_length(btrim(p_source_official_name)), 0) not between 2 and 120
    or coalesce(char_length(btrim(p_official_name)), 0) not between 2 and 120
    or coalesce(char_length(btrim(p_source_short_name)), 0) not between 2 and 32
    or coalesce(char_length(btrim(p_short_name)), 0) not between 2 and 32 then
    raise exception 'court names are invalid' using errcode = '22023';
  end if;
  if coalesce(char_length(btrim(p_address)), 0) not between 2 and 250
    or coalesce(char_length(btrim(p_city)), 0) not between 2 and 80
    or coalesce(p_state, '') !~ '^[A-Z]{2}$' then
    raise exception 'court address is invalid' using errcode = '22023';
  end if;
  if p_latitude is null or p_latitude not between -90 and 90
    or p_longitude is null or p_longitude not between -180 and 180 then
    raise exception 'court location is invalid' using errcode = '22023';
  end if;
  if coalesce(p_sport_type, '') not in ('basketball', 'pickleball')
    or coalesce(p_setting, '') not in ('outdoor', 'indoor', 'mixed', 'outdoor_covered') then
    raise exception 'court classification is invalid' using errcode = '22023';
  end if;
  if coalesce(p_source_url, '') !~ '^https?://' then
    raise exception 'court source URL is invalid' using errcode = '22023';
  end if;
  if p_name_review_reason is not null
    and char_length(btrim(p_name_review_reason)) > 240 then
    raise exception 'court name review is invalid' using errcode = '22023';
  end if;

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
  v_market := coalesce(v_market, btrim(p_city));

  v_name_was_edited :=
    lower(regexp_replace(btrim(p_source_official_name), '\s+', ' ', 'g'))
      <> lower(regexp_replace(btrim(p_official_name), '\s+', ' ', 'g'))
    or lower(regexp_replace(btrim(p_source_short_name), '\s+', ' ', 'g'))
      <> lower(regexp_replace(btrim(p_short_name), '\s+', ' ', 'g'));

  insert into public.courts (
    slug, name, short_name, raw_source_name, address, city, state, market, location,
    latitude, longitude, sport_type, access_type, setting, launch_reason,
    verification_status, source_url, source_tier, image_url, added_by
  ) values (
    p_slug, btrim(p_official_name), btrim(p_short_name), btrim(p_source_official_name),
    btrim(p_address), btrim(p_city), p_state, v_market, btrim(p_city),
    p_latitude, p_longitude, p_sport_type, null, p_setting,
    'Community submission passed automated court-photo checks and awaits manual review.',
    'needs_review', p_source_url, 'community', null, p_added_by
  ) returning * into v_row;

  insert into private.court_submission_reviews (
    court_id, submitted_by, source_official_name, source_short_name,
    submitted_official_name, submitted_short_name, name_was_edited,
    gemini_name_ok, gemini_name_reason, gemini_reviewed_at
  ) values (
    v_row.id, p_added_by, btrim(p_source_official_name), btrim(p_source_short_name),
    btrim(p_official_name), btrim(p_short_name), v_name_was_edited,
    case when v_name_was_edited then p_name_review_ok else null end,
    case when v_name_was_edited then nullif(btrim(p_name_review_reason), '') else null end,
    case when v_name_was_edited and p_name_review_ok is not null then now() else null end
  );

  return v_row;
end;
$$;

revoke execute on function public.create_court_submission_v3(
  uuid, text, text, text, text, text, text, text, text,
  double precision, double precision, text, text, text, boolean, text
) from public, anon, authenticated;
grant execute on function public.create_court_submission_v3(
  uuid, text, text, text, text, text, text, text, text,
  double precision, double precision, text, text, text, boolean, text
) to service_role;

-- Keep the deployed Edge Function safe while its richer request contract rolls
-- out. This compatibility wrapper delegates to the single v3 implementation.
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
language sql
security definer
set search_path = ''
as $$
  select public.create_court_submission_v3(
    p_added_by,
    p_slug,
    p_name,
    left(p_name, 32),
    p_name,
    left(p_name, 32),
    p_address,
    p_city,
    p_state,
    p_latitude,
    p_longitude,
    p_sport_type,
    p_setting,
    p_source_url,
    null,
    null
  );
$$;

revoke execute on function public.create_verified_court_v2(
  uuid, text, text, text, text, text,
  double precision, double precision, text, text, text
) from public, anon, authenticated;
grant execute on function public.create_verified_court_v2(
  uuid, text, text, text, text, text,
  double precision, double precision, text, text, text
) to service_role;

drop policy if exists "Public can view launch courts" on public.courts;
drop policy if exists "Anyone can view reviewed courts" on public.courts;
drop policy if exists "Submitters can view pending courts" on public.courts;

create policy "Anyone can view reviewed courts"
on public.courts
for select
to anon, authenticated
using (not is_archived and verification_status <> 'needs_review');

create policy "Submitters can view pending courts"
on public.courts
for select
to authenticated
using (
  not is_archived
  and verification_status = 'needs_review'
  and added_by = (select auth.uid())
);

notify pgrst, 'reload schema';

commit;
