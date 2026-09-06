-- The previous migration's win/loss copy ("YOU WON" / "Beat X 11-0 · ELO
-- 1200 (+18)") was exclamatory, not the plain factual tone every other
-- notification in this table uses. Same personalization (real opponent
-- name, score, ELO delta, both participants), corrected to a single
-- deterministic title and plain-sentence body matching the rest of the
-- table (see e.g. "A player disputed the result. Update it within 7
-- days..."). No other behavior changes.

create or replace function private.notify_match_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_name text;
  v_user_id uuid;
  v_actor uuid := coalesce((select auth.uid()), new.last_submitted_by, new.created_by);
  v_type text;
  v_title text;
  v_body text;
  v_key text;
  v_side text;
  v_opponent_name text;
  v_elo_before integer;
  v_elo_after integer;
  v_delta integer;
  v_my_score integer;
  v_their_score integer;
begin
  if tg_op = 'INSERT' then
    if new.run_id is null and new.team_size = 1 and new.status = 'pending' then
      select coalesce(display_name, username, 'A player') into v_name from public.profiles where id = new.created_by;
      perform private.create_notification(new.opponent_id, 'match_review', new.created_by, null, null, new.id,
        'CONFIRM FINAL SCORE', v_name || ' logged ' || new.score_a::text || '–' || new.score_b::text || '.',
        jsonb_build_object('path', '/match/' || new.id::text), 'match-review:' || new.id::text);
    end if;
    return new;
  end if;
  if old.status is not distinct from new.status
     and not (new.status = 'pending' and coalesce(new.revision_number, 0) > coalesce(old.revision_number, 0)) then
    return new;
  end if;

  if new.status = 'confirmed' and new.run_id is null and new.team_size = 1 then
    for v_user_id, v_side in
      select mp.user_id, mp.side from public.match_participants mp where mp.match_id = new.id
    loop
      select coalesce(p.display_name, p.username, 'your opponent') into v_opponent_name
        from public.match_participants mp2
        join public.profiles p on p.id = mp2.user_id
        where mp2.match_id = new.id and mp2.user_id <> v_user_id;
      select mp.elo_before, mp.elo_after into v_elo_before, v_elo_after
        from public.match_participants mp where mp.match_id = new.id and mp.user_id = v_user_id;
      v_delta := coalesce(v_elo_after, 0) - coalesce(v_elo_before, 0);
      v_my_score := case when v_side = 'a' then new.score_a else new.score_b end;
      v_their_score := case when v_side = 'a' then new.score_b else new.score_a end;
      perform private.create_notification(
        v_user_id, 'match_confirmed', v_actor, null, new.run_id, new.id,
        'MATCH CONFIRMED',
        (case when v_side = new.winner_side then 'You beat ' else 'You lost to ' end) || v_opponent_name
          || ', ' || v_my_score::text || '–' || v_their_score::text
          || '. ELO now ' || coalesce(v_elo_after, 0)::text
          || ' (' || (case when v_delta >= 0 then '+' else '' end) || v_delta::text || ').',
        jsonb_build_object('path', '/match/' || new.id::text),
        'match-confirmed:' || new.id::text || ':' || v_user_id::text
      );
      perform private.send_invalidation('user:' || v_user_id::text, 'matches', 'UPDATE');
    end loop;
    return new;
  end if;

  if new.status = 'pending' and coalesce(new.revision_number, 0) > coalesce(old.revision_number, 0) then
    v_type := 'match_review'; v_title := 'GAME UPDATED';
    v_body := 'A participant submitted an updated result. Review it within 3 days.';
    v_key := 'match-revised:' || new.id::text || ':' || new.revision_number::text;
  elsif new.status = 'pending' and old.status = 'held' then
    v_type := 'match_review'; v_title := 'GAME UPDATED';
    v_body := 'A participant submitted an updated result. Review it within 3 days.';
    v_key := 'match-revised:' || new.id::text || ':' || new.revision_number::text;
  elsif new.status = 'held' then
    v_type := 'match_rejected'; v_title := 'SCORE ON HOLD';
    v_body := 'A player disputed the result. Update it within 7 days or the game is voided.';
    v_key := 'match-held:' || new.id::text || ':' || new.dispute_count::text;
  elsif new.status = 'voided' then
    v_type := 'match_rejected'; v_title := 'GAME VOIDED';
    v_body := case when new.dispute_count >= 3
      then 'The third dispute voided this result. No rating changed.'
      else 'The 7-day hold expired. This result will not affect profiles or ratings.'
    end;
    v_key := 'match-voided:' || new.id::text;
  else
    return new;
  end if;

  for v_user_id in
    select user_id from public.match_participants where match_id = new.id and user_id <> v_actor
  loop
    perform private.create_notification(
      v_user_id, v_type, v_actor, null, new.run_id, new.id,
      v_title, v_body,
      jsonb_build_object('path', '/match/' || new.id::text),
      v_key || ':' || v_user_id::text
    );
    perform private.send_invalidation('user:' || v_user_id::text, 'matches', 'UPDATE');
  end loop;
  return new;
end
$$;
