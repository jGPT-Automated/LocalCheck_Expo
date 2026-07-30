-- Account-deletion foreign-key contract for LocalCheckProd v2.
--
-- User-owned rows are removed with the profile. Historical/public objects that
-- should remain lose only their author pointer. This matches the read-only
-- production constraint audit performed on 2026-07-29 and makes the recovery
-- migrations reproduce that behavior instead of relying on dashboard drift.

begin;

alter table public.profiles
  drop constraint if exists profiles_id_fkey,
  add constraint profiles_id_fkey
    foreign key (id) references auth.users(id) on delete cascade;

alter table public.courts
  alter column added_by drop not null,
  drop constraint if exists courts_added_by_fkey,
  add constraint courts_added_by_fkey
    foreign key (added_by) references auth.users(id) on delete set null;

alter table public.activity_events
  drop constraint if exists activity_events_actor_id_fkey,
  add constraint activity_events_actor_id_fkey
    foreign key (actor_id) references public.profiles(id) on delete set null;

alter table public.activity_event_likes
  drop constraint if exists activity_event_likes_user_id_fkey,
  add constraint activity_event_likes_user_id_fkey
    foreign key (user_id) references public.profiles(id) on delete cascade;

alter table public.check_ins
  drop constraint if exists check_ins_user_id_fkey,
  add constraint check_ins_user_id_fkey
    foreign key (user_id) references public.profiles(id) on delete cascade;

alter table public.friendships
  drop constraint if exists friendships_requester_id_fkey,
  add constraint friendships_requester_id_fkey
    foreign key (requester_id) references public.profiles(id) on delete cascade,
  drop constraint if exists friendships_addressee_id_fkey,
  add constraint friendships_addressee_id_fkey
    foreign key (addressee_id) references public.profiles(id) on delete cascade;

alter table public.match_participants
  drop constraint if exists match_participants_user_id_fkey,
  add constraint match_participants_user_id_fkey
    foreign key (user_id) references public.profiles(id) on delete cascade;

alter table public.matches
  drop constraint if exists matches_created_by_fkey,
  add constraint matches_created_by_fkey
    foreign key (created_by) references public.profiles(id) on delete cascade,
  drop constraint if exists matches_opponent_id_fkey,
  add constraint matches_opponent_id_fkey
    foreign key (opponent_id) references public.profiles(id) on delete cascade;

alter table public.planned_visits
  drop constraint if exists planned_visits_user_id_fkey,
  add constraint planned_visits_user_id_fkey
    foreign key (user_id) references public.profiles(id) on delete cascade;

alter table public.run_participants
  drop constraint if exists run_participants_user_id_fkey,
  add constraint run_participants_user_id_fkey
    foreign key (user_id) references public.profiles(id) on delete cascade;

alter table public.runs
  drop constraint if exists runs_organizer_id_fkey,
  add constraint runs_organizer_id_fkey
    foreign key (organizer_id) references public.profiles(id) on delete cascade;

alter table public.subscriptions
  drop constraint if exists subscriptions_user_id_fkey,
  add constraint subscriptions_user_id_fkey
    foreign key (user_id) references public.profiles(id) on delete cascade;

alter table public.user_settings
  drop constraint if exists user_settings_user_id_fkey,
  add constraint user_settings_user_id_fkey
    foreign key (user_id) references public.profiles(id) on delete cascade;

commit;
