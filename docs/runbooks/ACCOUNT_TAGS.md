# Account tags and test data — the one runbook

`profiles.account_tag` is one tag per account, or `null` for an ordinary
player. Since migration `20261008120000_hide_test_accounts_and_courts.sql`
(D34) it does two jobs:

1. **Who real players can see.** `TEST` and `REVIEWER` accounts are *hidden*:
   the database never returns them, or their games, check-ins, plans, runs or
   feed posts, to an ordinary player. Test courts (`courts.is_test`) are
   hidden the same way.
2. **Who sees the test data.** `TEST`, `REVIEWER` and `FOUNDER` accounts are
   *insiders*: they see everything, so dev work, game-logging tests and App
   Review all have a populated app. Every new sign-up is an ordinary player
   and gets the real view.

It still sets the leaderboard label and ME-tab title for `FOUNDER` / `STARTER`
only. It never grants LocalPlus by itself.

This file is the whole contract: what the tags mean, where they are read,
the test courts, and the exact SQL to change any of it.

- Backend: Supabase `LocalCheckProd`, ref `qkrnmyexzvaxiqfxwwfb`
  → https://supabase.com/dashboard/project/qkrnmyexzvaxiqfxwwfb/sql/new
- Column: `public.profiles.account_tag text`, `CHECK (account_tag in ('FOUNDER','STARTER','REVIEWER','TEST'))`, nullable.
- **Server-managed.** No `UPDATE` grant to `authenticated`: a user cannot set
  their own tag. Change tags from the SQL editor below.

## The tags

| Tag | Meaning | Real players see them? | Sees test data? | Row label / ME title | Avatar |
|-----|---------|------------------------|-----------------|----------------------|--------|
| `FOUNDER` | Jesse. | Yes | Yes | `FOUNDER` | Diagonal accent print |
| `STARTER` | First 100 real sign-ups. | Yes | No | `STARTER` | Diagonal accent print |
| `REVIEWER` | Apple App Review's account (`APPLE`). | No | Yes | Tier / `PROFILE` | Normal initials |
| `TEST` | QA / dev account. Every pre-launch account but JESSE and APPLE. | No | Yes | Tier / `PROFILE` | Normal initials |
| `null` | An ordinary player. | Yes | No | Tier / `PROFILE` | Normal initials |

A profile is ranked in a sport only after **≥1 game** in it
(`hasRankedGame`), and only with LocalPlus (`LocalPlusFlags.gateLeaderboard`,
on; LocalLite stays unranked). `TEST` rows count as LocalPlus on the board,
matching `useLocalPlus()`. Privacy (`profiles.visibility`) still applies.

**LocalPlus is not a tag.** `profiles.is_pro` is derived from
`public.subscriptions` by the `private.sync_profile_is_pro` trigger. FOUNDER
and REVIEWER hold `promo` rows (granted, see step 3 below). `useLocalPlus()`
also treats `TEST` as LocalPlus so testers reach every surface.

## Test courts

Insiders only (`courts.is_test = true`). Two cities, two courts each, one per
sport, so location, leaderboards and court explore can be tested:

| City | Basketball | Pickleball |
|------|------------|------------|
| Los Angeles | Rancho Cienega Sports Complex `7831e524-8ee8-47a3-9a11-7dae16ff22bb` | Cheviot Hills Recreation Center `fd528863-bbda-460c-ba5e-428ca5fae940` |
| Houston | Fonde Recreation Center `15fb6104-9743-4a1e-ae64-6487539730b3` | Jaycee Park Pickleball Courts `3bc01099-488e-4dd2-8d4c-3c18ff314d59` |

The only real court at launch is **Kasmiersky Park**, Conroe
(`abe05196-a2d2-469e-b919-0435a056d9a3`). Every other seeded court is archived
(`is_archived = true`, hidden from everyone, reversible).

Rules for testers:

- Test on the four test courts. A check-in or local court set at a *real*
  court still counts in that court's public numbers (`court_metrics`), even
  though the tester is hidden.
- New-court duplicate checks skip test courts, so a real player can add the
  real Fonde Rec next to the test one.

## How the hiding works (database)

Helpers in the `private` schema, all `security definer`, execute granted to
`authenticated` only:

- `private.viewer_sees_test_data()` — the signed-in viewer is an insider.
- `private.is_hidden_account(user_id)` — tag is `TEST` or `REVIEWER`.
- `private.is_test_court(court_id)` — court is test or archived.
- `private.match_has_hidden_player(match_id)` — any player in the game is hidden.

Each read policy keeps its rule and adds: *you own it, or you're an insider,
or it has no hidden account and no test court.* Covered: `profiles`,
`check_ins`, `planned_visits`, `runs`, `activity_events`, `matches` (and,
through them, `match_participants`, `run_participants`,
`activity_event_likes`), `courts` (signed-in and anonymous; `courts_with_stats`
is `security_invoker`). A player always keeps seeing their own games.

Because the database does this, the client has no hide switch; the old
`LeaderboardFlags.hideTaggedAccounts` was removed.

## Everywhere `account_tag` is read (the blast radius)

| File | What it does with the tag |
|------|---------------------------|
| `supabase/migrations/20261008120000_hide_test_accounts_and_courts.sql` | Hidden / insider rules (see above). |
| `constants/data.ts` | `AccountTag` union (**must match the DB `CHECK`**); `displayTag()` (FOUNDER / STARTER only); `playerRankLabel()`. |
| `services/profileService.ts` | `mapProfileToPlayer()` sets `Player.tag = displayTag(...)`; `isLeaderboardVisible()` counts `TEST` as LocalPlus under the gate. |
| `hooks/useLocalPlus.ts` | `TEST` ⇒ LocalPlus. |
| `context/AuthContext.tsx` | `UserProfile.account_tag` (from `select('*')`). |
| `components/PlayerAvatar.tsx` | `FOUNDER` / `STARTER` ⇒ accent print. |
| `app/(tabs)/elo.tsx` | ME title = `displayTag(account_tag) ?? "PROFILE"`. |
| `app/settings.tsx`, `app/localplus.tsx` | LocalPlus copy for `FOUNDER` / `STARTER`. |

## Operations — copy, paste, run

### See who has what

```sql
select account_tag, count(*), string_agg(username, ', ' order by username)
from public.profiles group by 1 order by 1;
```

### Tag one account

```sql
-- by profile id
update public.profiles set account_tag = 'FOUNDER' where id = '00000000-0000-0000-0000-000000000000';

-- by current username
update public.profiles set account_tag = 'TEST' where lower(username) = 'someburner';

-- by login email (profiles has no email column; go through auth.users)
update public.profiles set account_tag = 'REVIEWER'
where id = (select id from auth.users where lower(email) = 'apple@test.com');
```

### Rename + tag in one go (e.g. the reviewer account)

```sql
update public.profiles
set account_tag = 'REVIEWER', username = 'APPLE', display_name = 'APPLE'
where id = (select id from auth.users where lower(email) = 'apple@test.com');
```

### Change or clear a tag

```sql
update public.profiles set account_tag = 'STARTER' where id = '…';  -- change
update public.profiles set account_tag = null      where id = '…';  -- back to ordinary player
```

### Launch day

Test accounts are already hidden (D34); there is no flag to flip.

**1. Before submitting:** confirm the tags and courts.

```sql
select account_tag, count(*) from public.profiles group by 1 order by 1;
select is_test, is_archived, count(*) from public.courts group by 1, 2;
```

Expected: only JESSE (`FOUNDER`) and APPLE (`REVIEWER`) are not `TEST`;
four test courts; Kasmiersky the one live real court.

**2. Starter (D12, not built yet).** The first 100 real sign-ups get a free
year automatically, server-side, no code. Until that ships, run this once
after launch: `TEST` / `REVIEWER` / already-tagged accounts are skipped.

```sql
with first_100 as (
  select id, created_at
  from public.profiles
  where account_tag is null
  order by created_at
  limit 100
)
update public.profiles p
set account_tag = 'STARTER'
from first_100 f where f.id = p.id;
```

**3. FOUNDER and REVIEWER grants** (already applied; safe to re-run). One
promo row each; the unique key `(user_id, billing_provider)` means it never
collides with a real subscription.

```sql
insert into public.subscriptions (
  user_id, revenuecat_app_user_id, product_id, entitlement_id,
  status, billing_provider, current_period_starts_at, current_period_ends_at,
  expires_at, raw_payload)
select p.id, p.id::text,
  lower(p.account_tag) || '_grant',
  'localplus', 'active', 'promo',
  p.created_at,
  p.created_at + interval '100 years',
  p.created_at + interval '100 years',
  jsonb_build_object('grant', lower(p.account_tag))
from public.profiles p
where p.account_tag in ('FOUNDER', 'REVIEWER')
on conflict (user_id, billing_provider) do nothing;
```

### Make a new test account

Sign up normally, then tag it. It disappears for real players at once and
starts seeing test data.

```sql
update public.profiles set account_tag = 'TEST' where lower(username) = 'newtester';
update public.profiles set local_court_id = '15fb6104-9743-4a1e-ae64-6487539730b3'  -- Fonde Rec
where lower(username) = 'newtester';
```

### Test courts: add, remove, restore

```sql
update public.courts set is_test = true  where id = '…';   -- insiders only
update public.courts set is_test = false where id = '…';   -- real, everyone sees it
update public.courts set is_archived = false where id = '…'; -- bring back an archived court
```

### Add a brand-new tag value (e.g. `CHAMPION`)

Three edits, in this order:

1. **DB** — new migration `supabase/migrations/<UTC>_account_tag_champion.sql`:
   ```sql
   alter table public.profiles drop constraint profiles_account_tag_check;
   alter table public.profiles add constraint profiles_account_tag_check
     check (account_tag in ('FOUNDER','STARTER','REVIEWER','TEST','CHAMPION'));
   ```
   then apply it (Supabase MCP `apply_migration`, or the dashboard SQL editor).
2. **Type** — add `"CHAMPION"` to the `AccountTag` union in `constants/data.ts`.
3. **Behaviour** — decide leaderboard visibility / LocalPlus / avatar for it in
   the files listed in the blast-radius table, and add a row to *this* file.

### Remove a tag value

Clear it off every account first (`update … set account_tag = null where account_tag = 'X'`),
then tighten the `CHECK` in a new migration and drop `"X"` from the union.

## Future: multi-tag accolades

This column is deliberately one exclusive tag. Earned accolades that stack
(tournament wins, streak badges, profile-square graphics) are a **separate**
future concern — a `profiles.badges text[]` or a `profile_badges` join table —
and do not change this contract. Do not overload `account_tag` for them.

## Keep this file honest

The `AccountTag` union in `constants/data.ts`, the `CHECK` constraint in the
database, and the tag table above must always agree. Any change to tags updates
all three in the same pull request, and links this file in the PR body.
