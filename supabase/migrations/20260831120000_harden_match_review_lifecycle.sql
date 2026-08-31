-- Harden the score-review RPC contract after the canonical lifecycle migration.
-- This remains source-only until applied in ledger order.

begin;

alter table public.matches
  add column if not exists dispute_note text;

-- A single participant approval must not finalize a team result. Team review
-- continues to require every participant to approve the current proposal.
create or replace function public.respond_to_match(
  p_match_id uuid,
  p_decision text,
  p_explanation text,
  p_court_id uuid,
  p_score_a integer,
  p_score_b integer,
  p_played_on date
)
returns public.matches
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_match public.matches;
  v_viewer_side text;
  v_submitter_side text;
  v_next_dispute smallint;
  v_sport text;
  v_explanation text := nullif(btrim(p_explanation), '');
  v_has_correction boolean := p_court_id is not null or p_score_a is not null
    or p_score_b is not null or p_played_on is not null;
begin
  if v_user_id is null then raise exception 'not authenticated' using errcode = '42501'; end if;
  if p_decision not in ('approve', 'dispute') then raise exception 'invalid match response' using errcode = '22023'; end if;
  if v_explanation is not null and char_length(v_explanation) > 280 then
    raise exception 'dispute explanation must be 280 characters or fewer' using errcode = '22023';
  end if;
  select * into v_match from public.matches where id = p_match_id for update;
  if not found then raise exception 'match not found' using errcode = 'P0002'; end if;
  if v_match.status <> 'pending' then raise exception 'match is not open for review' using errcode = '22023'; end if;
  if v_match.review_due_at <= now() then raise exception 'review window has ended' using errcode = '22023'; end if;
  select side into v_viewer_side from public.match_participants where match_id = v_match.id and user_id = v_user_id;
  if v_viewer_side is null then raise exception 'only participants can review this match' using errcode = '42501'; end if;
  select side into v_submitter_side from public.match_participants where match_id = v_match.id and user_id = v_match.last_submitted_by;
  if v_user_id = v_match.last_submitted_by then raise exception 'a player cannot review their own proposal' using errcode = '42501'; end if;
  if p_decision = 'approve' and v_match.team_size <= 1 and v_viewer_side = v_submitter_side then
    raise exception 'approval must come from the opposite side' using errcode = '42501';
  end if;

  if p_decision = 'approve' then
    insert into public.match_participant_reviews (match_id, user_id, decision, decided_at)
      values (v_match.id, v_user_id, 'approved', now())
      on conflict (match_id, user_id) do update set decision = excluded.decision, decided_at = excluded.decided_at, updated_at = now();
    if v_match.team_size > 1 and exists (select 1 from public.match_participant_reviews where match_id = v_match.id and decision <> 'approved') then
      return v_match;
    end if;
    if v_match.run_id is not null then return private.apply_scheduled_match_elo(v_match.id, 'manual');
    elsif v_match.team_size > 1 then return private.apply_ad_hoc_team_elo(v_match.id, 'manual');
    end if;
    return private.apply_match_elo(v_match.id, 'manual');
  end if;

  v_next_dispute := least(3, v_match.dispute_count + 1);
  insert into public.match_participant_reviews (match_id, user_id, decision, decided_at)
    values (v_match.id, v_user_id, 'disputed', now())
    on conflict (match_id, user_id) do update set decision = excluded.decision, decided_at = excluded.decided_at, updated_at = now();
  if v_explanation is not null then
    update public.matches set dispute_note = v_explanation where id = v_match.id;
  end if;
  if v_next_dispute >= 3 then
    update public.matches set status = 'voided', dispute_count = v_next_dispute, reviewed_at = now(), review_due_at = null, resolution_due_at = null, updated_at = now()
      where id = v_match.id returning * into v_match;
    return v_match;
  end if;
  if v_has_correction then
    if p_court_id is null or p_score_a is null or p_score_b is null or p_score_a < 0 or p_score_b < 0 or p_score_a = p_score_b then raise exception 'complete corrected score is required' using errcode = '22023'; end if;
    if coalesce(p_played_on, current_date) > current_date or coalesce(p_played_on, current_date) < date '2000-01-01' then raise exception 'game date is outside the supported range' using errcode = '22023'; end if;
    select lower(c.sport_type::text) into v_sport from public.courts c where c.id = p_court_id and not c.is_archived;
    if v_sport is null or v_sport not in ('basketball', 'pickleball') then raise exception 'court sport is not supported for ranking' using errcode = '22023'; end if;
    update public.matches set court_id = p_court_id, score_a = p_score_a, score_b = p_score_b,
      winner_side = case when p_score_a > p_score_b then 'a' else 'b' end, sport = v_sport,
      played_at = (coalesce(p_played_on, current_date)::timestamp + interval '12 hours') at time zone 'UTC',
      status = 'pending', dispute_count = v_next_dispute, review_due_at = now() + interval '3 days',
      resolution_due_at = null, reviewed_at = null, revision_number = revision_number + 1,
      last_submitted_by = v_user_id, updated_at = now() where id = v_match.id returning * into v_match;
    update public.match_participant_reviews set decision = case when user_id = v_user_id then 'approved' else 'pending' end,
      decided_at = case when user_id = v_user_id then now() else null end, updated_at = now() where match_id = v_match.id;
    return v_match;
  end if;
  update public.matches set status = 'held', dispute_count = v_next_dispute, reviewed_at = now(), review_due_at = null,
    resolution_due_at = now() + interval '7 days', updated_at = now() where id = v_match.id returning * into v_match;
  return v_match;
end
$$;

create or replace function public.respond_to_match(p_match_id uuid, p_decision text)
returns public.matches language sql security definer set search_path = ''
as $$ select public.respond_to_match(p_match_id, p_decision, null, null, null, null, null) $$;

revoke execute on function public.respond_to_match(uuid, text, text, uuid, integer, integer, date) from public, anon;
grant execute on function public.respond_to_match(uuid, text, text, uuid, integer, integer, date) to authenticated;

-- Revisions can be an atomic pending -> pending update. Keep that transition
-- visible to the other participants even though the status value is unchanged.
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
  if new.status = 'pending' and coalesce(new.revision_number, 0) > coalesce(old.revision_number, 0) then
    v_type := 'match_review'; v_title := 'GAME UPDATED';
    v_body := 'A participant submitted an updated result. Review it within 3 days.';
    v_key := 'match-revised:' || new.id::text || ':' || new.revision_number::text;
  elsif new.status = 'pending' and old.status = 'held' then
    v_type := 'match_review'; v_title := 'GAME UPDATED';
    v_body := 'A participant submitted an updated result. Review it within 3 days.';
    v_key := 'match-revised:' || new.id::text || ':' || new.revision_number::text;
  elsif new.status = 'confirmed' and (new.run_id is null and new.team_size = 1) then
    v_type := 'match_confirmed'; v_title := 'SCORE APPROVED';
    v_body := 'The result is final and ratings are updated.'; v_key := 'match-confirmed:' || new.id::text;
  elsif new.status = 'held' then
    v_type := 'match_rejected'; v_title := 'SCORE ON HOLD';
    v_body := 'A player disputed the result. Update it within 7 days or the game is voided.';
    v_key := 'match-held:' || new.id::text || ':' || new.dispute_count::text;
  elsif new.status = 'voided' then
    v_type := 'match_rejected'; v_title := 'GAME VOIDED';
    v_body := case when new.dispute_count >= 3 then 'The third dispute voided this result. No rating changed.' else 'The 7-day hold expired. This result will not affect profiles or ratings.' end;
    v_key := 'match-voided:' || new.id::text;
  else return new;
  end if;
  for v_user_id in select user_id from public.match_participants where match_id = new.id and user_id <> v_actor loop
    perform private.create_notification(v_user_id, v_type, v_actor, null, new.run_id, new.id, v_title, v_body,
      jsonb_build_object('path', '/match/' || new.id::text), v_key || ':' || v_user_id::text);
    perform private.send_invalidation('user:' || v_user_id::text, 'matches', 'UPDATE');
  end loop;
  return new;
end
$$;

revoke execute on function private.notify_match_change() from public, anon, authenticated;

commit;
