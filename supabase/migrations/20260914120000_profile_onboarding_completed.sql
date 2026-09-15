-- Tracks whether a user has finished the post-signup onboarding flow (claim
-- username + pick a sport, then share location or enter a ZIP). The client
-- also gates onboarding on how recently the profile was created, so a delay
-- applying this migration cannot retroactively put an existing account
-- through onboarding — but the flag is still what lets a fresh signup who
-- backgrounds mid-flow resume correctly, and stops it from ever reappearing
-- once finished.
--
-- Existing rows are backfilled true first (onboarding never applies
-- retroactively), then the default flips to false for every signup after.

alter table public.profiles
  add column onboarding_completed boolean not null default true;

alter table public.profiles
  alter column onboarding_completed set default false;

grant update (onboarding_completed)
  on table public.profiles
  to authenticated;
