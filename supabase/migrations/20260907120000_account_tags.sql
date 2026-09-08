-- profiles.account_tag — the single account classification tag.
-- Canonical runbook: docs/runbooks/ACCOUNT_TAGS.md
--
--   FOUNDER   the maker(s). Permanent LocalPlus. Shown and ranked.
--   STARTER   first 100 real sign-ups post-launch. One free year of LocalPlus.
--   REVIEWER  Apple App Review's account. Hidden from other users' leaderboards.
--   TEST      QA / burner account. Hidden from other users' leaderboards.
--   (null)    an ordinary player. The leaderboard shows their earned ELO tier.
--
-- Replaces the two ad-hoc booleans this repo shipped first:
--   is_test           (migration 20260906180000)
--   is_founding_member (migration 20260906103003)
-- One column, one meaning, one UPDATE to change a tag. Server-managed: there is
-- NO UPDATE grant to `authenticated`, so a user cannot set their own tag — it is
-- changed from the SQL console per docs/runbooks/ACCOUNT_TAGS.md. Forward-only, additive
-- except for dropping the two retired booleans.

begin;

alter table public.profiles
  add column if not exists account_tag text
  check (account_tag in ('FOUNDER', 'STARTER', 'REVIEWER', 'TEST'));

comment on column public.profiles.account_tag is
  'Account classification tag. See docs/runbooks/ACCOUNT_TAGS.md. One of FOUNDER | STARTER | REVIEWER | TEST, or null for an ordinary player.';

-- Carry the is_test flag over 1:1.
update public.profiles set account_tag = 'TEST' where is_test = true;

-- Retire the booleans this column replaces.
drop index if exists public.profiles_is_test_idx;
alter table public.profiles drop column if exists is_test;
alter table public.profiles drop column if exists is_founding_member;

create index if not exists profiles_account_tag_idx
  on public.profiles (account_tag) where account_tag is not null;

commit;
