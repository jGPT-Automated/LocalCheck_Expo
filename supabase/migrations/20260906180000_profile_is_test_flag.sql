-- profiles.is_test — QA/burner account marker.
--
-- Every account created before public launch is a test/QA account. Rather than
-- delete that data (which would cascade real match history off the accounts we
-- keep for App Review), we flag it and filter it out of the leaderboard and
-- court rosters in the client.
--
--   is_test = true   hidden from leaderboards + rosters; never counts toward the
--                    founding cohort; still fully usable for testing.
--   is_test = false  a real player (the default for every new sign-up).
--
-- Server-managed only: no UPDATE grant to authenticated, so a user cannot
-- unflag themselves. Toggle from the SQL console / admin as accounts are
-- reclassified. Forward-only, additive.

begin;

alter table public.profiles
  add column if not exists is_test boolean not null default false;

comment on column public.profiles.is_test is
  'QA/burner account. Excluded from leaderboards and rosters by the client; excluded from the founding cohort. New real sign-ups default false.';

-- Backfill: everything that exists right now is a test account.
update public.profiles set is_test = true where is_test = false;

create index if not exists profiles_is_test_idx on public.profiles (is_test)
  where is_test = false;

commit;
