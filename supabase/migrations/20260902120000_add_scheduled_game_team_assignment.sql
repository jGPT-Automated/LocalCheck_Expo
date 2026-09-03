-- Scheduled games choose their team behavior when the creator schedules them.
-- "elo_balance" keeps the roster neutral until it fills, then assigns two
-- deterministic, ELO-balanced sides. "choose_teams" lets every player claim a
-- side while enforcing equal per-side capacity in the database.

alter table public.runs
  add column if not exists team_assignment_mode text not null default 'elo_balance'
  check (team_assignment_mode in ('elo_balance', 'choose_teams'));

alter table public.run_participants
  add column if not exists team_side text
  check (team_side is null or team_side in ('a', 'b'));

comment on column public.runs.team_assignment_mode is
  'elo_balance assigns teams after the roster fills; choose_teams lets players claim a side.';
comment on column public.run_participants.team_side is
  'Authoritative scheduled-game side. Null while an elo_balance roster is not full.';

create or replace function private.assign_balanced_run_teams(p_run_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_run public.runs;
  v_roster_count integer;
begin
  select * into v_run
  from public.runs
  where id = p_run_id
  for update;

  if not found or v_run.team_assignment_mode <> 'elo_balance' then return; end if;

  select count(*) into v_roster_count
  from public.run_participants
  where run_id = p_run_id and status = 'going';

  if v_roster_count <> v_run.max_players then
    update public.run_participants
    set team_side = null, updated_at = now()
    where run_id = p_run_id and team_side is not null;
    return;
  end if;

  -- Seeded snake order: 1,4,5,8,9 go to A; 2,3,6,7,10 go to B.
  -- Ranking by the selected sport ELO keeps the two team totals close while
  -- remaining deterministic when ratings tie.
  with ranked as (
    select
      rp.user_id,
      row_number() over (
        order by
          case lower(c.sport_type)
            when 'basketball' then p.elo_basketball
            when 'pickleball' then p.elo_pickleball
            else p.elo_rating
          end desc,
          rp.joined_at,
          rp.user_id
      ) as rank
    from public.run_participants rp
    join public.profiles p on p.id = rp.user_id
    join public.courts c on c.id = v_run.court_id
    where rp.run_id = p_run_id and rp.status = 'going'
  )
  update public.run_participants rp
  set
    team_side = case when ranked.rank % 4 in (0, 1) then 'a' else 'b' end,
    updated_at = now()
  from ranked
  where rp.run_id = p_run_id and rp.user_id = ranked.user_id;
end
$$;

revoke execute on function private.assign_balanced_run_teams(uuid)
  from public, anon, authenticated;

create or replace function public.create_scheduled_game(
  p_court_id uuid,
  p_title text,
  p_start_time timestamptz,
  p_max_players integer,
  p_team_assignment_mode text,
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
  if v_user_id is null then raise exception 'not authenticated' using errcode = '42501'; end if;
  if p_team_assignment_mode not in ('elo_balance', 'choose_teams') then
    raise exception 'invalid team assignment mode' using errcode = '22023';
  end if;
  if p_max_players not between 4 and 10 or p_max_players % 2 <> 0 then
    raise exception 'scheduled games require two equal teams of 2 to 5' using errcode = '23514';
  end if;
  if not exists (
    select 1 from public.courts c where c.id = p_court_id and not c.is_archived
  ) then raise exception 'court not found' using errcode = '23503'; end if;
  if p_start_time <= now() then raise exception 'run must start in the future' using errcode = '22023'; end if;

  insert into public.runs (
    court_id, organizer_id, client_request_id, title, note, start_time,
    max_players, is_open_invite, team_assignment_mode
  ) values (
    p_court_id, v_user_id, v_request_id, btrim(p_title), v_note, p_start_time,
    p_max_players, p_is_open_invite, p_team_assignment_mode
  )
  on conflict (organizer_id, client_request_id) do nothing
  returning * into v_run;

  if v_run.id is null then
    select * into v_run from public.runs
    where organizer_id = v_user_id and client_request_id = v_request_id;
    if v_run.court_id is distinct from p_court_id
       or v_run.title is distinct from btrim(p_title)
       or v_run.note is distinct from v_note
       or v_run.start_time is distinct from p_start_time
       or v_run.max_players is distinct from p_max_players
       or v_run.is_open_invite is distinct from p_is_open_invite
       or v_run.team_assignment_mode is distinct from p_team_assignment_mode then
      raise exception 'client request id reused with different game data' using errcode = '23505';
    end if;
    return v_run;
  end if;

  insert into public.run_participants (run_id, user_id, status, team_side)
  values (
    v_run.id,
    v_user_id,
    'going',
    case when p_team_assignment_mode = 'choose_teams' then 'a' else null end
  );

  return v_run;
end
$$;

revoke execute on function public.create_scheduled_game(
  uuid, text, timestamptz, integer, text, text, boolean, uuid
) from public, anon, authenticated;
grant execute on function public.create_scheduled_game(
  uuid, text, timestamptz, integer, text, text, boolean, uuid
) to authenticated;

create or replace function public.join_scheduled_game(
  p_run_id uuid,
  p_team_side text default null
)
returns public.run_participants
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_run public.runs;
  v_going_count integer;
  v_side_count integer;
  v_row public.run_participants;
begin
  if v_user_id is null then raise exception 'not authenticated' using errcode = '42501'; end if;

  select * into v_run from public.runs where id = p_run_id for update;
  if not found then raise exception 'run not found' using errcode = 'P0002'; end if;
  if v_run.status <> 'scheduled' or v_run.start_time <= now() then
    raise exception 'run is not joinable' using errcode = '22023';
  end if;
  if not v_run.is_open_invite and v_run.organizer_id <> v_user_id
     and not exists (
       select 1 from public.run_invitations
       where run_id = p_run_id and invitee_id = v_user_id and status = 'pending'
     ) then raise exception 'run is invite-only' using errcode = '42501'; end if;

  select count(*) into v_going_count from public.run_participants
  where run_id = p_run_id and status = 'going';
  if not exists (
    select 1 from public.run_participants
    where run_id = p_run_id and user_id = v_user_id and status = 'going'
  ) and v_going_count >= v_run.max_players then
    raise exception 'run is full' using errcode = 'P0001';
  end if;

  if v_run.team_assignment_mode = 'choose_teams' then
    if p_team_side not in ('a', 'b') then
      raise exception 'choose a team before joining' using errcode = '22023';
    end if;
    select count(*) into v_side_count from public.run_participants
    where run_id = p_run_id and status = 'going' and team_side = p_team_side
      and user_id <> v_user_id;
    if v_side_count >= v_run.max_players / 2 then
      raise exception 'team is full' using errcode = 'P0001';
    end if;
  else
    p_team_side := null;
  end if;

  insert into public.run_participants (run_id, user_id, status, joined_at, team_side)
  values (p_run_id, v_user_id, 'going', now(), p_team_side)
  on conflict (run_id, user_id) do update
    set status = 'going', joined_at = now(), updated_at = now(), team_side = excluded.team_side
  returning * into v_row;

  update public.run_invitations set status = 'accepted', updated_at = now()
  where run_id = p_run_id and invitee_id = v_user_id and status = 'pending';

  if v_run.team_assignment_mode = 'elo_balance' then
    perform private.assign_balanced_run_teams(p_run_id);
    select * into v_row from public.run_participants
    where run_id = p_run_id and user_id = v_user_id;
  end if;

  return v_row;
end
$$;

revoke execute on function public.join_scheduled_game(uuid, text)
  from public, anon, authenticated;
grant execute on function public.join_scheduled_game(uuid, text) to authenticated;

create or replace function private.reset_incomplete_balanced_run()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_run_id uuid;
begin
  if tg_op = 'DELETE' then
    v_run_id := old.run_id;
  else
    v_run_id := new.run_id;
  end if;

  if exists (
    select 1 from public.runs
    where id = v_run_id and team_assignment_mode = 'elo_balance'
  ) then perform private.assign_balanced_run_teams(v_run_id); end if;
  return null;
end
$$;

revoke execute on function private.reset_incomplete_balanced_run()
  from public, anon, authenticated;

drop trigger if exists reset_incomplete_balanced_run on public.run_participants;
create trigger reset_incomplete_balanced_run
after delete or update of status on public.run_participants
for each row execute function private.reset_incomplete_balanced_run();

-- The result teams must match the sides chosen or balanced before tipoff.
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
    select 1 from public.run_participants rp
    where rp.run_id = v_run.id and rp.status = 'going'
      and (
        rp.team_side is null
        or (rp.team_side = 'a' and not (rp.user_id = any(p_team_a_ids)))
        or (rp.team_side = 'b' and not (rp.user_id = any(p_team_b_ids)))
      )
  ) then raise exception 'submitted teams do not match the scheduled teams' using errcode = '23514'; end if;

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
    case when v_run.is_open_invite then 'public' else 'private' end,
    'pending', v_sport, now() + interval '3 days'
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

revoke execute on function public.log_run_match(uuid, uuid[], uuid[], integer, integer)
  from public, anon, authenticated;
grant execute on function public.log_run_match(uuid, uuid[], uuid[], integer, integer)
  to authenticated;

-- Recovery: drop the two new functions, trigger, columns, and constraints only
-- after retiring clients that call create_scheduled_game/join_scheduled_game.
