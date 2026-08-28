-- Canonical MVP score-review lifecycle.
--
-- pending  -> confirmed after an opposite-side approval or three days
-- pending  -> held after the first or second dispute
-- held     -> pending when any participant submits a corrected result
-- held     -> voided after seven days without a correction
-- pending  -> voided on the third dispute
--
-- A revision updates the existing match row. It never creates a second game,
-- and no held or voided result can mutate profile records or ratings.

begin;

set local lock_timeout = '5s';
set local statement_timeout = '90s';

alter table public.matches
  add column if not exists dispute_count smallint not null default 0,
  add column if not exists revision_number smallint not null default 0,
  add column if not exists resolution_due_at timestamptz,
  add column if not exists last_submitted_by uuid references public.profiles(id) on delete set null;

-- The original review model required this column for every state. A held or
-- voided game has no active three-day review clock, so its deadline is null.
alter table public.matches alter column review_due_at drop not null;

update public.matches
set last_submitted_by = created_by
where last_submitted_by is null;

alter table public.matches drop constraint if exists matches_status_check;
update public.matches
set status = 'held',
    dispute_count = greatest(dispute_count, 1),
    resolution_due_at = coalesce(reviewed_at, updated_at, now()) + interval '7 days'
where status = 'rejected';
alter table public.matches
  add constraint matches_status_check
  check (status in ('pending', 'held', 'confirmed', 'voided'));

-- Scheduled/team disputes from the former decision-only model become real
-- holds rather than being auto-confirmed by the new cron.
update public.matches m
set status = 'held',
    dispute_count = greatest(m.dispute_count, 1),
    review_due_at = null,
    resolution_due_at = now() + interval '7 days',
    reviewed_at = now(),
    updated_at = now()
where m.status = 'pending'
  and exists (
    select 1 from public.match_participant_reviews r
    where r.match_id = m.id and r.decision = 'disputed'
  );

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'matches_dispute_count_check') then
    alter table public.matches add constraint matches_dispute_count_check
      check (dispute_count between 0 and 3);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'matches_revision_number_check') then
    alter table public.matches add constraint matches_revision_number_check
      check (revision_number >= 0);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'matches_review_deadline_state_check') then
    alter table public.matches add constraint matches_review_deadline_state_check check (
      (status = 'pending' and review_due_at is not null and resolution_due_at is null)
      or (status = 'held' and resolution_due_at is not null and confirmed_at is null)
      or (status = 'confirmed' and confirmed_at is not null)
      or (status = 'voided' and confirmed_at is null)
    );
  end if;
end
$$;

create index if not exists matches_resolution_due_idx
  on public.matches (resolution_due_at, id)
  where status = 'held';

-- 1v1 rows predate participant reviews. Backfill them so the client can show
-- one review model for every format.
insert into public.match_participant_reviews (match_id, user_id, decision, decided_at)
select mp.match_id, mp.user_id,
  case when mp.user_id = m.last_submitted_by then 'approved' else 'pending' end,
  case when mp.user_id = m.last_submitted_by then coalesce(m.updated_at, m.created_at) else null end
from public.match_participants mp
join public.matches m on m.id = mp.match_id
on conflict (match_id, user_id) do nothing;

-- Older logging RPCs do not know the new column. Preserve their signatures
-- for installed clients and derive the initial proposer from created_by.
create or replace function private.set_match_lifecycle_defaults()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  new.last_submitted_by := coalesce(new.last_submitted_by, new.created_by);
  if new.status = 'pending' then
    new.review_due_at := coalesce(new.review_due_at, now() + interval '3 days');
    new.resolution_due_at := null;
  end if;
  return new;
end
$$;

revoke execute on function private.set_match_lifecycle_defaults()
  from public, anon, authenticated;
drop trigger if exists set_match_lifecycle_defaults on public.matches;
create trigger set_match_lifecycle_defaults
before insert on public.matches
for each row execute function private.set_match_lifecycle_defaults();

-- All transitions share one participant-aware notification contract. Team
-- confirmation remains owned by the existing rating functions, which already
-- notify the full roster.
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
  v_title text;
  v_body text;
  v_type text;
  v_key text;
begin
  if tg_op = 'INSERT' then
    if new.run_id is null and new.team_size = 1 and new.status = 'pending' then
      select coalesce(display_name, username, 'A player') into v_name
      from public.profiles where id = new.created_by;
      perform private.create_notification(
        new.opponent_id, 'match_review', new.created_by, null, null, new.id,
        'CONFIRM FINAL SCORE',
        v_name || ' logged ' || new.score_a::text || '–' || new.score_b::text || '.',
        jsonb_build_object('path', '/match/' || new.id::text),
        'match-review:' || new.id::text
      );
    end if;
    return new;
  end if;

  if old.status is not distinct from new.status then return new; end if;

  if new.status = 'confirmed' and (new.run_id is not null or new.team_size > 1) then
    return new;
  elsif new.status = 'confirmed' then
    v_type := 'match_confirmed';
    v_title := 'SCORE APPROVED';
    v_body := 'The result is final and ratings are updated.';
    v_key := 'match-confirmed:' || new.id::text;
  elsif new.status = 'held' then
    v_type := 'match_rejected';
    v_title := 'SCORE ON HOLD';
    v_body := 'A player disputed the result. Update it within 7 days or the game is voided.';
    v_key := 'match-held:' || new.id::text || ':' || new.dispute_count::text;
  elsif new.status = 'pending' and old.status = 'held' then
    v_type := 'match_review';
    v_title := 'GAME UPDATED';
    v_body := 'A participant submitted an updated result. Review it within 3 days.';
    v_key := 'match-revised:' || new.id::text || ':' || new.revision_number::text;
  elsif new.status = 'voided' then
    v_type := 'match_rejected';
    v_title := 'GAME VOIDED';
    v_body := case when new.dispute_count >= 3
      then 'The third dispute voided this result. No rating changed.'
      else 'The 7-day hold expired. This result will not affect profiles or ratings.'
    end;
    v_key := 'match-voided:' || new.id::text;
  else
    return new;
  end if;

  for v_user_id in
    select user_id from public.match_participants
    where match_id = new.id and user_id <> v_actor
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

revoke execute on function private.notify_match_change()
  from public, anon, authenticated;

-- One response RPC owns approval and disputes for 1v1, ad-hoc teams, and
-- scheduled teams. An opposite-side participant may approve the latest
-- proposal early. Any participant other than the proposer may dispute it.
create or replace function public.respond_to_match(
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
  v_viewer_side text;
  v_submitter_side text;
  v_next_dispute smallint;
begin
  if v_user_id is null then raise exception 'not authenticated' using errcode = '42501'; end if;
  if p_decision not in ('approve', 'dispute') then
    raise exception 'invalid match response' using errcode = '22023';
  end if;

  select * into v_match from public.matches where id = p_match_id for update;
  if not found then raise exception 'match not found' using errcode = 'P0002'; end if;
  if v_match.status <> 'pending' then
    raise exception 'match is not open for review' using errcode = '22023';
  end if;
  if v_match.review_due_at <= now() then
    raise exception 'review window has ended' using errcode = '22023';
  end if;

  select side into v_viewer_side from public.match_participants
  where match_id = v_match.id and user_id = v_user_id;
  if v_viewer_side is null then
    raise exception 'only participants can review this match' using errcode = '42501';
  end if;
  select side into v_submitter_side from public.match_participants
  where match_id = v_match.id and user_id = v_match.last_submitted_by;

  if v_user_id = v_match.last_submitted_by then
    raise exception 'a player cannot review their own proposal' using errcode = '42501';
  end if;
  if p_decision = 'approve' and v_viewer_side = v_submitter_side then
    raise exception 'approval must come from the opposite side' using errcode = '42501';
  end if;

  insert into public.match_participant_reviews (match_id, user_id, decision, decided_at)
  values (
    v_match.id, v_user_id,
    case when p_decision = 'approve' then 'approved' else 'disputed' end,
    now()
  )
  on conflict (match_id, user_id) do update set
    decision = excluded.decision, decided_at = excluded.decided_at, updated_at = now();

  if p_decision = 'dispute' then
    v_next_dispute := least(3, v_match.dispute_count + 1);
    if v_next_dispute >= 3 then
      update public.matches set
        status = 'voided', dispute_count = v_next_dispute,
        reviewed_at = now(), review_due_at = null,
        resolution_due_at = null, updated_at = now()
      where id = v_match.id returning * into v_match;
    else
      update public.matches set
        status = 'held', dispute_count = v_next_dispute,
        reviewed_at = now(), review_due_at = null,
        resolution_due_at = now() + interval '7 days', updated_at = now()
      where id = v_match.id returning * into v_match;
    end if;
    return v_match;
  end if;

  if v_match.run_id is not null then
    return private.apply_scheduled_match_elo(v_match.id, 'manual');
  elsif v_match.team_size > 1 then
    return private.apply_ad_hoc_team_elo(v_match.id, 'manual');
  end if;
  return private.apply_match_elo(v_match.id, 'manual');
end
$$;

-- A held game is edited in place. Rosters remain stable for this MVP; score,
-- court/sport, and played date are the editable game details. Any participant
-- may submit the correction, which starts a fresh three-day review window.
create or replace function public.update_held_match(
  p_match_id uuid,
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
  v_sport text;
  v_played_on date := coalesce(p_played_on, current_date);
begin
  if v_user_id is null then raise exception 'not authenticated' using errcode = '42501'; end if;
  select * into v_match from public.matches where id = p_match_id for update;
  if not found or v_match.status <> 'held' then
    raise exception 'held match not found' using errcode = 'P0002';
  end if;
  if not exists (
    select 1 from public.match_participants
    where match_id = v_match.id and user_id = v_user_id
  ) then raise exception 'only participants can update this match' using errcode = '42501'; end if;
  if v_match.resolution_due_at <= now() then
    raise exception 'resolution window has ended' using errcode = '22023';
  end if;
  if p_score_a is null or p_score_b is null or p_score_a < 0 or p_score_b < 0 or p_score_a = p_score_b then
    raise exception 'invalid final score' using errcode = '22023';
  end if;
  if v_played_on > current_date or v_played_on < date '2000-01-01' then
    raise exception 'game date is outside the supported range' using errcode = '22023';
  end if;
  select lower(c.sport_type::text) into v_sport
  from public.courts c where c.id = p_court_id and not c.is_archived;
  if v_sport is null or v_sport not in ('basketball', 'pickleball') then
    raise exception 'court sport is not supported for ranking' using errcode = '22023';
  end if;

  update public.matches set
    court_id = p_court_id,
    played_at = (v_played_on::timestamp + interval '12 hours') at time zone 'UTC',
    score_a = p_score_a,
    score_b = p_score_b,
    winner_side = case when p_score_a > p_score_b then 'a' else 'b' end,
    sport = v_sport,
    status = 'pending',
    review_due_at = now() + interval '3 days',
    resolution_due_at = null,
    reviewed_at = null,
    revision_number = revision_number + 1,
    last_submitted_by = v_user_id,
    updated_at = now()
  where id = v_match.id returning * into v_match;

  update public.match_participant_reviews set
    decision = case when user_id = v_user_id then 'approved' else 'pending' end,
    decided_at = case when user_id = v_user_id then now() else null end,
    updated_at = now()
  where match_id = v_match.id;
  return v_match;
end
$$;

-- Backward-compatible installed-client entry points delegate to the lifecycle
-- RPC instead of retaining separate behavior.
create or replace function public.confirm_match(p_match_id uuid)
returns public.matches language sql security definer set search_path = ''
as $$ select public.respond_to_match(p_match_id, 'approve') $$;

create or replace function public.reject_match(p_match_id uuid)
returns public.matches language sql security definer set search_path = ''
as $$ select public.respond_to_match(p_match_id, 'dispute') $$;

create or replace function public.review_team_match(p_match_id uuid, p_decision text)
returns public.matches language plpgsql security definer set search_path = ''
as $$
declare v_match public.matches;
begin
  if p_decision not in ('pending', 'approved', 'disputed') then
    raise exception 'invalid review decision' using errcode = '22023';
  end if;
  if p_decision = 'pending' then
    select * into v_match from public.matches where id = p_match_id;
    return v_match;
  end if;
  return public.respond_to_match(
    p_match_id, case when p_decision = 'approved' then 'approve' else 'dispute' end
  );
end
$$;

create or replace function public.review_run_match(p_match_id uuid, p_decision text)
returns public.matches language plpgsql security definer set search_path = ''
as $$
declare v_match public.matches;
begin
  if p_decision not in ('pending', 'approved', 'disputed') then
    raise exception 'invalid review decision' using errcode = '22023';
  end if;
  if p_decision = 'pending' then
    select * into v_match from public.matches where id = p_match_id;
    return v_match;
  end if;
  return public.respond_to_match(
    p_match_id, case when p_decision = 'approved' then 'approve' else 'dispute' end
  );
end
$$;

-- The existing 15-minute cron now resolves both clocks: pending scores become
-- official; unresolved holds become void. Each row is locked exactly once.
create or replace function private.auto_confirm_due_matches()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_match public.matches;
  v_count integer := 0;
begin
  for v_match in
    select * from public.matches
    where (status = 'pending' and review_due_at <= now())
       or (status = 'held' and resolution_due_at <= now())
    order by coalesce(review_due_at, resolution_due_at), id
    for update skip locked
  loop
    if v_match.status = 'held' then
      update public.matches set
        status = 'voided', resolution_due_at = null,
        reviewed_at = now(), updated_at = now()
      where id = v_match.id;
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

revoke execute on function public.respond_to_match(uuid, text) from public, anon;
revoke execute on function public.update_held_match(uuid, uuid, integer, integer, date) from public, anon;
revoke execute on function public.confirm_match(uuid) from public, anon;
revoke execute on function public.reject_match(uuid) from public, anon;
revoke execute on function public.review_team_match(uuid, text) from public, anon;
revoke execute on function public.review_run_match(uuid, text) from public, anon;
revoke execute on function private.auto_confirm_due_matches() from public, anon, authenticated;

grant execute on function public.respond_to_match(uuid, text) to authenticated;
grant execute on function public.update_held_match(uuid, uuid, integer, integer, date) to authenticated;
grant execute on function public.confirm_match(uuid) to authenticated;
grant execute on function public.reject_match(uuid) to authenticated;
grant execute on function public.review_team_match(uuid, text) to authenticated;
grant execute on function public.review_run_match(uuid, text) to authenticated;

commit;
