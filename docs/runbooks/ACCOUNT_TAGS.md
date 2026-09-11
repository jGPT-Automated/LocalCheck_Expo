# Account tags — the one runbook

`profiles.account_tag` is a **cosmetic** label on an account — one tag, or
`null` for an ordinary player. It sets the leaderboard row's label, the avatar
treatment, and the ME-tab title. It does **not** grant LocalPlus, change
privacy, or decide who is on the leaderboard. The single exception is one
client switch, `LeaderboardFlags.hideTaggedAccounts` (in `constants/flags.ts`):
when it is on, `TEST` and `REVIEWER` rows are dropped from *other* players'
boards. It is **off** now so QA and App Review see every account.

This file is the whole contract: what the tags mean, everywhere they are read,
and the exact SQL to add / change / remove them.

- Backend: Supabase `LocalCheckProd`, ref `qkrnmyexzvaxiqfxwwfb`
  → https://supabase.com/dashboard/project/qkrnmyexzvaxiqfxwwfb/sql/new
- Column: `public.profiles.account_tag text`, `CHECK (account_tag in ('FOUNDER','STARTER','REVIEWER','TEST'))`, nullable.
- Introduced by migration `supabase/migrations/20260907120000_account_tags.sql`
  (replaced the earlier `is_test` and `is_founding_member` booleans).
- **Server-managed.** There is no `UPDATE` grant to `authenticated` — a user
  cannot set their own tag. All changes are made from the SQL console below.

## The tags

| Tag | Meaning | Row label | Avatar | ME-tab title | On the board? |
|-----|---------|-----------|--------|--------------|---------------|
| `FOUNDER` | The maker(s). | `FOUNDER` | Diagonal accent print | `FOUNDER` | Yes |
| `STARTER` | First 100 real sign-ups after public launch. | `STARTER` | Diagonal accent print | `STARTER` | Yes |
| `REVIEWER` | Apple App Review's account. | `REVIEWER` | Apple mark instead of initials | `REVIEWER` | Yes now; hidden from others when `hideTaggedAccounts` is on |
| `TEST` | QA / burner account. | `TEST` | Normal initials | `TEST` | Yes now; hidden from others when `hideTaggedAccounts` is on |
| `null` | An ordinary player. | their earned ELO tier | Normal initials | `PROFILE` | Yes |

Independent of the tag, a profile is only ranked in a sport after **≥1 game**
in that sport (`hasRankedGame` in `services/profileService.ts`), and privacy
(`profiles.visibility`) and the LocalPlus gate still apply.

**LocalPlus is not a tag.** `useLocalPlus()` reads `is_pro` only, which the
`private.sync_profile_is_pro` trigger derives from `public.subscriptions` — the
tag never grants anything by itself. The two cohorts get there differently:

- **FOUNDER** — a promo row in `public.subscriptions`
  (`billing_provider='promo'`), inserted directly (step 3 below).
- **STARTER** — redeems one of the 100 first-100 Apple offer codes (see
  `docs/runbooks/REVENUECAT.md` Phase 5). That's a **real App Store
  subscription** (`billing_provider='app_store'`), reported through the
  `revenuecat-webhook` like any other purchase — no manual SQL. It auto-renews
  at $4.99/mo after the free year unless the user cancels; `account_tag` is
  set at signup time (step 2 below) purely as the row label, independent of
  when/whether they redeem a code.

## Everywhere `account_tag` is read (the blast radius)

If you change the set of tags or what one does, these are the only places to
touch. Keep them in sync with the `CHECK` constraint above.

| File | What it does with the tag |
|------|---------------------------|
| `constants/data.ts` | `AccountTag` union type; `playerRankLabel()` — tag wins over the ELO tier label. **The union must match the DB `CHECK`.** |
| `constants/flags.ts` | `LeaderboardFlags.hideTaggedAccounts` — the one functional switch (off now). |
| `services/profileService.ts` | `SupabaseProfile.account_tag`; `isLeaderboardVisible()` drops `TEST` + `REVIEWER` **only when `hideTaggedAccounts` is on**; `mapProfileToPlayer()` copies it onto `Player.tag`. (`hasRankedGame()` — the ≥1-game rule — is separate, not tag-driven.) |
| `context/AuthContext.tsx` | `UserProfile.account_tag` (from `select('*')`). |
| `components/PlayerAvatar.tsx` | `FOUNDER`/`STARTER` ⇒ accent print; `REVIEWER` ⇒ Apple mark. |
| `components/ui/ProfileHero.tsx` | passes `tag` through to `PlayerAvatar`. |
| `app/(tabs)/elo.tsx` | screen title = `account_tag ?? "PROFILE"`; passes `tag` to `ProfileHero`. |
| `app/(tabs)/compete.tsx`, `app/(tabs)/feed.tsx` | leaderboard rows: `playerRankLabel()` + tag on the avatar. |
| `app/settings.tsx`, `app/localplus.tsx` | LocalPlus *copy* wording for `FOUNDER` / `STARTER` (gated by `useLocalPlus()`, not by the tag). |

`useLocalPlus()` does **not** read `account_tag`. `profiles.is_pro` — the real
entitlement, trigger-derived from `public.subscriptions` — is what it checks. A
tag never writes `is_pro`.

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

Three things, in order.

**1. Hide the dev/review accounts from real players.** In `constants/flags.ts`,
set `LeaderboardFlags.hideTaggedAccounts = true` and ship it (OTA or build).
`TEST` and `REVIEWER` rows drop off everyone else's boards; they still see their
own.

**2. Grant STARTER to the first 100 real sign-ups.** Run once. `TEST` /
`REVIEWER` / already-tagged accounts are skipped. Each free year runs from that
user's own `created_at`; the promo `subscriptions` row (not the tag) drives
`is_pro`, and it **expires** — after a year `is_pro` flips back to false.

```sql
with first_100 as (
  select id, created_at
  from public.profiles
  where account_tag is null            -- not FOUNDER / TEST / REVIEWER / STARTER
  order by created_at
  limit 100
)
update public.profiles p
set account_tag = 'STARTER'
from first_100 f where f.id = p.id;
```

**3. Grant the free entitlement to FOUNDER.** One promo row, a long horizon
(renew or drop the row later). **Not** for STARTER — their free year comes from
redeeming an Apple offer code (a real, separate `billing_provider='app_store'`
row the webhook writes; running this for STARTER too would leave them with two
simultaneous lineages for no reason). The unique key is
`(user_id, billing_provider)`, so this insert can never collide with a real
subscription row on the same person either way.

```sql
insert into public.subscriptions (
  user_id, revenuecat_app_user_id, product_id, entitlement_id,
  status, billing_provider, current_period_starts_at, current_period_ends_at,
  expires_at, raw_payload)
select p.id, p.id::text, 'founder_grant',
  'localplus', 'active', 'promo',
  p.created_at,
  p.created_at + interval '100 years',
  p.created_at + interval '100 years',
  jsonb_build_object('grant', 'founder')
from public.profiles p
where p.account_tag = 'FOUNDER'
on conflict (user_id, billing_provider) do nothing;
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
