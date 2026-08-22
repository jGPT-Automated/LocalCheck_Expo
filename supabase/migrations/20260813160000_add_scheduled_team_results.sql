-- Additive scheduled-game result contract.
--
-- A run is one scheduled game and may create one official result. The creator
-- assigns every going roster member to Team A or Team B when submitting the
-- score. Existing spontaneous 1v1 RPCs remain unchanged.

alter table public.matches
  add column if not exists run_id uuid references public.runs(id) on delete set null;

create unique index if not exists matches_one_result_per_run_idx
  on public.matches (run_id)
  where run_id is not null;

create table if not exists public.match_participant_reviews (
  match_id uuid not null references public.matches(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  decision text not null default 'pending'
    check (decision in ('pending', 'approved', 'disputed')),
  decided_at timestamptz,
  updated_at timestamptz not null default now(),
  primary key (match_id, user_id)
);

create index if not exists match_participant_reviews_user_idx
  on public.match_participant_reviews (user_id, updated_at desc);

alter table public.match_participant_reviews enable row level security;

-- Match rows are otherwise visible only to the 1v1 creator/opponent until
-- confirmation. This security-definer helper avoids a recursive RLS lookup
-- between matches and match_participants while admitting every team member.
create or replace function private.is_match_participant(
  p_match_id uuid,
  p_user_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select p_user_id is not null and exists (
    select 1
    from public.match_participants participant
    where participant.match_id = p_match_id
      and participant.user_id = p_user_id
  );
$$;

revoke execute on function private.is_match_participant(uuid, uuid) from public, anon;
grant usage on schema private to authenticated;
grant execute on function private.is_match_participant(uuid, uuid) to authenticated;

drop policy if exists matches_select_visible on public.matches;
create policy matches_select_visible
  on public.matches for select to authenticated
  using (
    created_by = (select auth.uid())
    or opponent_id = (select auth.uid())
    or private.is_match_participant(matches.id, (select auth.uid()))
    or (status = 'confirmed' and visibility = 'public')
    or (
      status = 'confirmed'
      and visibility = 'friends'
      and exists (
        select 1
        from public.friendships f
        where f.status = 'accepted'
          and (
            (f.requester_id = (select auth.uid()) and f.addressee_id = matches.created_by)
            or
            (f.addressee_id = (select auth.uid()) and f.requester_id = matches.created_by)
          )
      )
    )
  );

drop policy if exists match_participant_reviews_select_participant
  on public.match_participant_reviews;
create policy match_participant_reviews_select_participant
  on public.match_participant_reviews for select to authenticated
  using (
    exists (
      select 1 from public.match_participants viewer
      where viewer.match_id = match_participant_reviews.match_id
        and viewer.user_id = (select auth.uid())
    )
  );

grant select on public.match_participant_reviews to authenticated;

-- The existing 1v1 trigger targets one opponent. Scheduled games notify the
-- full roster inside their RPCs, so skip those rows here to avoid duplicates.
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
  if new.run_id is not null then return new; end if;

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

revoke execute on function private.notify_match_change()
  from public, anon, authenticated;

-- Keep the existing invitation delivery pipeline, but align its user-facing
-- language with the scheduled-game model and generated game identity.
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
      'GAME INVITATION', v_name || ' invited you to ' || coalesce(v_title, 'a scheduled game') || '.',
      jsonb_build_object('path', '/run/' || new.run_id::text),
      'run-invite:' || new.id::text
    );
  end if;
  return new;
end
$$;

revoke execute on function private.notify_run_invitation()
  from public, anon, authenticated;

-- A review decision is shared state. Invalidate every participant's existing
-- private user topic so open score-review screens and match lists stay aligned.
create or replace function private.broadcast_match_review_invalidation()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_row public.match_participant_reviews;
  v_user_id uuid;
begin
  if tg_op = 'DELETE' then v_row := old; else v_row := new; end if;
  for v_user_id in
    select user_id from public.match_participants where match_id = v_row.match_id
  loop
    perform private.send_invalidation(
      'user:' || v_user_id::text, 'match_participant_reviews', tg_op
    );
  end loop;
  return v_row;
end
$$;

revoke execute on function private.broadcast_match_review_invalidation()
  from public, anon, authenticated;
drop trigger if exists broadcast_match_review_invalidation on public.match_participant_reviews;
create trigger broadcast_match_review_invalidation
after insert or update or delete on public.match_participant_reviews
for each row execute function private.broadcast_match_review_invalidation();

create or replace function private.apply_scheduled_match_elo(
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
  v_player_ids uuid[];
  v_team_a_sport numeric;
  v_team_b_sport numeric;
  v_team_a_global numeric;
  v_team_b_global numeric;
  v_expected_sport numeric;
  v_expected_global numeric;
  v_delta_sport integer;
  v_delta_global integer;
  v_actor uuid;
  v_user_id uuid;
begin
  if p_confirmation_method not in ('manual', 'automatic') then
    raise exception 'invalid confirmation method' using errcode = '22023';
  end if;

  select * into v_match from public.matches where id = p_match_id for update;
  if not found then raise exception 'match not found' using errcode = 'P0002'; end if;
  if v_match.status = 'confirmed' then return v_match; end if;
  if v_match.status <> 'pending' or v_match.run_id is null then
    raise exception 'scheduled match is not pending' using errcode = '22023';
  end if;
  if exists (
    select 1 from public.match_participant_reviews
    where match_id = v_match.id and decision = 'disputed'
  ) then
    raise exception 'scheduled match has an active dispute' using errcode = '22023';
  end if;
  if (select count(*) from public.match_participants where match_id = v_match.id and side = 'a')
     <> (select count(*) from public.match_participants where match_id = v_match.id and side = 'b') then
    raise exception 'scheduled match teams must be equal' using errcode = '23514';
  end if;

  select array_agg(user_id order by user_id) into v_player_ids
  from public.match_participants where match_id = v_match.id;
  perform 1 from public.profiles where id = any(v_player_ids) order by id for update;

  select
    avg(case when mp.side = 'a' then case when v_match.sport = 'basketball' then p.elo_basketball else p.elo_pickleball end end),
    avg(case when mp.side = 'b' then case when v_match.sport = 'basketball' then p.elo_basketball else p.elo_pickleball end end),
    avg(case when mp.side = 'a' then p.elo_rating end),
    avg(case when mp.side = 'b' then p.elo_rating end)
  into v_team_a_sport, v_team_b_sport, v_team_a_global, v_team_b_global
  from public.match_participants mp
  join public.profiles p on p.id = mp.user_id
  where mp.match_id = v_match.id;

  v_expected_sport := 1.0 / (1.0 + power(10.0, (v_team_b_sport - v_team_a_sport) / 400.0));
  v_expected_global := 1.0 / (1.0 + power(10.0, (v_team_b_global - v_team_a_global) / 400.0));
  if v_match.winner_side = 'a' then
    v_delta_sport := greatest(1, round(32 * (1.0 - v_expected_sport))::integer);
    v_delta_global := greatest(1, round(32 * (1.0 - v_expected_global))::integer);
  else
    v_delta_sport := greatest(1, round(32 * v_expected_sport)::integer);
    v_delta_global := greatest(1, round(32 * v_expected_global)::integer);
  end if;

  update public.match_participants mp
  set elo_before = case when v_match.sport = 'basketball' then p.elo_basketball else p.elo_pickleball end,
      elo_after = least(5000, greatest(0,
        (case when v_match.sport = 'basketball' then p.elo_basketball else p.elo_pickleball end)
        + case when mp.side = v_match.winner_side then v_delta_sport else -v_delta_sport end
      ))
  from public.profiles p
  where mp.match_id = v_match.id and p.id = mp.user_id;

  update public.profiles p
  set elo_rating = least(5000, greatest(0,
        p.elo_rating + case when mp.side = v_match.winner_side then v_delta_global else -v_delta_global end
      )),
      wins = p.wins + case when mp.side = v_match.winner_side then 1 else 0 end,
      losses = p.losses + case when mp.side <> v_match.winner_side then 1 else 0 end,
      elo_basketball = case when v_match.sport = 'basketball'
        then least(5000, greatest(0, p.elo_basketball + case when mp.side = v_match.winner_side then v_delta_sport else -v_delta_sport end))
        else p.elo_basketball end,
      elo_pickleball = case when v_match.sport = 'pickleball'
        then least(5000, greatest(0, p.elo_pickleball + case when mp.side = v_match.winner_side then v_delta_sport else -v_delta_sport end))
        else p.elo_pickleball end,
      basketball_wins = p.basketball_wins + case when v_match.sport = 'basketball' and mp.side = v_match.winner_side then 1 else 0 end,
      basketball_losses = p.basketball_losses + case when v_match.sport = 'basketball' and mp.side <> v_match.winner_side then 1 else 0 end,
      pickleball_wins = p.pickleball_wins + case when v_match.sport = 'pickleball' and mp.side = v_match.winner_side then 1 else 0 end,
      pickleball_losses = p.pickleball_losses + case when v_match.sport = 'pickleball' and mp.side <> v_match.winner_side then 1 else 0 end,
      updated_at = now()
  from public.match_participants mp
  where mp.match_id = v_match.id and p.id = mp.user_id;

  update public.matches
  set status = 'confirmed', confirmed_at = now(), reviewed_at = now(),
      confirmation_method = p_confirmation_method, updated_at = now()
  where id = v_match.id returning * into v_match;

  insert into public.activity_events (
    event_type, actor_id, court_id, run_id, match_id, visibility, payload, occurred_at
  ) values (
    'match_result', v_match.created_by, v_match.court_id, v_match.run_id, v_match.id,
    v_match.visibility,
    jsonb_build_object(
      'score_a', v_match.score_a, 'score_b', v_match.score_b,
      'winner_side', v_match.winner_side, 'sport', v_match.sport,
      'scheduled_game', true
    ),
    v_match.confirmed_at
  );

  for v_user_id in
    select user_id from public.match_participants
    where match_id = v_match.id
  loop
    perform private.create_notification(
      v_user_id, 'match_confirmed', v_match.created_by, null, v_match.run_id, v_match.id,
      'GAME CONFIRMED', 'The scheduled result is official and ratings are updated.',
      jsonb_build_object('path', '/match/' || v_match.id::text),
      'run-match-confirmed:' || v_match.id::text || ':' || v_user_id::text
    );
  end loop;
  return v_match;
end
$$;

revoke execute on function private.apply_scheduled_match_elo(uuid, text)
  from public, anon, authenticated;

create or replace function public.log_run_match(
  p_run_id uuid,
  p_team_a_ids uuid[],
  p_team_b_ids uuid[],
  p_score_a integer,
  p_score_b integer
)
returns public.matches
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_run public.runs;
  v_match public.matches;
  v_sport text;
  v_team_size integer;
  v_roster_count integer;
  v_distinct_count integer;
  v_opponent_id uuid;
  v_participant uuid;
  v_order smallint;
begin
  if v_user_id is null then raise exception 'not authenticated' using errcode = '42501'; end if;
  select * into v_run from public.runs where id = p_run_id for update;
  if not found then raise exception 'scheduled game not found' using errcode = 'P0002'; end if;
  if v_run.organizer_id <> v_user_id then raise exception 'only the creator can submit the result' using errcode = '42501'; end if;
  if v_run.status <> 'scheduled' or v_run.start_time > now() then raise exception 'scheduled game has not started' using errcode = '22023'; end if;
  if p_score_a is null or p_score_b is null or p_score_a < 0 or p_score_b < 0 or p_score_a = p_score_b then
    raise exception 'invalid final score' using errcode = '22023';
  end if;

  v_team_size := v_run.max_players / 2;
  if v_team_size not between 2 and 5 or cardinality(p_team_a_ids) <> v_team_size or cardinality(p_team_b_ids) <> v_team_size then
    raise exception 'teams do not match the scheduled format' using errcode = '23514';
  end if;
  select count(*) into v_roster_count from public.run_participants
  where run_id = v_run.id and status = 'going';
  select count(distinct player_id) into v_distinct_count
  from unnest(p_team_a_ids || p_team_b_ids) as roster(player_id);
  if v_roster_count <> v_run.max_players or v_distinct_count <> v_run.max_players then
    raise exception 'every rostered player must appear on exactly one team' using errcode = '23514';
  end if;
  if exists (
    select 1 from unnest(p_team_a_ids || p_team_b_ids) as submitted(player_id)
    where not exists (
      select 1 from public.run_participants rp
      where rp.run_id = v_run.id and rp.user_id = submitted.player_id and rp.status = 'going'
    )
  ) then
    raise exception 'submitted teams do not match the roster' using errcode = '23514';
  end if;

  select lower(c.sport_type), p_team_b_ids[1] into v_sport, v_opponent_id
  from public.courts c where c.id = v_run.court_id;
  if v_sport not in ('basketball', 'pickleball') then
    raise exception 'ratings are not available for this sport' using errcode = '22023';
  end if;

  insert into public.matches (
    court_id, created_by, opponent_id, run_id, played_at,
    score_a, score_b, winner_side, visibility, status, sport, review_due_at
  ) values (
    v_run.court_id, v_user_id, v_opponent_id, v_run.id, v_run.start_time,
    p_score_a, p_score_b, case when p_score_a > p_score_b then 'a' else 'b' end,
    'public', 'pending', v_sport, now() + interval '3 days'
  ) returning * into v_match;

  v_order := 0;
  foreach v_participant in array p_team_a_ids loop
    v_order := v_order + 1;
    insert into public.match_participants (match_id, user_id, side, display_order)
    values (v_match.id, v_participant, 'a', v_order);
  end loop;
  v_order := 0;
  foreach v_participant in array p_team_b_ids loop
    v_order := v_order + 1;
    insert into public.match_participants (match_id, user_id, side, display_order)
    values (v_match.id, v_participant, 'b', v_order);
  end loop;

  insert into public.match_participant_reviews (match_id, user_id, decision, decided_at)
  select v_match.id, mp.user_id,
    case when mp.user_id = v_user_id then 'approved' else 'pending' end,
    case when mp.user_id = v_user_id then now() else null end
  from public.match_participants mp where mp.match_id = v_match.id;

  update public.runs set status = 'completed', updated_at = now() where id = v_run.id;

  for v_participant in
    select user_id from public.match_participants
    where match_id = v_match.id and user_id <> v_user_id
  loop
    perform private.create_notification(
      v_participant, 'match_review', v_user_id, null, v_run.id, v_match.id,
      'REVIEW FINAL SCORE',
      'The creator submitted ' || p_score_a::text || '–' || p_score_b::text || '. Dispute within 3 days.',
      jsonb_build_object('path', '/match/' || v_match.id::text),
      'run-match-review:' || v_match.id::text || ':' || v_participant::text
    );
  end loop;
  return v_match;
end
$$;

create or replace function public.review_run_match(
  p_match_id uuid,
  p_decision text
)
returns public.matches
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_match public.matches;
  v_previous_decision text;
  v_participant uuid;
begin
  if v_user_id is null then raise exception 'not authenticated' using errcode = '42501'; end if;
  if p_decision not in ('pending', 'approved', 'disputed') then raise exception 'invalid review decision' using errcode = '22023'; end if;
  select * into v_match from public.matches where id = p_match_id for update;
  if not found or v_match.run_id is null or v_match.status <> 'pending' then
    raise exception 'pending scheduled result not found' using errcode = 'P0002';
  end if;
  if v_match.review_due_at <= now() then raise exception 'review window has ended' using errcode = '22023'; end if;

  select decision into v_previous_decision
  from public.match_participant_reviews
  where match_id = v_match.id and user_id = v_user_id
  for update;
  if not found then raise exception 'only participants can review this result' using errcode = '42501'; end if;

  update public.match_participant_reviews
  set decision = p_decision,
      decided_at = case when p_decision = 'pending' then null else now() end,
      updated_at = now()
  where match_id = v_match.id and user_id = v_user_id;

  if v_previous_decision is distinct from p_decision and p_decision = 'disputed' then
    for v_participant in
      select user_id from public.match_participants
      where match_id = v_match.id and user_id <> v_user_id
    loop
      perform private.create_notification(
        v_participant, 'match_review', v_user_id, null, v_match.run_id, v_match.id,
        'GAME DISPUTED',
        'A player disputed the submitted score. The result drops at the deadline unless they withdraw it.',
        jsonb_build_object('path', '/match/' || v_match.id::text),
        'run-match-disputed:' || v_match.id::text || ':' || v_user_id::text || ':' || v_participant::text
      );
    end loop;
  elsif v_previous_decision = 'disputed' and p_decision <> 'disputed' then
    for v_participant in
      select user_id from public.match_participants
      where match_id = v_match.id and user_id <> v_user_id
    loop
      perform private.create_notification(
        v_participant, 'match_review', v_user_id, null, v_match.run_id, v_match.id,
        'DISPUTE WITHDRAWN',
        'The active dispute was withdrawn. The score remains open for review.',
        jsonb_build_object('path', '/match/' || v_match.id::text),
        'run-match-dispute-withdrawn:' || v_match.id::text || ':' || v_user_id::text || ':' || v_participant::text
      );
    end loop;
  end if;

  if not exists (
    select 1 from public.match_participant_reviews
    where match_id = v_match.id and decision <> 'approved'
  ) then
    return private.apply_scheduled_match_elo(v_match.id, 'manual');
  end if;
  return v_match;
end
$$;

-- Preserve the existing cron entry point and its spontaneous 1v1 behavior,
-- while resolving scheduled results by their shared three-day review state.
create or replace function private.auto_confirm_due_matches()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_match public.matches;
  v_count integer := 0;
  v_user_id uuid;
begin
  for v_match in
    select * from public.matches
    where status = 'pending' and review_due_at <= now()
    order by review_due_at for update skip locked
  loop
    if v_match.run_id is null then
      perform private.apply_match_elo(v_match.id, 'automatic');
    elsif exists (
      select 1 from public.match_participant_reviews
      where match_id = v_match.id and decision = 'disputed'
    ) then
      update public.matches set status = 'rejected', reviewed_at = now(), updated_at = now()
      where id = v_match.id;
      for v_user_id in select user_id from public.match_participants where match_id = v_match.id loop
        perform private.create_notification(
          v_user_id, 'match_rejected', v_match.created_by, null, v_match.run_id, v_match.id,
          'GAME DROPPED', 'An active dispute remained at the review deadline. No rating changed.',
          jsonb_build_object('path', '/match/' || v_match.id::text),
          'run-match-dropped:' || v_match.id::text || ':' || v_user_id::text
        );
      end loop;
    else
      perform private.apply_scheduled_match_elo(v_match.id, 'automatic');
    end if;
    v_count := v_count + 1;
  end loop;
  return v_count;
end
$$;

revoke execute on function public.log_run_match(uuid, uuid[], uuid[], integer, integer) from public, anon;
revoke execute on function public.review_run_match(uuid, text) from public, anon;
grant execute on function public.log_run_match(uuid, uuid[], uuid[], integer, integer) to authenticated;
grant execute on function public.review_run_match(uuid, text) to authenticated;
