-- Reconstructed from the LocalCheckProd migration ledger on 2026-08-08.
-- This migration is already applied to production. Do not edit it.

create extension if not exists pgcrypto;

create table if not exists public.courts (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug = lower(slug)),
  name text not null check (char_length(name) between 2 and 120),
  short_name text not null check (char_length(short_name) between 2 and 32),
  raw_source_name text,
  address text not null,
  city text not null,
  state text not null check (char_length(state) = 2),
  postal_code text,
  market text not null,
  location text not null,
  latitude double precision not null check (latitude between -90 and 90),
  longitude double precision not null check (longitude between -180 and 180),
  sport_type text not null check (sport_type in ('basketball', 'pickleball')),
  access_type text not null check (access_type in ('public_free', 'public_paid', 'private_paid')),
  setting text not null check (setting in ('outdoor', 'indoor', 'mixed', 'outdoor_covered')),
  court_count integer check (court_count is null or court_count > 0),
  surface text,
  indoor boolean,
  has_lights boolean,
  image_url text,
  launch_reason text not null,
  launch_priority integer not null default 0 check (launch_priority between 0 and 100),
  verification_status text not null default 'source_verified'
    check (verification_status in ('source_verified', 'source_and_detection', 'needs_review')),
  source_url text not null check (source_url ~ '^https?://'),
  source_tier text not null check (source_tier in ('official', 'venue', 'community', 'editorial')),
  geocode_source text,
  geocode_query text,
  detection_source_id text,
  detection_distance_m double precision check (detection_distance_m is null or detection_distance_m >= 0),
  satellite_match_status text check (satellite_match_status in ('strong', 'nearby', 'review', 'none', 'not_applicable')),
  added_by uuid references auth.users(id) on delete set null,
  is_archived boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists courts_launch_index
  on public.courts (is_archived, launch_priority desc, name);
create index if not exists courts_sport_market_index
  on public.courts (sport_type, market, is_archived);
create index if not exists courts_coordinate_index
  on public.courts (latitude, longitude);

create or replace function public.set_courts_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_courts_updated_at on public.courts;
create trigger set_courts_updated_at
before update on public.courts
for each row execute function public.set_courts_updated_at();

alter table public.courts enable row level security;

drop policy if exists "Public can view launch courts" on public.courts;
create policy "Public can view launch courts"
on public.courts
for select
to anon, authenticated
using (not is_archived);

revoke all on table public.courts from anon, authenticated;
grant select on table public.courts to anon, authenticated;
grant all on table public.courts to service_role;

create or replace view public.courts_with_stats
with (security_invoker = true)
as
select
  c.*,
  0::bigint as active_check_in_count,
  0::bigint as total_check_ins,
  0::bigint as local_player_count,
  (c.verification_status in ('source_verified', 'source_and_detection')) as is_confirmed
from public.courts c
where not c.is_archived;

revoke all on table public.courts_with_stats from anon, authenticated;
grant select on table public.courts_with_stats to anon, authenticated;
grant select on table public.courts_with_stats to service_role;

comment on column public.courts.name is 'Canonical source-backed court or facility name.';
comment on column public.courts.short_name is 'Compact Explore label or well-known local alias.';
comment on column public.courts.raw_source_name is 'Original imported label retained for audit; never rendered as the public name.';
comment on view public.courts_with_stats is 'Public court catalog with zeroed social counters until authenticated check-in aggregation is migrated.';

