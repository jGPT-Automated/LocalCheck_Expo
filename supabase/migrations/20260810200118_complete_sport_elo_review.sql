-- LocalCheck: complete the sport-specific Elo half of the MVP backend.
--
-- Target: LocalCheckProd (qkrnmyexzvaxiqfxwwfb).
--
-- WHY THIS FILE EXISTS
-- `20260729_mvp_notifications_and_sport_elo.sql` was only partially applied to
-- production. Verified by direct query on 2026-08-03:
--
--   ALREADY LIVE  notifications / push_tokens / run_invitations tables and
--                 their RPCs, private.create_notification, the notify_*
--                 triggers, broadcast_notification_invalidation, join_run,
--                 register_push_token, profiles.push_notifications_enabled,
--                 and the OLD single-rating log_match / confirm_match /
--                 reject_match.
--   MISSING       private.apply_match_elo, private.auto_confirm_due_matches,
--                 the six per-sport columns on profiles, the four review
--                 columns on matches, and the sport-aware match RPCs.
--
-- This file carries ONLY the missing half, extracted verbatim from that
-- migration, so it cannot re-run work that is already live.
--
-- SAFETY (pre-flighted read-only against production, 2026-08-03)
--   * Additive only: no drop, delete, or truncate.
--   * The legacy `profiles.elo_rating` is deliberately left in place so an
--     older installed build keeps rendering while the new client rolls out.
--   * The one abort risk is `matches.sport SET NOT NULL` after the backfill
--     from `courts`. Rechecked read-only on 2026-08-10: 7 matches,
--     0 unresolvable, 24 profiles, and 14 match participants.
--
-- Apply with `supabase db push` (or the SQL editor) and re-verify that
-- private.apply_match_elo and private.auto_confirm_due_matches exist.

begin;

set local lock_timeout = '5s';
set local statement_timeout = '90s';

create extension if not exists pg_cron;

-- -------------------------------------------------------------------------
-- Sport-specific rating state. The legacy overall fields stay in place so an
-- older installed build can continue to render while the new client rolls out.
-- -------------------------------------------------------------------------

alter table public.profiles
  add column if not exists elo_basketball integer not null default 1200,
  add column if not exists elo_pickleball integer not null default 1200,
  add column if not exists basketball_wins integer not null default 0,
  add column if not exists basketball_losses integer not null default 0,
  add column if not exists pickleball_wins integer not null default 0,
  add column if not exists pickleball_losses integer not null default 0,
  add column if not exists push_notifications_enabled boolean not null default false;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'profiles_sport_elo_check') then
    alter table public.profiles add constraint profiles_sport_elo_check check (
      elo_basketball between 0 and 5000 and elo_pickleball between 0 and 5000
    );
  end if;
  if not exists (select 1 from pg_constraint where conname = 'profiles_sport_records_check') then
    alter table public.profiles add constraint profiles_sport_records_check check (
      basketball_wins >= 0 and basketball_losses >= 0
      and pickleball_wins >= 0 and pickleball_losses >= 0
    );
  end if;
end
$$;

alter table public.matches
  add column if not exists sport text,
  add column if not exists review_due_at timestamptz,
  add column if not exists reviewed_at timestamptz,
  add column if not exists confirmation_method text;

update public.matches m
set sport = lower(c.sport_type::text)
from public.courts c
where c.id = m.court_id
  and m.sport is null;

update public.matches
set review_due_at = created_at + interval '3 days'
where review_due_at is null;

alter table public.matches
  alter column sport set not null,
  alter column review_due_at set default (now() + interval '3 days'),
  alter column review_due_at set not null;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'matches_sport_check') then
    alter table public.matches add constraint matches_sport_check
      check (sport in ('basketball', 'pickleball'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'matches_confirmation_method_check') then
    alter table public.matches add constraint matches_confirmation_method_check
      check (confirmation_method is null or confirmation_method in ('manual', 'automatic'));
  end if;
end
$$;

create index if not exists matches_pending_review_due_idx
  on public.matches (review_due_at)
  where status = 'pending';

-- Replay confirmed history once so existing confirmed games are represented
-- in the new sport ratings. The old overall rating is intentionally untouched.
update public.profiles
set elo_basketball = 1200,
    elo_pickleball = 1200,
    basketball_wins = 0,
    basketball_losses = 0,
    pickleball_wins = 0,
    pickleball_losses = 0;

do $$
declare
  v_match public.matches;
  v_creator_elo integer;
  v_opponent_elo integer;
  v_creator_after integer;
  v_opponent_after integer;
  v_expected numeric;
  v_delta integer;
begin
  for v_match in
    select * from public.matches
    where status = 'confirmed'
    order by confirmed_at nulls last, created_at, id
  loop
    if v_match.sport = 'basketball' then
      select elo_basketball into v_creator_elo from public.profiles where id = v_match.created_by;
      select elo_basketball into v_opponent_elo from public.profiles where id = v_match.opponent_id;
    else
      select elo_pickleball into v_creator_elo from public.profiles where id = v_match.created_by;
      select elo_pickleball into v_opponent_elo from public.profiles where id = v_match.opponent_id;
    end if;

    v_expected := 1.0 / (1.0 + power(10.0, (v_opponent_elo - v_creator_elo) / 400.0));
    if v_match.winner_side = 'a' then
      v_delta := greatest(1, round(32 * (1.0 - v_expected))::integer);
      v_creator_after := least(5000, v_creator_elo + v_delta);
      v_opponent_after := greatest(0, v_opponent_elo - v_delta);
    else
      v_delta := greatest(1, round(32 * v_expected)::integer);
      v_creator_after := greatest(0, v_creator_elo - v_delta);
      v_opponent_after := least(5000, v_opponent_elo + v_delta);
    end if;

    update public.match_participants
    set elo_before = case when user_id = v_match.created_by then v_creator_elo else v_opponent_elo end,
        elo_after = case when user_id = v_match.created_by then v_creator_after else v_opponent_after end
    where match_id = v_match.id;

    if v_match.sport = 'basketball' then
      update public.profiles set
        elo_basketball = v_creator_after,
        basketball_wins = basketball_wins + case when v_match.winner_side = 'a' then 1 else 0 end,
        basketball_losses = basketball_losses + case when v_match.winner_side = 'b' then 1 else 0 end
      where id = v_match.created_by;
      update public.profiles set
        elo_basketball = v_opponent_after,
        basketball_wins = basketball_wins + case when v_match.winner_side = 'b' then 1 else 0 end,
        basketball_losses = basketball_losses + case when v_match.winner_side = 'a' then 1 else 0 end
      where id = v_match.opponent_id;
    else
      update public.profiles set
        elo_pickleball = v_creator_after,
        pickleball_wins = pickleball_wins + case when v_match.winner_side = 'a' then 1 else 0 end,
        pickleball_losses = pickleball_losses + case when v_match.winner_side = 'b' then 1 else 0 end
      where id = v_match.created_by;
      update public.profiles set
        elo_pickleball = v_opponent_after,
        pickleball_wins = pickleball_wins + case when v_match.winner_side = 'b' then 1 else 0 end,
        pickleball_losses = pickleball_losses + case when v_match.winner_side = 'a' then 1 else 0 end
      where id = v_match.opponent_id;
    end if;
  end loop;
end
$$;

-- -------------------------------------------------------------------------
-- Score logging and confirmation. Court sport is authoritative. One private
-- transaction updates the selected sport and the legacy overall rating.
-- -------------------------------------------------------------------------

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
  v_sport text;
  v_notes text := nullif(btrim(p_notes), '');
  v_request_id uuid := coalesce(p_client_request_id, gen_random_uuid());
begin
  if v_user_id is null then raise exception 'not authenticated' using errcode = '42501'; end if;
  if p_opponent_id is null or p_opponent_id = v_user_id then
    raise exception 'opponent must be another user' using errcode = '22023';
  end if;
  if p_my_score < 0 or p_opponent_score < 0 or p_my_score = p_opponent_score then
    raise exception 'scores must be non-negative and cannot tie' using errcode = '22023';
  end if;
  if p_visibility not in ('public', 'friends', 'private') then
    raise exception 'invalid visibility' using errcode = '22023';
  end if;
  select lower(c.sport_type::text) into v_sport
  from public.courts c where c.id = p_court_id and not c.is_archived;
  if v_sport is null or v_sport not in ('basketball', 'pickleball') then
    raise exception 'court sport is not supported for ranking' using errcode = '22023';
  end if;
  if not exists (select 1 from public.profiles where id = p_opponent_id) then
    raise exception 'opponent profile not found' using errcode = '23503';
  end if;
  if private.users_are_blocked(v_user_id, p_opponent_id) then
    raise exception 'interaction is blocked' using errcode = '42501';
  end if;
  v_winner_side := case when p_my_score > p_opponent_score then 'a' else 'b' end;

  insert into public.matches (
    court_id, created_by, opponent_id, client_request_id, score_a, score_b,
    winner_side, notes, visibility, sport, review_due_at
  ) values (
    p_court_id, v_user_id, p_opponent_id, v_request_id, p_my_score,
    p_opponent_score, v_winner_side, v_notes, p_visibility, v_sport,
    now() + interval '3 days'
  ) on conflict (created_by, client_request_id) do nothing
  returning * into v_match;

  if v_match.id is null then
    select * into v_match from public.matches
    where created_by = v_user_id and client_request_id = v_request_id;
    if v_match.court_id is distinct from p_court_id
       or v_match.opponent_id is distinct from p_opponent_id
       or v_match.score_a is distinct from p_my_score
       or v_match.score_b is distinct from p_opponent_score
       or v_match.notes is distinct from v_notes
       or v_match.visibility is distinct from p_visibility then
      raise exception 'client request id reused with different match data' using errcode = '23505';
    end if;
    return v_match;
  end if;

  insert into public.match_participants (match_id, user_id, side, display_order)
  values (v_match.id, v_user_id, 'a', 1), (v_match.id, p_opponent_id, 'b', 2);
  return v_match;
end
$$;

create or replace function private.apply_match_elo(
  p_match_id uuid,
  p_confirmation_method text
)
returns public.matches
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_match public.matches;
  v_creator_sport_elo integer;
  v_opponent_sport_elo integer;
  v_creator_sport_after integer;
  v_opponent_sport_after integer;
  v_sport_expected numeric;
  v_sport_delta integer;
  v_creator_global_elo integer;
  v_opponent_global_elo integer;
  v_creator_global_after integer;
  v_opponent_global_after integer;
  v_global_expected numeric;
  v_global_delta integer;
  v_winner_id uuid;
begin
  if p_confirmation_method not in ('manual', 'automatic') then
    raise exception 'invalid confirmation method' using errcode = '22023';
  end if;
  select * into v_match from public.matches where id = p_match_id for update;
  if not found then raise exception 'match not found' using errcode = 'P0002'; end if;
  if v_match.status = 'confirmed' then return v_match; end if;
  if v_match.status <> 'pending' then raise exception 'match is not pending' using errcode = '22023'; end if;
  if (select count(*) from public.match_participants where match_id = v_match.id) <> 2 then
    raise exception 'match participant invariant failed' using errcode = '23514';
  end if;

  perform 1 from public.profiles
  where id in (v_match.created_by, v_match.opponent_id)
  order by id for update;

  select elo_rating,
    case when v_match.sport = 'basketball' then elo_basketball else elo_pickleball end
  into v_creator_global_elo, v_creator_sport_elo
  from public.profiles where id = v_match.created_by;
  select elo_rating,
    case when v_match.sport = 'basketball' then elo_basketball else elo_pickleball end
  into v_opponent_global_elo, v_opponent_sport_elo
  from public.profiles where id = v_match.opponent_id;

  v_sport_expected := 1.0 / (1.0 + power(10.0, (v_opponent_sport_elo - v_creator_sport_elo) / 400.0));
  v_global_expected := 1.0 / (1.0 + power(10.0, (v_opponent_global_elo - v_creator_global_elo) / 400.0));
  if v_match.winner_side = 'a' then
    v_winner_id := v_match.created_by;
    v_sport_delta := greatest(1, round(32 * (1.0 - v_sport_expected))::integer);
    v_global_delta := greatest(1, round(32 * (1.0 - v_global_expected))::integer);
    v_creator_sport_after := least(5000, v_creator_sport_elo + v_sport_delta);
    v_opponent_sport_after := greatest(0, v_opponent_sport_elo - v_sport_delta);
    v_creator_global_after := least(5000, v_creator_global_elo + v_global_delta);
    v_opponent_global_after := greatest(0, v_opponent_global_elo - v_global_delta);
  else
    v_winner_id := v_match.opponent_id;
    v_sport_delta := greatest(1, round(32 * v_sport_expected)::integer);
    v_global_delta := greatest(1, round(32 * v_global_expected)::integer);
    v_creator_sport_after := greatest(0, v_creator_sport_elo - v_sport_delta);
    v_opponent_sport_after := least(5000, v_opponent_sport_elo + v_sport_delta);
    v_creator_global_after := greatest(0, v_creator_global_elo - v_global_delta);
    v_opponent_global_after := least(5000, v_opponent_global_elo + v_global_delta);
  end if;

  update public.match_participants set
    elo_before = case when user_id = v_match.created_by then v_creator_sport_elo else v_opponent_sport_elo end,
    elo_after = case when user_id = v_match.created_by then v_creator_sport_after else v_opponent_sport_after end
  where match_id = v_match.id;

  update public.profiles set
    elo_rating = v_creator_global_after,
    wins = wins + case when v_winner_id = v_match.created_by then 1 else 0 end,
    losses = losses + case when v_winner_id <> v_match.created_by then 1 else 0 end,
    elo_basketball = case when v_match.sport = 'basketball' then v_creator_sport_after else elo_basketball end,
    elo_pickleball = case when v_match.sport = 'pickleball' then v_creator_sport_after else elo_pickleball end,
    basketball_wins = basketball_wins + case when v_match.sport = 'basketball' and v_winner_id = v_match.created_by then 1 else 0 end,
    basketball_losses = basketball_losses + case when v_match.sport = 'basketball' and v_winner_id <> v_match.created_by then 1 else 0 end,
    pickleball_wins = pickleball_wins + case when v_match.sport = 'pickleball' and v_winner_id = v_match.created_by then 1 else 0 end,
    pickleball_losses = pickleball_losses + case when v_match.sport = 'pickleball' and v_winner_id <> v_match.created_by then 1 else 0 end,
    updated_at = now()
  where id = v_match.created_by;

  update public.profiles set
    elo_rating = v_opponent_global_after,
    wins = wins + case when v_winner_id = v_match.opponent_id then 1 else 0 end,
    losses = losses + case when v_winner_id <> v_match.opponent_id then 1 else 0 end,
    elo_basketball = case when v_match.sport = 'basketball' then v_opponent_sport_after else elo_basketball end,
    elo_pickleball = case when v_match.sport = 'pickleball' then v_opponent_sport_after else elo_pickleball end,
    basketball_wins = basketball_wins + case when v_match.sport = 'basketball' and v_winner_id = v_match.opponent_id then 1 else 0 end,
    basketball_losses = basketball_losses + case when v_match.sport = 'basketball' and v_winner_id <> v_match.opponent_id then 1 else 0 end,
    pickleball_wins = pickleball_wins + case when v_match.sport = 'pickleball' and v_winner_id = v_match.opponent_id then 1 else 0 end,
    pickleball_losses = pickleball_losses + case when v_match.sport = 'pickleball' and v_winner_id <> v_match.opponent_id then 1 else 0 end,
    updated_at = now()
  where id = v_match.opponent_id;

  update public.matches set
    status = 'confirmed', confirmed_at = now(), reviewed_at = now(),
    confirmation_method = p_confirmation_method
  where id = v_match.id returning * into v_match;

  if coalesce(current_setting('localcheck.suppress_activity', true), '') <> 'on' then
    insert into public.activity_events (
      event_type, actor_id, court_id, match_id, visibility, payload, occurred_at
    ) values (
      'match_result', v_winner_id, v_match.court_id, v_match.id, v_match.visibility,
      jsonb_build_object(
        'score_a', v_match.score_a, 'score_b', v_match.score_b,
        'winner_side', v_match.winner_side,
        'player_a_id', v_match.created_by, 'player_b_id', v_match.opponent_id,
        'sport', v_match.sport
      ), v_match.confirmed_at
    );
  end if;
  return v_match;
end
$$;

revoke execute on function private.apply_match_elo(uuid, text)
  from public, anon, authenticated;

create or replace function public.confirm_match(p_match_id uuid)
returns public.matches
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_match public.matches;
begin
  if v_user_id is null then raise exception 'not authenticated' using errcode = '42501'; end if;
  select * into v_match from public.matches where id = p_match_id;
  if not found then raise exception 'match not found' using errcode = 'P0002'; end if;
  if v_match.opponent_id <> v_user_id then
    raise exception 'only the named opponent can confirm this match' using errcode = '42501';
  end if;
  return private.apply_match_elo(p_match_id, 'manual');
end
$$;

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
  if v_user_id is null then raise exception 'not authenticated' using errcode = '42501'; end if;
  update public.matches set status = 'rejected', reviewed_at = now()
  where id = p_match_id and status = 'pending'
    and (created_by = v_user_id or opponent_id = v_user_id)
  returning * into v_match;
  if v_match.id is null then
    select * into v_match from public.matches
    where id = p_match_id and status = 'rejected'
      and (created_by = v_user_id or opponent_id = v_user_id);
    if v_match.id is null then
      raise exception 'pending match not found' using errcode = 'P0002';
    end if;
  end if;
  return v_match;
end
$$;

create or replace function private.auto_confirm_due_matches()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
  v_count integer := 0;
begin
  for v_id in
    select id from public.matches
    where status = 'pending' and review_due_at <= now()
    order by review_due_at
    for update skip locked
  loop
    perform private.apply_match_elo(v_id, 'automatic');
    v_count := v_count + 1;
  end loop;
  return v_count;
end
$$;

revoke execute on function private.auto_confirm_due_matches()
  from public, anon, authenticated;

revoke execute on function public.log_match(uuid, uuid, integer, integer, text, text, uuid)
  from public, anon;
revoke execute on function public.confirm_match(uuid) from public, anon;
revoke execute on function public.reject_match(uuid) from public, anon;
grant execute on function public.log_match(uuid, uuid, integer, integer, text, text, uuid) to authenticated;
grant execute on function public.confirm_match(uuid) to authenticated;
grant execute on function public.reject_match(uuid) to authenticated;

-- Automatic confirmation is a database responsibility. Running every fifteen
-- minutes keeps the review deadline durable without a client-side timer.
select cron.unschedule(jobid)
from cron.job
where jobname = 'localcheck-auto-confirm-due-matches';

select cron.schedule(
  'localcheck-auto-confirm-due-matches',
  '*/15 * * * *',
  $cron$select private.auto_confirm_due_matches()$cron$
);

commit;
