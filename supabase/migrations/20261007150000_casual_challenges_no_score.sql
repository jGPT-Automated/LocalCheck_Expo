-- Casual challenges are just plans (D27, revised by Jesse Oct 7): a time and
-- place to play with a friend. No score is logged and nothing counts: no ELO,
-- no record, no game counter, no head-to-head. Ranked challenges are
-- unchanged (score logged, reviewed, counts). Hidden scores (D30) are a
-- different thing: a ranked game that counts normally, shown as W / L.
--
--   * log_challenge_result refuses casual challenges.
--   * finish_casual_challenge: either player marks a casual plan as played.
--   * create_challenge closes casual plans whose day has passed before its
--     one-open-per-pair check, so an old plan never blocks a new challenge.
--   * "Challenge accepted" message for casual: "See you there." (no score).

begin;

set local lock_timeout = '5s';
set local statement_timeout = '60s';

create or replace function public.log_challenge_result(
  p_challenge_id uuid,
  p_my_score integer,
  p_their_score integer,
  p_court_id uuid default null,
  p_played_on date default null,
  p_client_request_id uuid default null
)
returns public.matches
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_row public.challenges;
  v_other uuid;
  v_court uuid;
  v_match public.matches;
begin
  if v_user_id is null then
    raise exception 'not authenticated' using errcode = '42501';
  end if;
  select * into v_row from public.challenges where id = p_challenge_id for update;
  if not found or v_user_id not in (v_row.challenger_id, v_row.opponent_id) then
    raise exception 'challenge not found' using errcode = 'P0002';
  end if;
  if not v_row.ranked then
    raise exception 'Casual challenges don''t have a score.' using errcode = 'LC110';
  end if;
  if v_row.status = 'completed' and v_row.match_id is not null then
    select * into v_match from public.matches where id = v_row.match_id;
    return v_match;
  end if;
  if v_row.status <> 'accepted' then
    raise exception 'Only an accepted challenge can be scored.' using errcode = 'LC108';
  end if;
  v_court := coalesce(p_court_id, v_row.court_id);
  if v_court is null then
    raise exception 'Pick the court you played at.' using errcode = 'LC109';
  end if;
  v_other := case when v_user_id = v_row.challenger_id then v_row.opponent_id else v_row.challenger_id end;

  v_match := public.log_match(
    v_court, v_other, p_my_score, p_their_score, null,
    coalesce(p_played_on, least(coalesce(v_row.play_on, current_date), current_date)),
    'public', p_client_request_id
  );

  update public.challenges
  set status = 'completed', match_id = v_match.id, court_id = v_court, updated_at = now()
  where id = v_row.id;
  return v_match;
end
$$;

create or replace function public.finish_casual_challenge(p_challenge_id uuid)
returns public.challenges
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_row public.challenges;
begin
  if v_user_id is null then
    raise exception 'not authenticated' using errcode = '42501';
  end if;
  select * into v_row from public.challenges where id = p_challenge_id for update;
  if not found or v_user_id not in (v_row.challenger_id, v_row.opponent_id) then
    raise exception 'challenge not found' using errcode = 'P0002';
  end if;
  if v_row.ranked then
    raise exception 'Log the score for a ranked challenge.' using errcode = 'LC111';
  end if;
  if v_row.status <> 'accepted' then
    raise exception 'This challenge is already closed.' using errcode = 'LC107';
  end if;
  update public.challenges
  set status = 'completed', updated_at = now()
  where id = v_row.id
  returning * into v_row;
  return v_row;
end
$$;

revoke execute on function public.finish_casual_challenge(uuid) from public, anon;
grant execute on function public.finish_casual_challenge(uuid) to authenticated;

-- Close casual plans whose day has passed, then run the original checks.
-- Patched in place with an anchor check, like 20261006120000.
do $patch$
declare
  v_def text;
  v_anchor text := $a$  if exists (
    select 1 from public.challenges c
    where least(c.challenger_id, c.opponent_id) = least(v_user_id, p_opponent_id)$a$;
  v_new text := $n$  update public.challenges c
  set status = 'completed', updated_at = now()
  where least(c.challenger_id, c.opponent_id) = least(v_user_id, p_opponent_id)
    and greatest(c.challenger_id, c.opponent_id) = greatest(v_user_id, p_opponent_id)
    and c.status = 'accepted'
    and not c.ranked
    and c.play_on is not null
    and c.play_on < current_date;

$n$;
begin
  v_def := pg_get_functiondef('public.create_challenge(uuid,uuid,date,boolean)'::regprocedure);
  if position('and not c.ranked' in v_def) > 0 then
    return;
  end if;
  if position(v_anchor in v_def) = 0 then
    raise exception 'create_challenge anchor not found; definition drifted';
  end if;
  execute replace(v_def, v_anchor, v_new || v_anchor);
end
$patch$;

-- Accepted message: casual plans have no score to log.
do $patch$
declare
  v_def text;
  v_anchor text := $a$then v_name || ' is in. Log the score here after you play.'$a$;
  v_new text := $n$then v_name || case when v_row.ranked
        then ' is in. Log the score here after you play.'
        else ' is in. See you there.' end$n$;
begin
  v_def := pg_get_functiondef('public.respond_to_challenge(uuid,boolean)'::regprocedure);
  if position('See you there' in v_def) > 0 then
    return;
  end if;
  if position(v_anchor in v_def) = 0 then
    raise exception 'respond_to_challenge anchor not found; definition drifted';
  end if;
  execute replace(v_def, v_anchor, v_new);
end
$patch$;

commit;
