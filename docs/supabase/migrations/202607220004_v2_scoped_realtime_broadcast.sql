-- APPLIED to LocalCheckProd (qkrnmyexzvaxiqfxwwfb) on 2026-07-22.
-- Intended target: LocalCheckProd (qkrnmyexzvaxiqfxwwfb).
--
-- Private, scoped Broadcast invalidations. No application table is added to
-- the supabase_realtime Postgres Changes publication. Payloads intentionally
-- contain no row data: clients receive an invalidation and refetch through RLS.

begin;

set local lock_timeout = '5s';
set local statement_timeout = '60s';

drop policy if exists localcheck_receive_scoped_broadcasts on realtime.messages;
create policy localcheck_receive_scoped_broadcasts
on realtime.messages
for select
to authenticated
using (
  realtime.messages.extension = 'broadcast'
  and (
    (select realtime.topic()) = 'user:' || (select auth.uid())::text
    or case
      when (select realtime.topic()) ~ '^market:[a-z0-9]+(-[a-z0-9]+)*$'
      then exists (
        select 1
        from public.courts c
        where trim(both '-' from regexp_replace(
                lower(c.market), '[^a-z0-9]+', '-', 'g'
              )) = substring((select realtime.topic()) from 8)
          and not c.is_archived
      )
      else false
    end
    or case
      when (select realtime.topic()) ~ '^court:[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
      then exists (
        select 1
        from public.courts c
        where c.id = substring((select realtime.topic()) from 7)::uuid
          and not c.is_archived
      )
      else false
    end
    or case
      when (select realtime.topic()) ~ '^run:[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
      then exists (
        select 1
        from public.runs r
        where r.id = substring((select realtime.topic()) from 5)::uuid
          and (r.is_open_invite or r.organizer_id = (select auth.uid()))
      )
      else false
    end
  )
);

create or replace function private.send_invalidation(
  p_topic text,
  p_resource text,
  p_operation text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform realtime.send(
    jsonb_build_object('resource', p_resource, 'operation', p_operation),
    'invalidate',
    p_topic,
    true
  );
end
$$;

revoke execute on function private.send_invalidation(text, text, text)
  from public, anon, authenticated;

create or replace function private.send_market_invalidation(
  p_court_id uuid,
  p_resource text,
  p_operation text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_topic text;
begin
  select 'market:' || trim(both '-' from regexp_replace(
           lower(c.market), '[^a-z0-9]+', '-', 'g'
         ))
  into v_topic
  from public.courts c
  where c.id = p_court_id and not c.is_archived;

  if v_topic is not null then
    perform private.send_invalidation(v_topic, p_resource, p_operation);
  end if;
end
$$;

revoke execute on function private.send_market_invalidation(uuid, text, text)
  from public, anon, authenticated;

create or replace function private.broadcast_check_in_invalidation()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_row public.check_ins;
begin
  if tg_op = 'DELETE' then v_row := old; else v_row := new; end if;

  perform private.send_invalidation(
    'court:' || v_row.court_id::text, 'check_ins', tg_op
  );
  perform private.send_market_invalidation(v_row.court_id, 'check_ins', tg_op);
  perform private.send_invalidation(
    'user:' || v_row.user_id::text, 'check_ins', tg_op
  );

  if tg_op = 'UPDATE' and old.court_id is distinct from new.court_id then
    perform private.send_invalidation(
      'court:' || old.court_id::text, 'check_ins', tg_op
    );
    perform private.send_market_invalidation(old.court_id, 'check_ins', tg_op);
  end if;
  return v_row;
end
$$;

revoke execute on function private.broadcast_check_in_invalidation()
  from public, anon, authenticated;
drop trigger if exists broadcast_check_in_invalidation on public.check_ins;
create trigger broadcast_check_in_invalidation
after insert or update or delete on public.check_ins
for each row execute function private.broadcast_check_in_invalidation();

create or replace function private.broadcast_profile_invalidation()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_row public.profiles;
  v_old_local_court_id uuid;
  v_active_court_id uuid;
  v_friend_id uuid;
begin
  if tg_op = 'DELETE' then v_row := old; else v_row := new; end if;
  if tg_op = 'UPDATE' then v_old_local_court_id := old.local_court_id; end if;

  select ci.court_id into v_active_court_id
  from public.check_ins ci
  where ci.user_id = v_row.id and ci.checked_out_at is null
  limit 1;

  perform private.send_invalidation(
    'user:' || v_row.id::text, 'profiles', tg_op
  );
  -- Accepted friends render this profile outside the owner's court/market.
  -- Profile edits are low-frequency, so bounded user-topic fanout is safer
  -- than leaving friend cards stale or adding a globally readable topic.
  if tg_op = 'UPDATE' then
    for v_friend_id in
      select case
        when f.requester_id = v_row.id then f.addressee_id
        else f.requester_id
      end
      from public.friendships f
      where f.status = 'accepted'
        and (f.requester_id = v_row.id or f.addressee_id = v_row.id)
    loop
      perform private.send_invalidation(
        'user:' || v_friend_id::text, 'profiles', tg_op
      );
    end loop;
  end if;
  if v_row.local_court_id is not null then
    perform private.send_invalidation(
      'court:' || v_row.local_court_id::text, 'profiles', tg_op
    );
    perform private.send_market_invalidation(
      v_row.local_court_id, 'profiles', tg_op
    );
  end if;
  -- Moving A -> B must invalidate both rosters; moving A -> NULL must still
  -- invalidate A. Without the OLD topic, court A remains stale indefinitely.
  if tg_op = 'UPDATE'
     and old.local_court_id is distinct from new.local_court_id
     and old.local_court_id is not null then
    perform private.send_invalidation(
      'court:' || old.local_court_id::text, 'profiles', tg_op
    );
    perform private.send_market_invalidation(
      old.local_court_id, 'profiles', tg_op
    );
  end if;
  -- A player can be checked in somewhere other than their local court. Profile
  -- changes (name/avatar/Elo included) must refresh that active roster too.
  if v_active_court_id is not null
     and v_active_court_id is distinct from v_row.local_court_id
     and v_active_court_id is distinct from v_old_local_court_id then
    perform private.send_invalidation(
      'court:' || v_active_court_id::text, 'profiles', tg_op
    );
    perform private.send_market_invalidation(
      v_active_court_id, 'profiles', tg_op
    );
  end if;
  return v_row;
end
$$;

revoke execute on function private.broadcast_profile_invalidation()
  from public, anon, authenticated;
drop trigger if exists broadcast_profile_invalidation on public.profiles;
create trigger broadcast_profile_invalidation
after insert or update or delete on public.profiles
for each row execute function private.broadcast_profile_invalidation();

create or replace function private.broadcast_run_invalidation()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_row public.runs;
begin
  if tg_op = 'DELETE' then v_row := old; else v_row := new; end if;

  perform private.send_invalidation('run:' || v_row.id::text, 'runs', tg_op);
  perform private.send_invalidation(
    'court:' || v_row.court_id::text, 'runs', tg_op
  );
  perform private.send_invalidation(
    'user:' || v_row.organizer_id::text, 'runs', tg_op
  );
  if v_row.is_open_invite then
    perform private.send_market_invalidation(v_row.court_id, 'runs', tg_op);
  end if;

  if tg_op = 'UPDATE' and old.court_id is distinct from new.court_id then
    perform private.send_invalidation(
      'court:' || old.court_id::text, 'runs', tg_op
    );
  end if;
  if tg_op = 'UPDATE' and old.is_open_invite
     and (old.court_id is distinct from new.court_id or not new.is_open_invite) then
    perform private.send_market_invalidation(old.court_id, 'runs', tg_op);
  end if;
  return v_row;
end
$$;

revoke execute on function private.broadcast_run_invalidation()
  from public, anon, authenticated;
drop trigger if exists broadcast_run_invalidation on public.runs;
create trigger broadcast_run_invalidation
after insert or update or delete on public.runs
for each row execute function private.broadcast_run_invalidation();

create or replace function private.broadcast_run_participant_invalidation()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_row public.run_participants;
  v_court_id uuid;
  v_open boolean;
begin
  if tg_op = 'DELETE' then v_row := old; else v_row := new; end if;

  select r.court_id, r.is_open_invite into v_court_id, v_open
  from public.runs r where r.id = v_row.run_id;

  perform private.send_invalidation(
    'run:' || v_row.run_id::text, 'run_participants', tg_op
  );
  perform private.send_invalidation(
    'user:' || v_row.user_id::text, 'run_participants', tg_op
  );
  if v_court_id is not null then
    perform private.send_invalidation(
      'court:' || v_court_id::text, 'run_participants', tg_op
    );
    if v_open then
      perform private.send_market_invalidation(
        v_court_id, 'run_participants', tg_op
      );
    end if;
  end if;
  return v_row;
end
$$;

revoke execute on function private.broadcast_run_participant_invalidation()
  from public, anon, authenticated;
drop trigger if exists broadcast_run_participant_invalidation on public.run_participants;
create trigger broadcast_run_participant_invalidation
after insert or update or delete on public.run_participants
for each row execute function private.broadcast_run_participant_invalidation();

create or replace function private.broadcast_match_invalidation()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_row public.matches;
begin
  if tg_op = 'DELETE' then v_row := old; else v_row := new; end if;

  perform private.send_invalidation(
    'court:' || v_row.court_id::text, 'matches', tg_op
  );
  perform private.send_invalidation(
    'user:' || v_row.created_by::text, 'matches', tg_op
  );
  perform private.send_invalidation(
    'user:' || v_row.opponent_id::text, 'matches', tg_op
  );
  return v_row;
end
$$;

revoke execute on function private.broadcast_match_invalidation()
  from public, anon, authenticated;
drop trigger if exists broadcast_match_invalidation on public.matches;
create trigger broadcast_match_invalidation
after insert or update or delete on public.matches
for each row execute function private.broadcast_match_invalidation();

create or replace function private.broadcast_match_participant_invalidation()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_row public.match_participants;
  v_court_id uuid;
begin
  if tg_op = 'DELETE' then v_row := old; else v_row := new; end if;

  select m.court_id into v_court_id
  from public.matches m where m.id = v_row.match_id;

  perform private.send_invalidation(
    'user:' || v_row.user_id::text, 'match_participants', tg_op
  );
  if v_court_id is not null then
    perform private.send_invalidation(
      'court:' || v_court_id::text, 'match_participants', tg_op
    );
  end if;
  return v_row;
end
$$;

revoke execute on function private.broadcast_match_participant_invalidation()
  from public, anon, authenticated;
drop trigger if exists broadcast_match_participant_invalidation on public.match_participants;
create trigger broadcast_match_participant_invalidation
after insert or update or delete on public.match_participants
for each row execute function private.broadcast_match_participant_invalidation();

create or replace function private.broadcast_friendship_invalidation()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_row public.friendships;
begin
  if tg_op = 'DELETE' then v_row := old; else v_row := new; end if;

  perform private.send_invalidation(
    'user:' || v_row.requester_id::text, 'friendships', tg_op
  );
  perform private.send_invalidation(
    'user:' || v_row.addressee_id::text, 'friendships', tg_op
  );
  return v_row;
end
$$;

revoke execute on function private.broadcast_friendship_invalidation()
  from public, anon, authenticated;
drop trigger if exists broadcast_friendship_invalidation on public.friendships;
create trigger broadcast_friendship_invalidation
after insert or update or delete on public.friendships
for each row execute function private.broadcast_friendship_invalidation();

create or replace function private.broadcast_planned_visit_invalidation()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_row public.planned_visits;
begin
  if tg_op = 'DELETE' then v_row := old; else v_row := new; end if;

  perform private.send_invalidation(
    'court:' || v_row.court_id::text, 'planned_visits', tg_op
  );
  perform private.send_invalidation(
    'user:' || v_row.user_id::text, 'planned_visits', tg_op
  );
  if v_row.visibility = 'public' then
    perform private.send_market_invalidation(
      v_row.court_id, 'planned_visits', tg_op
    );
  end if;
  if tg_op = 'UPDATE' and old.court_id is distinct from new.court_id then
    perform private.send_invalidation(
      'court:' || old.court_id::text, 'planned_visits', tg_op
    );
  end if;
  if tg_op = 'UPDATE' and old.visibility = 'public'
     and (old.court_id is distinct from new.court_id
          or new.visibility <> 'public') then
    perform private.send_market_invalidation(
      old.court_id, 'planned_visits', tg_op
    );
  end if;
  return v_row;
end
$$;

revoke execute on function private.broadcast_planned_visit_invalidation()
  from public, anon, authenticated;
drop trigger if exists broadcast_planned_visit_invalidation on public.planned_visits;
create trigger broadcast_planned_visit_invalidation
after insert or update or delete on public.planned_visits
for each row execute function private.broadcast_planned_visit_invalidation();

create or replace function private.broadcast_activity_event_invalidation()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_row public.activity_events;
begin
  if tg_op = 'DELETE' then v_row := old; else v_row := new; end if;

  if v_row.court_id is not null then
    perform private.send_invalidation(
      'court:' || v_row.court_id::text, 'activity_events', tg_op
    );
    if v_row.visibility = 'public' then
      perform private.send_market_invalidation(
        v_row.court_id, 'activity_events', tg_op
      );
    end if;
  end if;
  if v_row.actor_id is not null then
    perform private.send_invalidation(
      'user:' || v_row.actor_id::text, 'activity_events', tg_op
    );
  end if;
  -- UPDATE can remove a previously visible row from an old court/market/user.
  -- Invalidating only NEW would leave the old scoped feed stale indefinitely.
  if tg_op = 'UPDATE' then
    if old.court_id is not null
       and old.court_id is distinct from new.court_id then
      perform private.send_invalidation(
        'court:' || old.court_id::text, 'activity_events', tg_op
      );
    end if;
    if old.court_id is not null
       and old.visibility = 'public'
       and (old.court_id is distinct from new.court_id
            or new.visibility <> 'public') then
      perform private.send_market_invalidation(
        old.court_id, 'activity_events', tg_op
      );
    end if;
    if old.actor_id is not null
       and old.actor_id is distinct from new.actor_id then
      perform private.send_invalidation(
        'user:' || old.actor_id::text, 'activity_events', tg_op
      );
    end if;
  end if;
  return v_row;
end
$$;

revoke execute on function private.broadcast_activity_event_invalidation()
  from public, anon, authenticated;
drop trigger if exists broadcast_activity_event_invalidation on public.activity_events;
create trigger broadcast_activity_event_invalidation
after insert or update or delete on public.activity_events
for each row execute function private.broadcast_activity_event_invalidation();

create or replace function private.broadcast_activity_like_invalidation()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_row public.activity_event_likes;
  v_event public.activity_events;
begin
  if tg_op = 'DELETE' then v_row := old; else v_row := new; end if;

  select * into v_event
  from public.activity_events e where e.id = v_row.activity_event_id;

  perform private.send_invalidation(
    'user:' || v_row.user_id::text, 'activity_event_likes', tg_op
  );
  if v_event.actor_id is not null and v_event.actor_id <> v_row.user_id then
    perform private.send_invalidation(
      'user:' || v_event.actor_id::text, 'activity_event_likes', tg_op
    );
  end if;
  if v_event.court_id is not null then
    perform private.send_invalidation(
      'court:' || v_event.court_id::text, 'activity_event_likes', tg_op
    );
    if v_event.visibility = 'public' then
      perform private.send_market_invalidation(
        v_event.court_id, 'activity_event_likes', tg_op
      );
    end if;
  end if;
  return v_row;
end
$$;

revoke execute on function private.broadcast_activity_like_invalidation()
  from public, anon, authenticated;
drop trigger if exists broadcast_activity_like_invalidation on public.activity_event_likes;
create trigger broadcast_activity_like_invalidation
after insert or delete on public.activity_event_likes
for each row execute function private.broadcast_activity_like_invalidation();

commit;
