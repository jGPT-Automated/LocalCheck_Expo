-- Reconstructed from the LocalCheckProd migration ledger on 2026-08-08.
-- This migration is already applied to production. Do not edit it.

-- NOT YET APPLIED.
-- Intended target: LocalCheckProd (qkrnmyexzvaxiqfxwwfb), PostgreSQL 17.
--
-- Additive v2 schema. This migration deliberately does not INSERT, UPDATE,
-- DELETE, ALTER, or replace any row/column in public.courts. The destination
-- court UUIDs, slugs, names, and source metadata remain canonical.

begin;

set local lock_timeout = '5s';
set local statement_timeout = '60s';

do $$
begin
  if to_regclass('public.courts') is null then
    raise exception 'preflight failed: public.courts is missing';
  end if;
  if not exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'courts'
      and column_name = 'slug'
  ) then
    raise exception 'preflight failed: target is not the LocalCheckProd court contract';
  end if;
end
$$;

-- Close the target's legacy broad default ACL before creating any object. The
-- next migration adds only the explicit API grants needed by each table.
alter default privileges for role postgres in schema public
  revoke all on tables from public, anon, authenticated;
alter default privileges for role postgres in schema public
  revoke all on sequences from public, anon, authenticated;
alter default privileges for role postgres in schema public
  revoke execute on functions from public, anon, authenticated;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null
    check (char_length(btrim(display_name)) between 1 and 80),
  username text not null
    check (username ~ '^[A-Za-z0-9_]{3,32}$'),
  avatar_url text,
  elo_rating integer not null default 1200
    check (elo_rating between 0 and 5000),
  wins integer not null default 0 check (wins >= 0),
  losses integer not null default 0 check (losses >= 0),
  total_court_time_minutes integer not null default 0
    check (total_court_time_minutes >= 0),
  local_court_id uuid references public.courts(id) on delete set null,
  preferred_sport text
    check (preferred_sport is null or preferred_sport in (
      'basketball', 'pickleball', 'tennis', 'soccer', 'volleyball'
    )),
  is_pro boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists profiles_username_lower_key
  on public.profiles (lower(username));
create index if not exists profiles_local_court_idx
  on public.profiles (local_court_id)
  where local_court_id is not null;
create index if not exists profiles_elo_idx
  on public.profiles (elo_rating desc, id);

-- Non-social preferences are separate so profiles can be selected for rosters,
-- leaderboards, and embeds without leaking account settings.
create table if not exists public.user_settings (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  apple_private_email boolean not null default false,
  push_notifications_enabled boolean not null default true,
  check_in_reminders_enabled boolean not null default true,
  game_alerts_enabled boolean not null default true,
  haptics_enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.check_ins (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  court_id uuid not null references public.courts(id) on delete cascade,
  note text check (note is null or char_length(note) <= 280),
  visibility text not null default 'public'
    check (visibility in ('public', 'friends', 'private')),
  checked_in_at timestamptz not null default now(),
  checked_out_at timestamptz,
  created_at timestamptz not null default now(),
  constraint check_ins_time_order_check
    check (checked_out_at is null or checked_out_at >= checked_in_at)
);

create unique index if not exists check_ins_one_active_per_user_idx
  on public.check_ins (user_id)
  where checked_out_at is null;
create index if not exists check_ins_court_active_time_idx
  on public.check_ins (court_id, checked_in_at desc)
  where checked_out_at is null;
create index if not exists check_ins_stale_active_idx
  on public.check_ins (checked_in_at)
  where checked_out_at is null;
create index if not exists check_ins_court_time_idx
  on public.check_ins (court_id, checked_in_at desc);
create index if not exists check_ins_user_time_idx
  on public.check_ins (user_id, checked_in_at desc);

create table if not exists public.runs (
  id uuid primary key default gen_random_uuid(),
  court_id uuid not null references public.courts(id) on delete cascade,
  organizer_id uuid not null references public.profiles(id) on delete cascade,
  client_request_id uuid not null default gen_random_uuid(),
  title text not null check (char_length(btrim(title)) between 3 and 80),
  note text check (note is null or char_length(note) <= 500),
  start_time timestamptz not null,
  max_players integer not null check (max_players between 2 and 100),
  is_open_invite boolean not null default true,
  status text not null default 'scheduled'
    check (status in ('scheduled', 'cancelled', 'completed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint runs_organizer_request_key
    unique (organizer_id, client_request_id)
);

create index if not exists runs_court_status_time_idx
  on public.runs (court_id, status, start_time);
create index if not exists runs_organizer_time_idx
  on public.runs (organizer_id, start_time desc);

create table if not exists public.run_participants (
  run_id uuid not null references public.runs(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  status text not null default 'going'
    check (status in ('going', 'waitlist', 'declined')),
  joined_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (run_id, user_id)
);

create index if not exists run_participants_user_status_idx
  on public.run_participants (user_id, status, joined_at desc);

create table if not exists public.matches (
  id uuid primary key default gen_random_uuid(),
  court_id uuid not null references public.courts(id) on delete cascade,
  created_by uuid not null references public.profiles(id) on delete cascade,
  opponent_id uuid not null references public.profiles(id) on delete cascade,
  client_request_id uuid not null default gen_random_uuid(),
  played_at timestamptz not null default now(),
  score_a integer not null check (score_a >= 0),
  score_b integer not null check (score_b >= 0),
  winner_side text not null check (winner_side in ('a', 'b')),
  visibility text not null default 'public'
    check (visibility in ('public', 'friends', 'private')),
  status text not null default 'pending'
    check (status in ('pending', 'confirmed', 'rejected')),
  confirmed_at timestamptz,
  notes text check (notes is null or char_length(notes) <= 500),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint matches_no_ties_check check (score_a <> score_b),
  constraint matches_not_self_check check (created_by <> opponent_id),
  constraint matches_confirmation_time_check check (
    (status = 'confirmed' and confirmed_at is not null)
    or (status <> 'confirmed' and confirmed_at is null)
  ),
  constraint matches_winner_score_check check (
    (winner_side = 'a' and score_a > score_b)
    or (winner_side = 'b' and score_b > score_a)
  ),
  constraint matches_creator_request_key
    unique (created_by, client_request_id)
);

create index if not exists matches_court_time_idx
  on public.matches (court_id, played_at desc, id);
create index if not exists matches_creator_time_idx
  on public.matches (created_by, played_at desc);
create index if not exists matches_opponent_status_time_idx
  on public.matches (opponent_id, status, played_at desc);

create table if not exists public.match_participants (
  match_id uuid not null references public.matches(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  side text not null check (side in ('a', 'b')),
  display_order smallint not null default 1 check (display_order > 0),
  elo_before integer check (elo_before is null or elo_before between 0 and 5000),
  elo_after integer check (elo_after is null or elo_after between 0 and 5000),
  constraint match_participants_elo_pair_check check (
    (elo_before is null and elo_after is null)
    or (elo_before is not null and elo_after is not null)
  ),
  created_at timestamptz not null default now(),
  primary key (match_id, user_id)
);

create index if not exists match_participants_user_match_idx
  on public.match_participants (user_id, match_id);

create table if not exists public.friendships (
  id uuid primary key default gen_random_uuid(),
  requester_id uuid not null references public.profiles(id) on delete cascade,
  addressee_id uuid not null references public.profiles(id) on delete cascade,
  status text not null default 'pending'
    check (status in ('pending', 'accepted', 'blocked')),
  user_low uuid generated always as (least(requester_id, addressee_id)) stored,
  user_high uuid generated always as (greatest(requester_id, addressee_id)) stored,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint friendships_not_self_check check (requester_id <> addressee_id),
  constraint friendships_pair_key unique (user_low, user_high)
);

create index if not exists friendships_requester_status_idx
  on public.friendships (requester_id, status);
create index if not exists friendships_addressee_status_idx
  on public.friendships (addressee_id, status);

create table if not exists public.planned_visits (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  court_id uuid not null references public.courts(id) on delete cascade,
  planned_at timestamptz not null,
  note text check (note is null or char_length(note) <= 280),
  visibility text not null default 'public'
    check (visibility in ('public', 'friends', 'private')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint planned_visits_user_court_time_key
    unique (user_id, court_id, planned_at)
);

create index if not exists planned_visits_court_time_idx
  on public.planned_visits (court_id, planned_at, id);
create index if not exists planned_visits_user_time_idx
  on public.planned_visits (user_id, planned_at desc);

create table if not exists public.activity_events (
  id bigint generated always as identity primary key,
  event_type text not null check (event_type in (
    'check_in', 'check_out', 'run_created', 'run_joined', 'run_left',
    'match_result', 'planned_visit_created'
  )),
  actor_id uuid references public.profiles(id) on delete set null,
  court_id uuid references public.courts(id) on delete cascade,
  check_in_id uuid references public.check_ins(id) on delete set null,
  run_id uuid references public.runs(id) on delete set null,
  match_id uuid references public.matches(id) on delete set null,
  planned_visit_id uuid references public.planned_visits(id) on delete cascade,
  visibility text not null default 'public'
    check (visibility in ('public', 'friends', 'private')),
  payload jsonb not null default '{}'::jsonb,
  occurred_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  constraint activity_events_planned_visit_key unique (planned_visit_id)
);

create index if not exists activity_events_cursor_idx
  on public.activity_events (occurred_at desc, id desc);
create index if not exists activity_events_court_cursor_idx
  on public.activity_events (court_id, occurred_at desc, id desc)
  where court_id is not null;
create index if not exists activity_events_actor_cursor_idx
  on public.activity_events (actor_id, occurred_at desc, id desc)
  where actor_id is not null;

create table if not exists public.activity_event_likes (
  activity_event_id bigint not null
    references public.activity_events(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (activity_event_id, user_id)
);

create index if not exists activity_event_likes_user_idx
  on public.activity_event_likes (user_id, created_at desc);

create table if not exists public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  revenuecat_app_user_id text not null,
  original_app_user_id text,
  product_id text,
  entitlement_id text,
  status text not null default 'inactive' check (status in (
    'inactive', 'trialing', 'active', 'past_due', 'cancelled', 'expired'
  )),
  billing_provider text not null default 'app_store' check (billing_provider in (
    'app_store', 'play_store', 'stripe', 'promo', 'unknown'
  )),
  will_renew boolean,
  current_period_starts_at timestamptz,
  current_period_ends_at timestamptz,
  trial_ends_at timestamptz,
  cancelled_at timestamptz,
  expires_at timestamptz,
  raw_payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists subscriptions_revenuecat_user_key
  on public.subscriptions (revenuecat_app_user_id, coalesce(entitlement_id, ''));
create index if not exists subscriptions_user_status_idx
  on public.subscriptions (user_id, status, current_period_ends_at desc);

-- Public, non-identifying aggregate state. The view in migration 003 joins
-- this to the canonical courts table without exposing check-in/profile rows.
create table if not exists public.court_metrics (
  court_id uuid primary key references public.courts(id) on delete cascade,
  active_check_in_count bigint not null default 0
    check (active_check_in_count >= 0),
  total_check_ins bigint not null default 0 check (total_check_ins >= 0),
  local_player_count bigint not null default 0 check (local_player_count >= 0),
  updated_at timestamptz not null default now()
);

-- Defense in depth: migration 001 is safe even if migration 002 is delayed.
alter table public.profiles enable row level security;
alter table public.user_settings enable row level security;
alter table public.check_ins enable row level security;
alter table public.runs enable row level security;
alter table public.run_participants enable row level security;
alter table public.matches enable row level security;
alter table public.match_participants enable row level security;
alter table public.friendships enable row level security;
alter table public.planned_visits enable row level security;
alter table public.activity_events enable row level security;
alter table public.activity_event_likes enable row level security;
alter table public.subscriptions enable row level security;
alter table public.court_metrics enable row level security;

revoke all on table
  public.profiles, public.user_settings, public.check_ins, public.runs,
  public.run_participants, public.matches, public.match_participants,
  public.friendships, public.planned_visits, public.activity_events,
  public.activity_event_likes, public.subscriptions, public.court_metrics
from anon, authenticated;
revoke all on sequence public.activity_events_id_seq from anon, authenticated;

commit;

