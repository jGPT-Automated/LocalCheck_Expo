-- Challenge a player (decisions D25-D28, Oct 6):
--   * Friends only. One open challenge per pair. 10 sent per day.
--   * Court and day are optional. The challenger picks ranked or casual.
--   * Flow: create_challenge -> opponent's inbox + push -> respond_to_challenge
--     (accept / decline) -> after the game either player calls
--     log_challenge_result, which logs a normal 1v1 through log_match, so the
--     existing confirm / dispute review, auto-confirm and ELO all apply.
--   * Casual = matches.is_ranked false: the game confirms like any other but
--     moves no ELO and no win/loss totals.
--
-- Purely additive for existing data: every existing and future normal game is
-- is_ranked = true, so apply_match_elo behaves exactly as before for them.

begin;

set local lock_timeout = '5s';
set local statement_timeout = '60s';

-- ── 1. Ranked vs casual on games ─────────────────────────────────────────────
alter table public.matches
  add column if not exists is_ranked boolean not null default true;

-- ── 2. Challenges ────────────────────────────────────────────────────────────
create table if not exists public.challenges (
  id uuid primary key default gen_random_uuid(),
  challenger_id uuid not null references public.profiles(id) on delete cascade,
  opponent_id uuid not null references public.profiles(id) on delete cascade,
  court_id uuid references public.courts(id) on delete set null,
  play_on date,
  ranked boolean not null default true,
  status text not null default 'pending'
    check (status in ('pending', 'accepted', 'declined', 'cancelled', 'completed')),
  match_id uuid references public.matches(id) on delete set null,
  cancelled_by uuid references public.profiles(id) on delete set null,
  responded_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (challenger_id <> opponent_id)
);

create index if not exists challenges_opponent_status_idx
  on public.challenges (opponent_id, status, created_at desc);
create index if not exists challenges_challenger_status_idx
  on public.challenges (challenger_id, status, created_at desc);
-- One open challenge per pair, whichever direction.
create unique index if not exists challenges_one_open_per_pair_idx
  on public.challenges (least(challenger_id, opponent_id), greatest(challenger_id, opponent_id))
  where status in ('pending', 'accepted');

alter table public.challenges enable row level security;
drop policy if exists challenges_select_participant on public.challenges;
create policy challenges_select_participant on public.challenges
  for select to authenticated
  using (challenger_id = (select auth.uid()) or opponent_id = (select auth.uid()));

revoke all on public.challenges from anon, authenticated;
grant select on public.challenges to authenticated;

-- ── 3. Notification type ─────────────────────────────────────────────────────
alter table public.notifications drop constraint if exists notifications_type_check;
alter table public.notifications add constraint notifications_type_check check (type in (
  'friend_request', 'friend_accepted', 'run_invite',
  'match_review', 'match_confirmed', 'match_rejected',
  'challenge'
));

-- ── 4. Helpers ───────────────────────────────────────────────────────────────
create or replace function private.challenge_place(p_court_id uuid, p_play_on date)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select concat_ws(' ',
    (select ' at ' || coalesce(nullif(c.short_name, ''), c.name) from public.courts c where c.id = p_court_id),
    case
      when p_play_on is null then null
      when p_play_on = current_date then 'today'
      when p_play_on = current_date + 1 then 'tomorrow'
      else 'on ' || to_char(p_play_on, 'Dy Mon FMDD')
    end
  );
$$;

revoke execute on function private.challenge_place(uuid, date) from public, anon, authenticated;

-- ── 5. Create ────────────────────────────────────────────────────────────────
create or replace function public.create_challenge(
  p_opponent_id uuid,
  p_court_id uuid default null,
  p_play_on date default null,
  p_ranked boolean default true
)
returns public.challenges
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_row public.challenges;
  v_name text;
begin
  if v_user_id is null then
    raise exception 'not authenticated' using errcode = '42501';
  end if;
  if p_opponent_id is null or p_opponent_id = v_user_id then
    raise exception 'You can''t challenge yourself.' using errcode = 'LC101';
  end if;
  if private.users_are_blocked(v_user_id, p_opponent_id) then
    raise exception 'interaction is blocked' using errcode = '42501';
  end if;
  if not exists (
    select 1 from public.friendships f
    where f.status = 'accepted'
      and ((f.requester_id = v_user_id and f.addressee_id = p_opponent_id)
        or (f.addressee_id = v_user_id and f.requester_id = p_opponent_id))
  ) then
    raise exception 'Challenges are between friends. Add them as a friend first.' using errcode = 'LC102';
  end if;
  if p_court_id is not null and not exists (
    select 1 from public.courts c where c.id = p_court_id and not c.is_archived
  ) then
    raise exception 'court not found' using errcode = 'P0002';
  end if;
  if p_play_on is not null and (p_play_on < current_date - 1 or p_play_on > current_date + 60) then
    raise exception 'Pick a day in the next two months.' using errcode = 'LC103';
  end if;
  if exists (
    select 1 from public.challenges c
    where least(c.challenger_id, c.opponent_id) = least(v_user_id, p_opponent_id)
      and greatest(c.challenger_id, c.opponent_id) = greatest(v_user_id, p_opponent_id)
      and c.status in ('pending', 'accepted')
  ) then
    raise exception 'You already have an open challenge with this player.' using errcode = 'LC104';
  end if;
  if (
    select count(*) from public.challenges c
    where c.challenger_id = v_user_id and c.created_at > now() - interval '1 day'
  ) >= 10 then
    raise exception 'That''s 10 challenges today. Try again tomorrow.' using errcode = 'LC105';
  end if;

  insert into public.challenges (challenger_id, opponent_id, court_id, play_on, ranked)
  values (v_user_id, p_opponent_id, p_court_id, p_play_on, coalesce(p_ranked, true))
  returning * into v_row;

  select coalesce(display_name, username, 'A player') into v_name
  from public.profiles where id = v_user_id;

  perform private.create_notification(
    p_opponent_id, 'challenge', v_user_id, null, null, null,
    'NEW CHALLENGE',
    left(v_name || ' challenged you to a '
      || case when v_row.ranked then 'ranked' else 'casual' end || ' 1v1'
      || coalesce(private.challenge_place(v_row.court_id, v_row.play_on), '') || '.', 240),
    jsonb_build_object('path', '/challenge/' || v_row.id::text, 'challenge_id', v_row.id),
    'challenge-new:' || v_row.id::text
  );
  return v_row;
end
$$;

-- ── 6. Accept / decline (opponent) ───────────────────────────────────────────
create or replace function public.respond_to_challenge(p_challenge_id uuid, p_accept boolean)
returns public.challenges
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_row public.challenges;
  v_name text;
begin
  if v_user_id is null then
    raise exception 'not authenticated' using errcode = '42501';
  end if;
  select * into v_row from public.challenges where id = p_challenge_id for update;
  if not found or v_row.opponent_id <> v_user_id then
    raise exception 'challenge not found' using errcode = 'P0002';
  end if;
  if v_row.status <> 'pending' then
    raise exception 'This challenge was already answered.' using errcode = 'LC106';
  end if;

  update public.challenges
  set status = case when p_accept then 'accepted' else 'declined' end,
      responded_at = now(), updated_at = now()
  where id = v_row.id
  returning * into v_row;

  select coalesce(display_name, username, 'Your opponent') into v_name
  from public.profiles where id = v_user_id;

  perform private.create_notification(
    v_row.challenger_id, 'challenge', v_user_id, null, null, null,
    case when p_accept then 'CHALLENGE ACCEPTED' else 'CHALLENGE DECLINED' end,
    case when p_accept
      then v_name || ' is in. Log the score here after you play.'
      else v_name || ' passed on your challenge.'
    end,
    jsonb_build_object('path', '/challenge/' || v_row.id::text, 'challenge_id', v_row.id),
    'challenge-response:' || v_row.id::text
  );
  return v_row;
end
$$;

-- ── 7. Call it off (either player, while open) ───────────────────────────────
create or replace function public.cancel_challenge(p_challenge_id uuid)
returns public.challenges
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_row public.challenges;
  v_other uuid;
  v_name text;
begin
  if v_user_id is null then
    raise exception 'not authenticated' using errcode = '42501';
  end if;
  select * into v_row from public.challenges where id = p_challenge_id for update;
  if not found or v_user_id not in (v_row.challenger_id, v_row.opponent_id) then
    raise exception 'challenge not found' using errcode = 'P0002';
  end if;
  if v_row.status not in ('pending', 'accepted') then
    raise exception 'This challenge is already closed.' using errcode = 'LC107';
  end if;

  update public.challenges
  set status = 'cancelled', cancelled_by = v_user_id, updated_at = now()
  where id = v_row.id
  returning * into v_row;

  -- A pending challenge withdrawn by its sender needs no notice; anything
  -- the other player already saw or accepted does.
  if not (v_row.responded_at is null and v_user_id = v_row.challenger_id) then
    v_other := case when v_user_id = v_row.challenger_id then v_row.opponent_id else v_row.challenger_id end;
    select coalesce(display_name, username, 'Your opponent') into v_name
    from public.profiles where id = v_user_id;
    perform private.create_notification(
      v_other, 'challenge', v_user_id, null, null, null,
      'CHALLENGE CALLED OFF',
      v_name || ' called off your challenge.',
      jsonb_build_object('path', '/challenge/' || v_row.id::text, 'challenge_id', v_row.id),
      'challenge-cancelled:' || v_row.id::text
    );
  end if;
  return v_row;
end
$$;

-- ── 8. Log the score (either player, once accepted) ──────────────────────────
-- Logged by whoever submits, as a normal 1v1 through log_match: the other
-- player gets "CONFIRM FINAL SCORE" and the usual 3-day review applies.
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

  update public.matches set is_ranked = v_row.ranked
  where id = v_match.id
  returning * into v_match;

  update public.challenges
  set status = 'completed', match_id = v_match.id, court_id = v_court, updated_at = now()
  where id = v_row.id;
  return v_match;
end
$$;

revoke execute on function public.create_challenge(uuid, uuid, date, boolean) from public, anon;
revoke execute on function public.respond_to_challenge(uuid, boolean) from public, anon;
revoke execute on function public.cancel_challenge(uuid) from public, anon;
revoke execute on function public.log_challenge_result(uuid, integer, integer, uuid, date, uuid) from public, anon;
grant execute on function public.create_challenge(uuid, uuid, date, boolean) to authenticated;
grant execute on function public.respond_to_challenge(uuid, boolean) to authenticated;
grant execute on function public.cancel_challenge(uuid) to authenticated;
grant execute on function public.log_challenge_result(uuid, integer, integer, uuid, date, uuid) to authenticated;

-- ── 9. Casual games confirm without moving ELO or win/loss totals ───────────
-- Patched in place (the live function body is long and otherwise unchanged);
-- each patch asserts its anchor exists so a drifted definition fails loudly.
do $patch$
declare
  v_def text;
  v_anchor text := $a$  if (select count(*) from public.match_participants where match_id = v_match.id) <> 2 then
    raise exception 'match participant invariant failed' using errcode = '23514';
  end if;
$a$;
  v_casual text := $c$
  if not v_match.is_ranked then
    update public.matches set
      status = 'confirmed', confirmed_at = now(), reviewed_at = now(),
      confirmation_method = p_confirmation_method
    where id = v_match.id returning * into v_match;
    if coalesce(current_setting('localcheck.suppress_activity', true), '') <> 'on' then
      insert into public.activity_events (
        event_type, actor_id, court_id, match_id, visibility, payload, occurred_at
      ) values (
        'match_result',
        case when v_match.winner_side = 'a' then v_match.created_by else v_match.opponent_id end,
        v_match.court_id, v_match.id, v_match.visibility,
        jsonb_build_object(
          'score_a', v_match.score_a, 'score_b', v_match.score_b,
          'winner_side', v_match.winner_side,
          'player_a_id', v_match.created_by, 'player_b_id', v_match.opponent_id,
          'sport', v_match.sport, 'ranked', false
        ), v_match.confirmed_at
      );
    end if;
    return v_match;
  end if;
$c$;
begin
  v_def := pg_get_functiondef('private.apply_match_elo(uuid,text)'::regprocedure);
  if position(v_anchor in v_def) = 0 then
    raise exception 'apply_match_elo anchor not found; definition drifted';
  end if;
  if position('if not v_match.is_ranked then' in v_def) = 0 then
    execute replace(v_def, v_anchor, v_anchor || v_casual);
  end if;
end
$patch$;

do $patch$
declare
  v_def text;
  v_anchor text := $a$          || '. ELO now ' || coalesce(v_elo_after, 0)::text
          || ' (' || (case when v_delta >= 0 then '+' else '' end) || v_delta::text || ').',$a$;
  v_new text := $n$          || (case when not new.is_ranked then '. Casual game, no ELO change.'
            else '. ELO now ' || coalesce(v_elo_after, 0)::text
              || ' (' || (case when v_delta >= 0 then '+' else '' end) || v_delta::text || ').' end),$n$;
begin
  v_def := pg_get_functiondef('private.notify_match_change()'::regprocedure);
  if position('Casual game, no ELO change' in v_def) > 0 then
    return;
  end if;
  if position(v_anchor in v_def) = 0 then
    raise exception 'notify_match_change anchor not found; definition drifted';
  end if;
  execute replace(v_def, v_anchor, v_new);
end
$patch$;

commit;
