-- Let players log the actual game date without inventing a meaningless time.
-- Noon UTC keeps the selected calendar date stable across US time zones.

drop function if exists public.log_match(uuid, uuid, integer, integer, text, text, uuid);

create or replace function public.log_match(
  p_court_id uuid,
  p_opponent_id uuid,
  p_my_score integer,
  p_opponent_score integer,
  p_notes text default null,
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
  v_winner_side text;
  v_sport text;
  v_notes text := nullif(btrim(p_notes), '');
  v_played_on date := coalesce(p_played_on, current_date);
  v_played_at timestamptz;
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
  if v_played_on > current_date or v_played_on < date '2000-01-01' then
    raise exception 'game date is outside the supported range' using errcode = '22023';
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
  v_played_at := (v_played_on::timestamp + interval '12 hours') at time zone 'UTC';

  insert into public.matches (
    court_id, created_by, opponent_id, client_request_id, played_at,
    score_a, score_b, winner_side, notes, visibility, sport, review_due_at
  ) values (
    p_court_id, v_user_id, p_opponent_id, v_request_id, v_played_at,
    p_my_score, p_opponent_score, v_winner_side, v_notes, p_visibility,
    v_sport, now() + interval '3 days'
  ) on conflict (created_by, client_request_id) do nothing
  returning * into v_match;

  if v_match.id is null then
    select * into v_match from public.matches
    where created_by = v_user_id and client_request_id = v_request_id;
    if v_match.court_id is distinct from p_court_id
       or v_match.opponent_id is distinct from p_opponent_id
       or v_match.score_a is distinct from p_my_score
       or v_match.score_b is distinct from p_opponent_score
       or v_match.played_at is distinct from v_played_at
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

revoke execute on function public.log_match(uuid, uuid, integer, integer, text, date, text, uuid)
  from public, anon;
grant execute on function public.log_match(uuid, uuid, integer, integer, text, date, text, uuid)
  to authenticated;
