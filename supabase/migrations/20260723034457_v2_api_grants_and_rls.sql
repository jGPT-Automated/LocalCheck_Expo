-- Reconstructed from the LocalCheckProd migration ledger on 2026-08-08.
-- This migration is already applied to production. Do not edit it.

-- NOT YET APPLIED.
-- Intended target: LocalCheckProd (qkrnmyexzvaxiqfxwwfb).
-- Explicit Data API grants plus RLS. LocalCheckProd currently inherits broad
-- default ACLs, so every new object is revoked first and then granted only the
-- operations the mobile/web clients require.

begin;

set local lock_timeout = '5s';
set local statement_timeout = '60s';

alter default privileges for role postgres in schema public
  revoke all on tables from public, anon, authenticated;
alter default privileges for role postgres in schema public
  revoke all on sequences from public, anon, authenticated;
alter default privileges for role postgres in schema public
  revoke execute on functions from public, anon, authenticated;

revoke all on table
  public.profiles,
  public.user_settings,
  public.check_ins,
  public.runs,
  public.run_participants,
  public.matches,
  public.match_participants,
  public.friendships,
  public.planned_visits,
  public.activity_events,
  public.activity_event_likes,
  public.subscriptions,
  public.court_metrics
from anon, authenticated;

revoke all on sequence public.activity_events_id_seq from anon, authenticated;

alter table public.profiles enable row level security;
alter table public.user_settings enable row level security;
alter table public.check_ins enable row level security;
alter table public.runs enable row level security;
alter table public.run_participants enable row level security;
alter table public.matches enable row level security;
alter table public.match_participants enable row level security;
alter table public.friendships enable row level security;
alter table public.planned_visits enable row level security;
alter table public.activity_events enable row level security;
alter table public.activity_event_likes enable row level security;
alter table public.subscriptions enable row level security;
alter table public.court_metrics enable row level security;

-- Profiles are social data. There is deliberately no email column; email stays
-- inside Auth/session data. Protected ranking and entitlement columns are not
-- writable through the Data API.
grant select on public.profiles to authenticated;
grant insert (
  id, display_name, username, avatar_url, local_court_id, preferred_sport
) on public.profiles to authenticated;
grant update (
  display_name, username, avatar_url, local_court_id, preferred_sport, updated_at
) on public.profiles to authenticated;

drop policy if exists profiles_select_authenticated on public.profiles;
create policy profiles_select_authenticated
  on public.profiles for select to authenticated
  using (true);

drop policy if exists profiles_insert_self on public.profiles;
create policy profiles_insert_self
  on public.profiles for insert to authenticated
  with check (id = (select auth.uid()));

drop policy if exists profiles_update_self on public.profiles;
create policy profiles_update_self
  on public.profiles for update to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

grant select on public.user_settings to authenticated;
grant insert (
  user_id, push_notifications_enabled, check_in_reminders_enabled,
  game_alerts_enabled, haptics_enabled
) on public.user_settings to authenticated;
grant update (
  push_notifications_enabled, check_in_reminders_enabled,
  game_alerts_enabled, haptics_enabled, updated_at
) on public.user_settings to authenticated;

drop policy if exists user_settings_select_self on public.user_settings;
create policy user_settings_select_self
  on public.user_settings for select to authenticated
  using (user_id = (select auth.uid()));

drop policy if exists user_settings_insert_self on public.user_settings;
create policy user_settings_insert_self
  on public.user_settings for insert to authenticated
  with check (user_id = (select auth.uid()));

drop policy if exists user_settings_update_self on public.user_settings;
create policy user_settings_update_self
  on public.user_settings for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

-- Check-in writes are RPC-only. Reads honor each player's visibility.
grant select on public.check_ins to authenticated;

drop policy if exists check_ins_select_visible on public.check_ins;
create policy check_ins_select_visible
  on public.check_ins for select to authenticated
  using (
    user_id = (select auth.uid())
    or visibility = 'public'
    or (
      visibility = 'friends'
      and exists (
        select 1
        from public.friendships f
        where f.status = 'accepted'
          and (
            (f.requester_id = (select auth.uid()) and f.addressee_id = check_ins.user_id)
            or
            (f.addressee_id = (select auth.uid()) and f.requester_id = check_ins.user_id)
          )
      )
    )
  );

-- Runs and participants are RPC-written. Private/invite-only runs are reserved
-- for a later invitation contract; today only organizer-visible private rows
-- and globally visible open-invite rows are supported.
grant select on public.runs, public.run_participants to authenticated;

drop policy if exists runs_select_visible on public.runs;
create policy runs_select_visible
  on public.runs for select to authenticated
  using (is_open_invite or organizer_id = (select auth.uid()));

drop policy if exists run_participants_select_visible on public.run_participants;
create policy run_participants_select_visible
  on public.run_participants for select to authenticated
  using (
    user_id = (select auth.uid())
    or exists (
      select 1
      from public.runs r
      where r.id = run_participants.run_id
        and (r.is_open_invite or r.organizer_id = (select auth.uid()))
    )
  );

-- Matches are RPC-written. Participants inherit visibility from the match.
grant select on public.matches, public.match_participants to authenticated;

drop policy if exists matches_select_visible on public.matches;
create policy matches_select_visible
  on public.matches for select to authenticated
  using (
    created_by = (select auth.uid())
    or opponent_id = (select auth.uid())
    or (status = 'confirmed' and visibility = 'public')
    or (
      status = 'confirmed'
      and visibility = 'friends'
      and exists (
        select 1
        from public.friendships f
        where f.status = 'accepted'
          and (
            (f.requester_id = (select auth.uid()) and f.addressee_id = matches.created_by)
            or
            (f.addressee_id = (select auth.uid()) and f.requester_id = matches.created_by)
          )
      )
    )
  );

drop policy if exists match_participants_select_visible on public.match_participants;
create policy match_participants_select_visible
  on public.match_participants for select to authenticated
  using (
    user_id = (select auth.uid())
    or exists (
      select 1
      from public.matches m
      where m.id = match_participants.match_id
    )
  );

-- Friendship mutation is RPC-only; each user sees only relationships they are in.
grant select on public.friendships to authenticated;

drop policy if exists friendships_select_participant on public.friendships;
create policy friendships_select_participant
  on public.friendships for select to authenticated
  using (
    requester_id = (select auth.uid())
    or addressee_id = (select auth.uid())
  );

-- Planned visits are safe self-service rows; RLS prevents impersonation.
grant select on public.planned_visits to authenticated;
grant insert (user_id, court_id, planned_at, note, visibility)
  on public.planned_visits to authenticated;
grant update (court_id, planned_at, note, visibility, updated_at)
  on public.planned_visits to authenticated;
grant delete on public.planned_visits to authenticated;

drop policy if exists planned_visits_select_visible on public.planned_visits;
create policy planned_visits_select_visible
  on public.planned_visits for select to authenticated
  using (
    user_id = (select auth.uid())
    or visibility = 'public'
    or (
      visibility = 'friends'
      and exists (
        select 1
        from public.friendships f
        where f.status = 'accepted'
          and (
            (f.requester_id = (select auth.uid()) and f.addressee_id = planned_visits.user_id)
            or
            (f.addressee_id = (select auth.uid()) and f.requester_id = planned_visits.user_id)
          )
      )
    )
  );

drop policy if exists planned_visits_insert_self on public.planned_visits;
create policy planned_visits_insert_self
  on public.planned_visits for insert to authenticated
  with check (user_id = (select auth.uid()));

drop policy if exists planned_visits_update_self on public.planned_visits;
create policy planned_visits_update_self
  on public.planned_visits for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

drop policy if exists planned_visits_delete_self on public.planned_visits;
create policy planned_visits_delete_self
  on public.planned_visits for delete to authenticated
  using (user_id = (select auth.uid()));

-- Activity is trigger/RPC-written and keyset-paginated by (occurred_at, id).
grant select on public.activity_events to authenticated;

drop policy if exists activity_events_select_visible on public.activity_events;
create policy activity_events_select_visible
  on public.activity_events for select to authenticated
  using (
    actor_id = (select auth.uid())
    or visibility = 'public'
    or (
      visibility = 'friends'
      and exists (
        select 1
        from public.friendships f
        where f.status = 'accepted'
          and (
            (f.requester_id = (select auth.uid()) and f.addressee_id = activity_events.actor_id)
            or
            (f.addressee_id = (select auth.uid()) and f.requester_id = activity_events.actor_id)
          )
      )
    )
  );

grant select, insert, delete on public.activity_event_likes to authenticated;

drop policy if exists activity_event_likes_select_visible on public.activity_event_likes;
create policy activity_event_likes_select_visible
  on public.activity_event_likes for select to authenticated
  using (
    exists (
      select 1
      from public.activity_events e
      where e.id = activity_event_likes.activity_event_id
    )
  );

drop policy if exists activity_event_likes_insert_self on public.activity_event_likes;
create policy activity_event_likes_insert_self
  on public.activity_event_likes for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and exists (
      select 1
      from public.activity_events e
      where e.id = activity_event_likes.activity_event_id
    )
  );

drop policy if exists activity_event_likes_delete_self on public.activity_event_likes;
create policy activity_event_likes_delete_self
  on public.activity_event_likes for delete to authenticated
  using (user_id = (select auth.uid()));

-- Entitlements and raw provider payloads are service-role/webhook-only. The
-- client reads the derived profiles.is_pro flag, never this table directly.
drop policy if exists subscriptions_select_self on public.subscriptions;

-- Aggregate counts contain no user identity and remain available to the public
-- website. No client role receives any write privilege.
grant select on public.court_metrics to anon, authenticated;

drop policy if exists court_metrics_select_public on public.court_metrics;
create policy court_metrics_select_public
  on public.court_metrics for select to anon, authenticated
  using (true);

commit;

