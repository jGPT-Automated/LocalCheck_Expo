-- Ad-hoc team results use the same participant/review model as scheduled
-- games, without inventing a run. The explicit team_size also lets the
-- notification trigger distinguish 1v1 rows before participants are inserted.

alter table public.matches
  add column if not exists team_size smallint not null default 1
  check (team_size between 1 and 5);

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
  if new.run_id is not null or new.team_size > 1 then return new; end if;
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

create or replace function public.log_team_match(
  p_court_id uuid,
  p_team_a_ids uuid[],
  p_team_b_ids uuid[],
  p_score_a integer,
  p_score_b integer,
  p_played_on date default current_date,
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
  v_sport text;
  v_team_size integer := cardinality(p_team_a_ids);
  v_all_ids uuid[] := p_team_a_ids || p_team_b_ids;
  v_request_id uuid := coalesce(p_client_request_id, gen_random_uuid());
  v_played_on date := coalesce(p_played_on, current_date);
  v_player uuid;
  v_order smallint;
begin
  if v_user_id is null then raise exception 'not authenticated' using errcode = '42501'; end if;
  if v_team_size not between 2 and 5 or cardinality(p_team_b_ids) <> v_team_size then
    raise exception 'teams must be equal and contain 2 to 5 players' using errcode = '23514';
  end if;
  if not v_user_id = any(p_team_a_ids) then
    raise exception 'creator must be on team a' using errcode = '42501';
  end if;
  if (select count(distinct id) from unnest(v_all_ids) roster(id)) <> v_team_size * 2 then
    raise exception 'every player must appear exactly once' using errcode = '23514';
  end if;
  if (select count(*) from public.profiles where id = any(v_all_ids)) <> v_team_size * 2 then
    raise exception 'one or more player profiles were not found' using errcode = '23503';
  end if;
  if p_score_a is null or p_score_b is null or p_score_a < 0 or p_score_b < 0 or p_score_a = p_score_b then
    raise exception 'invalid final score' using errcode = '22023';
  end if;
  if p_visibility not in ('public', 'friends', 'private') then
    raise exception 'invalid visibility' using errcode = '22023';
  end if;
  if v_played_on > current_date or v_played_on < date '2000-01-01' then
    raise exception 'game date is outside the supported range' using errcode = '22023';
  end if;
  if exists (
    select 1 from unnest(v_all_ids) a(id), unnest(v_all_ids) b(id)
    where a.id < b.id and private.users_are_blocked(a.id, b.id)
  ) then
    raise exception 'interaction is blocked' using errcode = '42501';
  end if;

  select lower(c.sport_type::text) into v_sport
  from public.courts c where c.id = p_court_id and not c.is_archived;
  if v_sport is null or v_sport not in ('basketball', 'pickleball') then
    raise exception 'court sport is not supported for ranking' using errcode = '22023';
  end if;

  insert into public.matches (
    court_id, created_by, opponent_id, client_request_id, played_at,
    score_a, score_b, winner_side, visibility, status, sport,
    review_due_at, team_size
  ) values (
    p_court_id, v_user_id, p_team_b_ids[1], v_request_id,
    (v_played_on::timestamp + interval '12 hours') at time zone 'UTC',
    p_score_a, p_score_b, case when p_score_a > p_score_b then 'a' else 'b' end,
    p_visibility, 'pending', v_sport, now() + interval '3 days', v_team_size
  ) on conflict (created_by, client_request_id) do nothing
  returning * into v_match;

  if v_match.id is null then
    select * into v_match from public.matches
    where created_by = v_user_id and client_request_id = v_request_id;
    return v_match;
  end if;

  v_order := 0;
  foreach v_player in array p_team_a_ids loop
    v_order := v_order + 1;
    insert into public.match_participants (match_id, user_id, side, display_order)
    values (v_match.id, v_player, 'a', v_order);
  end loop;
  v_order := 0;
  foreach v_player in array p_team_b_ids loop
    v_order := v_order + 1;
    insert into public.match_participants (match_id, user_id, side, display_order)
    values (v_match.id, v_player, 'b', v_order);
  end loop;

  insert into public.match_participant_reviews (match_id, user_id, decision, decided_at)
  select v_match.id, participant.user_id,
    case when participant.user_id = v_user_id then 'approved' else 'pending' end,
    case when participant.user_id = v_user_id then now() else null end
  from public.match_participants participant where participant.match_id = v_match.id;

  for v_player in
    select user_id from public.match_participants
    where match_id = v_match.id and user_id <> v_user_id
  loop
    perform private.create_notification(
      v_player, 'match_review', v_user_id, null, null, v_match.id,
      'REVIEW TEAM SCORE',
      'A teammate submitted ' || p_score_a::text || '–' || p_score_b::text || '. Review within 3 days.',
      jsonb_build_object('path', '/match/' || v_match.id::text),
      'team-match-review:' || v_match.id::text || ':' || v_player::text
    );
  end loop;
  return v_match;
end
$$;

create or replace function private.apply_ad_hoc_team_elo(
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
  v_a_sport numeric;
  v_b_sport numeric;
  v_a_global numeric;
  v_b_global numeric;
  v_sport_delta integer;
  v_global_delta integer;
  v_player uuid;
begin
  select * into v_match from public.matches where id = p_match_id for update;
  if not found or v_match.status <> 'pending' or v_match.run_id is not null or v_match.team_size <= 1 then
    raise exception 'pending team result not found' using errcode = 'P0002';
  end if;
  if exists (
    select 1 from public.match_participant_reviews
    where match_id = v_match.id and decision = 'disputed'
  ) then raise exception 'team result has an active dispute' using errcode = '22023'; end if;

  perform 1 from public.profiles
  where id in (select user_id from public.match_participants where match_id = v_match.id)
  order by id for update;

  select
    avg(case when mp.side = 'a' then case when v_match.sport = 'basketball' then p.elo_basketball else p.elo_pickleball end end),
    avg(case when mp.side = 'b' then case when v_match.sport = 'basketball' then p.elo_basketball else p.elo_pickleball end end),
    avg(case when mp.side = 'a' then p.elo_rating end),
    avg(case when mp.side = 'b' then p.elo_rating end)
  into v_a_sport, v_b_sport, v_a_global, v_b_global
  from public.match_participants mp join public.profiles p on p.id = mp.user_id
  where mp.match_id = v_match.id;

  if v_match.winner_side = 'a' then
    v_sport_delta := greatest(1, round(32 * (1 - 1 / (1 + power(10, (v_b_sport - v_a_sport) / 400))))::integer);
    v_global_delta := greatest(1, round(32 * (1 - 1 / (1 + power(10, (v_b_global - v_a_global) / 400))))::integer);
  else
    v_sport_delta := greatest(1, round(32 * (1 / (1 + power(10, (v_b_sport - v_a_sport) / 400))))::integer);
    v_global_delta := greatest(1, round(32 * (1 / (1 + power(10, (v_b_global - v_a_global) / 400))))::integer);
  end if;

  update public.match_participants mp set
    elo_before = case when v_match.sport = 'basketball' then p.elo_basketball else p.elo_pickleball end,
    elo_after = least(5000, greatest(0,
      (case when v_match.sport = 'basketball' then p.elo_basketball else p.elo_pickleball end)
      + case when mp.side = v_match.winner_side then v_sport_delta else -v_sport_delta end
    ))
  from public.profiles p where mp.match_id = v_match.id and p.id = mp.user_id;

  update public.profiles p set
    elo_rating = least(5000, greatest(0, p.elo_rating + case when mp.side = v_match.winner_side then v_global_delta else -v_global_delta end)),
    wins = p.wins + case when mp.side = v_match.winner_side then 1 else 0 end,
    losses = p.losses + case when mp.side <> v_match.winner_side then 1 else 0 end,
    elo_basketball = case when v_match.sport = 'basketball' then least(5000, greatest(0, p.elo_basketball + case when mp.side = v_match.winner_side then v_sport_delta else -v_sport_delta end)) else p.elo_basketball end,
    elo_pickleball = case when v_match.sport = 'pickleball' then least(5000, greatest(0, p.elo_pickleball + case when mp.side = v_match.winner_side then v_sport_delta else -v_sport_delta end)) else p.elo_pickleball end,
    basketball_wins = p.basketball_wins + case when v_match.sport = 'basketball' and mp.side = v_match.winner_side then 1 else 0 end,
    basketball_losses = p.basketball_losses + case when v_match.sport = 'basketball' and mp.side <> v_match.winner_side then 1 else 0 end,
    pickleball_wins = p.pickleball_wins + case when v_match.sport = 'pickleball' and mp.side = v_match.winner_side then 1 else 0 end,
    pickleball_losses = p.pickleball_losses + case when v_match.sport = 'pickleball' and mp.side <> v_match.winner_side then 1 else 0 end,
    updated_at = now()
  from public.match_participants mp where mp.match_id = v_match.id and p.id = mp.user_id;

  update public.matches set
    status = 'confirmed', confirmed_at = now(), reviewed_at = now(),
    confirmation_method = p_confirmation_method, updated_at = now()
  where id = v_match.id returning * into v_match;

  insert into public.activity_events (
    event_type, actor_id, court_id, match_id, visibility, payload, occurred_at
  ) values (
    'match_result', v_match.created_by, v_match.court_id, v_match.id,
    v_match.visibility,
    jsonb_build_object('score_a', v_match.score_a, 'score_b', v_match.score_b,
      'winner_side', v_match.winner_side, 'sport', v_match.sport,
      'team_game', true, 'team_size', v_match.team_size),
    v_match.confirmed_at
  );

  for v_player in select user_id from public.match_participants where match_id = v_match.id loop
    perform private.create_notification(
      v_player, 'match_confirmed', v_match.created_by, null, null, v_match.id,
      'TEAM GAME CONFIRMED', 'The result is official and ratings are updated.',
      jsonb_build_object('path', '/match/' || v_match.id::text),
      'team-match-confirmed:' || v_match.id::text || ':' || v_player::text
    );
    perform private.send_invalidation('user:' || v_player::text, 'matches', 'UPDATE');
  end loop;
  return v_match;
end
$$;

revoke execute on function private.apply_ad_hoc_team_elo(uuid, text)
  from public, anon, authenticated;

create or replace function public.review_team_match(
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
begin
  if v_user_id is null then raise exception 'not authenticated' using errcode = '42501'; end if;
  if p_decision not in ('pending', 'approved', 'disputed') then
    raise exception 'invalid review decision' using errcode = '22023';
  end if;
  select * into v_match from public.matches where id = p_match_id for update;
  if not found or v_match.run_id is not null or v_match.team_size <= 1 or v_match.status <> 'pending' then
    raise exception 'pending team result not found' using errcode = 'P0002';
  end if;
  if v_match.review_due_at <= now() then raise exception 'review window has ended' using errcode = '22023'; end if;
  if not exists (
    select 1 from public.match_participant_reviews
    where match_id = v_match.id and user_id = v_user_id
  ) then raise exception 'only participants can review this result' using errcode = '42501'; end if;

  update public.match_participant_reviews set
    decision = p_decision,
    decided_at = case when p_decision = 'pending' then null else now() end,
    updated_at = now()
  where match_id = v_match.id and user_id = v_user_id;

  if not exists (
    select 1 from public.match_participant_reviews
    where match_id = v_match.id and decision <> 'approved'
  ) then return private.apply_ad_hoc_team_elo(v_match.id, 'manual'); end if;
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
  v_match public.matches;
  v_count integer := 0;
  v_user_id uuid;
begin
  for v_match in
    select * from public.matches where status = 'pending' and review_due_at <= now()
    order by review_due_at for update skip locked
  loop
    if exists (
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
          'match-dropped:' || v_match.id::text || ':' || v_user_id::text
        );
      end loop;
    elsif v_match.run_id is not null then
      perform private.apply_scheduled_match_elo(v_match.id, 'automatic');
    elsif v_match.team_size > 1 then
      perform private.apply_ad_hoc_team_elo(v_match.id, 'automatic');
    else
      perform private.apply_match_elo(v_match.id, 'automatic');
    end if;
    v_count := v_count + 1;
  end loop;
  return v_count;
end
$$;

revoke execute on function public.log_team_match(uuid, uuid[], uuid[], integer, integer, date, text, uuid)
  from public, anon;
revoke execute on function public.review_team_match(uuid, text) from public, anon;
grant execute on function public.log_team_match(uuid, uuid[], uuid[], integer, integer, date, text, uuid)
  to authenticated;
grant execute on function public.review_team_match(uuid, text) to authenticated;
