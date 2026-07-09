-- =====================================================================
-- LocalCheck — Supabase Baseline Snapshot
-- Project: jzclwnzcektqhgkkdeje (us-west-2)
-- Extracted directly from the LIVE database via Supabase MCP on 2026-07-09.
-- This is NOT a migration history — the project has none checked into
-- git (confirmed: no migration files exist in jGPT-Automated/LocalCheck_Expo).
-- This file is a reverse-engineered snapshot so the schema, triggers, and
-- RPC functions have at least one version-controlled reference point.
-- Re-run the extraction queries at the bottom before trusting this file
-- if significant time has passed.
-- =====================================================================

-- ─── ENUM TYPES (confirmed live) ─────────────────────────────────────
-- sport_type:            basketball, pickleball, tennis, soccer, volleyball
-- game_side:             a, b
-- feed_post_type:        check_in, note, game_result
-- scheduled_game_status: scheduled, cancelled, completed
-- rsvp_status:           going, waitlist, declined
-- subscription_status:   inactive, trialing, active, past_due, cancelled, expired
-- billing_provider:      app_store, play_store, stripe, promo, unknown

-- ⚠️ CRITICAL: the mobile client (gameService.ts, scheduledGameService.ts)
-- currently writes 'A'/'B' and 'open'/'team_a'/'team_b' — NONE of these
-- are valid values for the enums above. Confirmed live: every games row
-- and the one scheduled_games row in production has the CORRECT lowercase
-- enum values, meaning they were inserted directly (SQL editor / seed),
-- NOT through the app's current code path. If a real user hit these flows
-- today, the insert would fail and be silently swallowed by the
-- `catch { /* Best-effort */ }` blocks in both service files.

-- =====================================================================
-- TABLES (verified against live `list_tables`, 13 tables, all RLS-enabled)
-- =====================================================================

CREATE TABLE public.profiles (
  id uuid NOT NULL,
  email citext,
  display_name text NOT NULL CHECK (char_length(btrim(display_name)) BETWEEN 1 AND 80),
  username citext NOT NULL UNIQUE CHECK (username ~ '^[A-Za-z0-9_]{3,32}$'),
  avatar_url text,
  elo_rating integer NOT NULL DEFAULT 1200 CHECK (elo_rating BETWEEN 0 AND 5000),
  wins integer NOT NULL DEFAULT 0 CHECK (wins >= 0),
  losses integer NOT NULL DEFAULT 0 CHECK (losses >= 0),
  total_court_time_minutes integer NOT NULL DEFAULT 0 CHECK (total_court_time_minutes >= 0),
  apple_private_email boolean NOT NULL DEFAULT false,
  push_notifications_enabled boolean NOT NULL DEFAULT true,
  check_in_reminders_enabled boolean NOT NULL DEFAULT true,
  game_alerts_enabled boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  local_court_id uuid REFERENCES public.courts(id),
  preferred_sport sport_type,                 -- NULL = no preference
  is_pro boolean NOT NULL DEFAULT false,       -- ⚠️ DERIVED via trg_sync_profile_is_pro.
                                                -- DB comment literally says:
                                                -- "Do not write directly from the client."
                                                -- AppContext.setIsLocalPlus() currently
                                                -- violates this by calling
                                                -- updateProfileFields(userId,{is_pro:v}).
  last_latitude double precision CHECK (last_latitude BETWEEN -90 AND 90),
  last_longitude double precision CHECK (last_longitude BETWEEN -180 AND 180),
  last_location_at timestamptz,                -- always NULL today — nothing writes this
  CONSTRAINT profiles_pkey PRIMARY KEY (id),
  CONSTRAINT profiles_id_fkey FOREIGN KEY (id) REFERENCES auth.users(id)
);
-- Live rows: 13

CREATE TABLE public.courts (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  name text NOT NULL CHECK (char_length(btrim(name)) BETWEEN 1 AND 120),
  address text NOT NULL CHECK (char_length(btrim(address)) BETWEEN 1 AND 250),
  latitude double precision NOT NULL CHECK (latitude BETWEEN -90 AND 90),
  longitude double precision NOT NULL CHECK (longitude BETWEEN -180 AND 180),
  sport_type sport_type NOT NULL DEFAULT 'basketball',
  added_by uuid NOT NULL REFERENCES auth.users(id),
  image_url text,
  verification_threshold integer NOT NULL DEFAULT 5 CHECK (verification_threshold BETWEEN 1 AND 100),
  is_archived boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  location text,
  state text,
  CONSTRAINT courts_pkey PRIMARY KEY (id)
);
-- Live rows: 6

CREATE TABLE public.check_ins (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id),
  court_id uuid NOT NULL REFERENCES public.courts(id),
  note text CHECK (note IS NULL OR char_length(note) <= 280),
  checked_in_at timestamptz NOT NULL DEFAULT now(),
  checked_out_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  visibility text DEFAULT 'public' CHECK (visibility IN ('public','friends','private')),
  CONSTRAINT check_ins_pkey PRIMARY KEY (id)
);
-- Live rows: 23

CREATE TABLE public.games (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  court_id uuid NOT NULL REFERENCES public.courts(id),
  created_by uuid NOT NULL REFERENCES auth.users(id),
  played_at timestamptz NOT NULL DEFAULT now(),
  score_a integer NOT NULL CHECK (score_a >= 0),
  score_b integer NOT NULL CHECK (score_b >= 0),
  winner_side game_side NOT NULL,   -- ⚠️ lowercase 'a'/'b' only — client sends 'A'/'B'
  notes text CHECK (notes IS NULL OR char_length(notes) <= 500),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT games_pkey PRIMARY KEY (id)
);
-- Live rows: 3 (all winner_side = 'a' — consistent with manual seeding, not real usage)

CREATE TABLE public.game_participants (
  game_id uuid NOT NULL REFERENCES public.games(id),
  user_id uuid NOT NULL REFERENCES auth.users(id),
  team_side game_side NOT NULL,     -- ⚠️ lowercase 'a'/'b' only — client sends 'A'/'B'
  display_order smallint NOT NULL DEFAULT 1 CHECK (display_order > 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT game_participants_pkey PRIMARY KEY (game_id, user_id)
);
-- Live rows: 8 (4 'a' / 4 'b' — confirms lowercase-only data ever persisted)

CREATE TABLE public.feed_posts (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  author_id uuid NOT NULL REFERENCES auth.users(id),
  court_id uuid NOT NULL REFERENCES public.courts(id),
  game_id uuid REFERENCES public.games(id),
  post_type feed_post_type NOT NULL DEFAULT 'note',
  content text NOT NULL CHECK (char_length(btrim(content)) BETWEEN 1 AND 500),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT feed_posts_pkey PRIMARY KEY (id)
);
-- Live rows: 4 — ALL created by trg_log_checkin_feed_post (see below).
-- The mobile client's feedService.ts NEVER reads from this table; it
-- reconstructs the feed ad hoc from check_ins + games + scheduled_games.
-- These 4 rows are functionally orphaned.

CREATE TABLE public.feed_post_likes (
  post_id uuid NOT NULL REFERENCES public.feed_posts(id),
  user_id uuid NOT NULL REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT feed_post_likes_pkey PRIMARY KEY (post_id, user_id)
);
-- Live rows: 0. hypePost() in feedService.ts writes here, but since the
-- client never surfaces a real feed_posts.id to the UI, this call can
-- never target a row that actually matches what the user is looking at.

CREATE TABLE public.game_likes (
  game_id uuid NOT NULL REFERENCES public.games(id),
  user_id uuid NOT NULL REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT game_likes_pkey PRIMARY KEY (game_id, user_id)
);
-- Live rows: 0. No service function, no UI.

CREATE TABLE public.game_comments (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  game_id uuid NOT NULL REFERENCES public.games(id),
  user_id uuid NOT NULL REFERENCES auth.users(id),
  body text NOT NULL CHECK (char_length(btrim(body)) BETWEEN 1 AND 1000),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT game_comments_pkey PRIMARY KEY (id)
);
-- Live rows: 0. No service function, no UI.

CREATE TABLE public.scheduled_games (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  court_id uuid NOT NULL REFERENCES public.courts(id),
  organizer_id uuid NOT NULL REFERENCES auth.users(id),
  title text NOT NULL CHECK (char_length(btrim(title)) BETWEEN 3 AND 80),
  note text CHECK (note IS NULL OR char_length(note) <= 500),
  start_time timestamptz NOT NULL,
  max_players integer NOT NULL CHECK (max_players BETWEEN 2 AND 20),
  is_open_invite boolean NOT NULL DEFAULT true,
  status scheduled_game_status NOT NULL DEFAULT 'scheduled',  -- ⚠️ client inserts 'open'
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT scheduled_games_pkey PRIMARY KEY (id)
);
-- Live rows: 1, status = 'scheduled' (correct enum value — again, not what
-- createScheduledGame() currently sends, so this row was seeded manually)

CREATE TABLE public.scheduled_game_participants (
  scheduled_game_id uuid NOT NULL REFERENCES public.scheduled_games(id),
  user_id uuid NOT NULL REFERENCES auth.users(id),
  rsvp_status rsvp_status NOT NULL DEFAULT 'going',  -- ⚠️ client inserts 'team_a'/'team_b'
  joined_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT scheduled_game_participants_pkey PRIMARY KEY (scheduled_game_id, user_id)
);
-- Live rows: 1, rsvp_status = 'going' (correct enum value — same story)

CREATE TABLE public.subscriptions (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id),
  revenuecat_app_user_id text NOT NULL,
  original_app_user_id text,
  product_id text,
  entitlement_id text,
  status subscription_status NOT NULL DEFAULT 'inactive',
  billing_provider billing_provider NOT NULL DEFAULT 'app_store',
  will_renew boolean,
  current_period_starts_at timestamptz,
  current_period_ends_at timestamptz,
  trial_ends_at timestamptz,
  cancelled_at timestamptz,
  expires_at timestamptz,
  raw_payload jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT subscriptions_pkey PRIMARY KEY (id)
);
-- Live rows: 0. RevenueCat is not integrated anywhere. The sync trigger
-- below is ready and waiting for rows that will never come until a real
-- webhook/RevenueCat pipeline exists.

CREATE TABLE public.subscription_events (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  subscription_id uuid REFERENCES public.subscriptions(id),
  user_id uuid REFERENCES auth.users(id),
  event_type text NOT NULL,
  event_payload jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT subscription_events_pkey PRIMARY KEY (id)
);
-- Live rows: 0.

CREATE TABLE public.friendships (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  requester_id uuid REFERENCES auth.users(id),
  addressee_id uuid REFERENCES auth.users(id),
  status text DEFAULT 'pending' CHECK (status IN ('pending','accepted','blocked')),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  CONSTRAINT friendships_pkey PRIMARY KEY (id)
);
-- Live rows: 10. addFriend() always inserts status='accepted' directly —
-- the pending/blocked states this schema supports are never used.

-- =====================================================================
-- FUNCTIONS & TRIGGERS (verbatim from pg_get_functiondef, live 2026-07-09)
-- =====================================================================

-- Auto-provisions a profile row on signup. Confirms the behavior
-- AuthContext.tsx's comments describe — this trigger is real and working.
CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  base_username text;
  final_display_name text;
begin
  base_username := lower(regexp_replace(
    coalesce(
      nullif(new.raw_user_meta_data ->> 'preferred_username', ''),
      nullif(new.raw_user_meta_data ->> 'user_name', ''),
      nullif(new.raw_user_meta_data ->> 'display_name', ''),
      nullif(new.raw_user_meta_data ->> 'full_name', ''),
      nullif(split_part(coalesce(new.email, ''), '@', 1), ''),
      'player'),
    '[^a-zA-Z0-9_]+', '', 'g'));
  if base_username = '' then base_username := 'player'; end if;
  final_display_name := coalesce(
    nullif(new.raw_user_meta_data ->> 'display_name', ''),
    nullif(new.raw_user_meta_data ->> 'full_name', ''),
    nullif(new.raw_user_meta_data ->> 'name', ''),
    nullif(new.raw_user_meta_data ->> 'user_name', ''),
    nullif(split_part(coalesce(new.email, ''), '@', 1), ''),
    'Player');
  insert into public.profiles (id, email, display_name, username, apple_private_email)
  values (
    new.id, new.email, final_display_name,
    left(base_username, 23) || '_' || substr(replace(new.id::text, '-', ''), 1, 8),
    coalesce(new.email, '') ilike '%privaterelay.appleid.com')
  on conflict (id) do nothing;
  return new;
end;
$function$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Auto-creates a feed_posts row on every PUBLIC check-in.
-- Note: only fires for post_type='check_in'. Nothing fires for
-- 'note' or 'game_result' except log_game() below.
CREATE OR REPLACE FUNCTION public.log_checkin_feed_post()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
  IF NEW.visibility = 'public' THEN
    INSERT INTO public.feed_posts (author_id, court_id, post_type, content)
    VALUES (NEW.user_id, NEW.court_id, 'check_in', 'checked in');
  END IF;
  RETURN NEW;
END;
$function$;

CREATE TRIGGER trg_log_checkin_feed_post
  AFTER INSERT ON public.check_ins
  FOR EACH ROW EXECUTE FUNCTION public.log_checkin_feed_post();

-- Keeps profiles.is_pro derived from subscriptions. THIS IS THE REASON
-- profiles.is_pro carries the "do not write directly from client" comment.
CREATE OR REPLACE FUNCTION public.sync_profile_is_pro()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  target_user uuid := coalesce(new.user_id, old.user_id);
begin
  update public.profiles
  set is_pro = exists (
    select 1 from public.subscriptions s
    where s.user_id = target_user
      and s.status in ('active', 'trialing')
  )
  where id = target_user;
  return coalesce(new, old);
end;
$function$;

CREATE TRIGGER trg_sync_profile_is_pro
  AFTER INSERT OR UPDATE OR DELETE ON public.subscriptions
  FOR EACH ROW EXECUTE FUNCTION public.sync_profile_is_pro();

-- ⭐ ALREADY BUILT, ALREADY CORRECT, NEVER CALLED BY THE CLIENT. ⭐
-- Atomically: inserts the game, inserts both participants (correct-case
-- enum, auto-derives opponent's side), computes a REAL Elo update
-- (K=32, expected-score formula) for both players, updates wins/losses,
-- and posts a game_result feed_posts row. This single RPC replaces
-- gameService.ts's logGame() AND fixes P0-1/P0-3 simultaneously.
CREATE OR REPLACE FUNCTION public.log_game(
  p_court_id uuid, p_opponent_id uuid, p_my_side game_side,
  p_score_a integer, p_score_b integer, p_winner_side game_side,
  p_notes text DEFAULT NULL::text
)
 RETURNS games
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_me uuid := (select auth.uid());
  v_game public.games;
  v_opp_side public.game_side;
  v_my_elo integer;
  v_opp_elo integer;
  v_expected_me numeric;
  v_delta integer;
  v_i_won boolean;
  v_winner_id uuid;
  v_winner_name text;
BEGIN
  IF v_me IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;
  IF p_opponent_id IS NULL OR p_opponent_id = v_me THEN
    RAISE EXCEPTION 'opponent must be another user';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = p_opponent_id) THEN
    RAISE EXCEPTION 'opponent profile not found';
  END IF;

  v_opp_side := CASE WHEN p_my_side = 'a' THEN 'b'::public.game_side ELSE 'a'::public.game_side END;

  INSERT INTO public.games (court_id, created_by, score_a, score_b, winner_side, notes)
  VALUES (p_court_id, v_me, p_score_a, p_score_b, p_winner_side, p_notes)
  RETURNING * INTO v_game;

  INSERT INTO public.game_participants (game_id, user_id, team_side, display_order)
  VALUES (v_game.id, v_me, p_my_side, 1), (v_game.id, p_opponent_id, v_opp_side, 2);

  SELECT elo_rating INTO v_my_elo FROM public.profiles WHERE id = v_me;
  SELECT elo_rating INTO v_opp_elo FROM public.profiles WHERE id = p_opponent_id;

  v_expected_me := 1.0 / (1.0 + power(10.0, (v_opp_elo - v_my_elo) / 400.0));
  v_i_won := (p_winner_side = p_my_side);

  IF v_i_won THEN
    v_delta := greatest(1, round(32 * (1.0 - v_expected_me)));
    UPDATE public.profiles SET elo_rating = LEAST(5000, elo_rating + v_delta), wins = wins + 1 WHERE id = v_me;
    UPDATE public.profiles SET elo_rating = GREATEST(0, elo_rating - v_delta), losses = losses + 1 WHERE id = p_opponent_id;
    v_winner_id := v_me;
  ELSE
    v_delta := greatest(1, round(32 * v_expected_me));
    UPDATE public.profiles SET elo_rating = LEAST(5000, elo_rating + v_delta), wins = wins + 1 WHERE id = p_opponent_id;
    UPDATE public.profiles SET elo_rating = GREATEST(0, elo_rating - v_delta), losses = losses + 1 WHERE id = v_me;
    v_winner_id := p_opponent_id;
  END IF;

  SELECT display_name INTO v_winner_name FROM public.profiles WHERE id = v_winner_id;

  INSERT INTO public.feed_posts (author_id, court_id, game_id, post_type, content)
  VALUES (v_winner_id, p_court_id, v_game.id, 'game_result',
          COALESCE(v_winner_name, 'Player') || ' won ' || p_score_a || '-' || p_score_b);

  RETURN v_game;
END;
$function$;

-- ⭐ ALSO ALREADY BUILT, ALSO NEVER CALLED. ⭐
-- Atomically checks the caller out of any currently-active check-in
-- before checking them into the new court. Fixes the "checked into two
-- courts at once" edge case that checkInService.ts's separate
-- checkIn/checkOut calls don't guard against. Also already supports the
-- `note` field the UI has no input for yet.
CREATE OR REPLACE FUNCTION public.switch_active_checkin(
  p_court_id uuid, p_visibility text DEFAULT 'public'::text, p_note text DEFAULT NULL::text
)
 RETURNS check_ins
 LANGUAGE plpgsql
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_row public.check_ins;
BEGIN
  IF (select auth.uid()) IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;
  UPDATE public.check_ins
    SET checked_out_at = now()
    WHERE user_id = (select auth.uid()) AND checked_out_at IS NULL;
  INSERT INTO public.check_ins (user_id, court_id, visibility, note)
    VALUES ((select auth.uid()), p_court_id, p_visibility, p_note)
    RETURNING * INTO v_row;
  RETURN v_row;
END;
$function$;

-- `updated_at` bump triggers exist on: courts, feed_posts, friendships,
-- game_comments, games, profiles, scheduled_games, subscriptions.
-- All call public.set_updated_at() (standard "NEW.updated_at := now()"
-- pattern). Body not re-verified verbatim in this snapshot — low risk,
-- flagged by the security advisor only for a mutable search_path (WARN,
-- not urgent).

-- =====================================================================
-- KNOWN VIEWS (exist live, referenced by earlier docs; NOT captured here)
-- courts_with_stats, active_check_ins, games_with_counts,
-- feed_posts_with_counts, city_courts_summary, state_courts_summary
-- All flagged by the security advisor as SECURITY DEFINER views
-- (courts_with_stats, city_courts_summary, state_courts_summary) — worth
-- reviewing whether that's intentional. Pull defs with:
--   select pg_get_viewdef('public.courts_with_stats', true);
-- =====================================================================

-- =====================================================================
-- RE-EXTRACTION QUERIES — run these again before trusting this file
-- =====================================================================
-- Enums:
--   select t.typname, e.enumlabel from pg_type t
--   join pg_enum e on t.oid = e.enumtypid order by t.typname, e.enumsortorder;
-- Functions:
--   select p.proname, pg_get_functiondef(p.oid) from pg_proc p
--   join pg_namespace n on n.oid = p.pronamespace where n.nspname='public';
-- Triggers:
--   select event_object_table, trigger_name, action_timing, event_manipulation
--   from information_schema.triggers where trigger_schema in ('public','auth');
-- Row counts / RLS: use the Supabase MCP `list_tables` tool (verbose).