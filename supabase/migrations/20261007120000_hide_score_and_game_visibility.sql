-- Hide score + who sees a game (decisions D30-D31, Oct 7):
--   * Each player can hide the score for their side (match_participants.
--     hide_score). If any player hid it, people outside the game see only who
--     won. The app masks the numbers; the game still counts for ELO, rank,
--     record and head-to-head.
--   * A game reaches feeds and profiles outside the game only when every
--     player in it is Public. If anyone in it is Friends Only or Private, only
--     the players in the game see it. Checked live, so changing your privacy
--     setting applies to your past games right away.

begin;

set local lock_timeout = '5s';
set local statement_timeout = '60s';

alter table public.match_participants
  add column if not exists hide_score boolean not null default false;

-- True when every player in the game has a Public profile.
create or replace function private.match_all_public(p_match_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select not exists (
    select 1
    from public.match_participants mp
    join public.profiles p on p.id = mp.user_id
    where mp.match_id = p_match_id
      and p.visibility <> 'public'
  );
$$;

revoke execute on function private.match_all_public(uuid) from public, anon;
grant execute on function private.match_all_public(uuid) to authenticated;

-- A player shows or hides the score for their own side, any time.
create or replace function public.set_score_hidden(p_match_id uuid, p_hidden boolean)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
begin
  if v_user_id is null then
    raise exception 'not authenticated' using errcode = '42501';
  end if;
  update public.match_participants
  set hide_score = coalesce(p_hidden, false)
  where match_id = p_match_id and user_id = v_user_id;
  if not found then
    raise exception 'game not found' using errcode = 'P0002';
  end if;
  return coalesce(p_hidden, false);
end
$$;

revoke execute on function public.set_score_hidden(uuid, boolean) from public, anon;
grant execute on function public.set_score_hidden(uuid, boolean) to authenticated;

-- Feeds: a game result is visible to its players always, and to anyone else
-- only when every player is Public (plus the existing visibility rules).
drop policy if exists activity_events_select_visible on public.activity_events;
create policy activity_events_select_visible on public.activity_events
  for select to authenticated
  using (
    actor_id = (select auth.uid())
    or (
      match_id is not null
      and private.is_match_participant(match_id, (select auth.uid()))
    )
    or (
      not private.users_are_blocked((select auth.uid()), actor_id)
      and (event_type <> 'match_result' or match_id is null or private.match_all_public(match_id))
      and (
        visibility = 'public'
        or (visibility = 'friends' and exists (
          select 1 from public.friendships f
          where f.status = 'accepted'
            and ((f.requester_id = (select auth.uid()) and f.addressee_id = activity_events.actor_id)
              or (f.addressee_id = (select auth.uid()) and f.requester_id = activity_events.actor_id))
        ))
      )
    )
  );

-- Games themselves: same rule for anyone outside the game.
drop policy if exists matches_select_visible on public.matches;
create policy matches_select_visible on public.matches
  for select to authenticated
  using (
    created_by = (select auth.uid())
    or opponent_id = (select auth.uid())
    or private.is_match_participant(id, (select auth.uid()))
    or (
      status = 'confirmed'
      and private.match_all_public(id)
      and (
        visibility = 'public'
        or (visibility = 'friends' and exists (
          select 1 from public.friendships f
          where f.status = 'accepted'
            and ((f.requester_id = (select auth.uid()) and f.addressee_id = matches.created_by)
              or (f.addressee_id = (select auth.uid()) and f.requester_id = matches.created_by))
        ))
      )
    )
  );

commit;
