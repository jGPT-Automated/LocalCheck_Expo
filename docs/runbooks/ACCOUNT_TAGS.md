# Account tags — the one runbook

`profiles.account_tag` is the **single** classification tag on an account. One
tag per account, or `null` for an ordinary player. This file is the whole
contract: what the tags mean, everywhere they are read, and the exact SQL to
add / change / remove them. You should not need to read anything else.

- Backend: Supabase `LocalCheckProd`, ref `qkrnmyexzvaxiqfxwwfb`
  → https://supabase.com/dashboard/project/qkrnmyexzvaxiqfxwwfb/sql/new
- Column: `public.profiles.account_tag text`, `CHECK (account_tag in ('FOUNDER','STARTER','REVIEWER','TEST'))`, nullable.
- Introduced by migration `supabase/migrations/20260907120000_account_tags.sql`
  (replaced the earlier `is_test` and `is_founding_member` booleans).
- **Server-managed.** There is no `UPDATE` grant to `authenticated` — a user
  cannot set their own tag. All changes are made from the SQL console below.

## The tags

| Tag | Meaning | Leaderboard | LocalPlus | Avatar | ME-tab title |
|-----|---------|-------------|-----------|--------|--------------|
| `FOUNDER` | The maker(s). | Shown & ranked everywhere | Yes, permanent | Diagonal accent print | `FOUNDER` |
| `STARTER` | First 100 real sign-ups after public launch. | Shown & ranked everywhere | Yes, one year from the user's own `created_at` | Diagonal accent print | `STARTER` |
| `REVIEWER` | Apple App Review's account. | Hidden from **other** users (still sees itself) | Follows real entitlement | Apple mark instead of initials | `REVIEWER` |
| `TEST` | QA / burner account from development. | Hidden from **other** users (still sees itself) | Follows real entitlement | Normal initials | `TEST` |
| `null` | An ordinary player. | Shown & ranked; row shows their earned ELO tier | Only if subscribed | Normal initials | `PROFILE` |

## Everywhere `account_tag` is read (the blast radius)

If you change the set of tags or what one does, these are the only places to
touch. Keep them in sync with the `CHECK` constraint above.

| File | What it does with the tag |
|------|---------------------------|
| `constants/data.ts` | `AccountTag` union type; `playerRankLabel()` — tag wins over the ELO tier label. **The union must match the DB `CHECK`.** |
| `services/profileService.ts` | `SupabaseProfile.account_tag`; `isLeaderboardVisible()` hides `TEST` + `REVIEWER`; `mapProfileToPlayer()` copies it onto `Player.tag`. |
| `context/AuthContext.tsx` | `UserProfile.account_tag` (from `select('*')`). |
| `hooks/useLocalPlus.ts` | `FOUNDER` / `STARTER` ⇒ LocalPlus. |
| `components/PlayerAvatar.tsx` | `FOUNDER`/`STARTER` ⇒ accent print; `REVIEWER` ⇒ Apple mark. |
| `components/ui/ProfileHero.tsx` | passes `tag` through to `PlayerAvatar`. |
| `app/(tabs)/elo.tsx` | screen title = `account_tag ?? "PROFILE"`; passes `tag` to `ProfileHero`. |
| `app/(tabs)/compete.tsx`, `app/(tabs)/feed.tsx` | leaderboard rows: `playerRankLabel()` + tag on the avatar. |
| `app/settings.tsx`, `app/localplus.tsx` | LocalPlus copy for `FOUNDER` / `STARTER`. |

`profiles.is_pro` is **separate** — it is the real paid entitlement, derived by
a DB trigger from `public.subscriptions`. A tag never writes `is_pro`.

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

### Launch day — grant STARTER to the first 100 real sign-ups

Run once, after public launch. `TEST` / `REVIEWER` accounts are skipped; each
STARTER's free year runs from their own `created_at` (a promo `subscriptions`
row is what actually drives `is_pro`).

```sql
with first_100 as (
  select id, created_at
  from public.profiles
  where account_tag is null            -- not TEST / REVIEWER / already tagged
  order by created_at
  limit 100
)
update public.profiles p
set account_tag = 'STARTER'
from first_100 f where f.id = p.id;

insert into public.subscriptions (
  user_id, revenuecat_app_user_id, product_id, entitlement_id,
  status, billing_provider, current_period_starts_at, current_period_ends_at,
  expires_at, raw_payload)
select p.id, p.id::text, 'starter_year_grant', 'localplus',
  'active', 'promo', p.created_at, p.created_at + interval '1 year',
  p.created_at + interval '1 year', jsonb_build_object('grant','starter')
from public.profiles p
where p.account_tag = 'STARTER'
  and not exists (select 1 from public.subscriptions s
                  where s.user_id = p.id and s.product_id = 'starter_year_grant');
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
