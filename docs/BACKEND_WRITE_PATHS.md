# Backend write paths (LocalCheckProd)

Last verified: 2026-07-27 against `qkrnmyexzvaxiqfxwwfb` by direct inspection.

Read this before writing any client code that mutates data. Four shipped
features were silently broken because client code wrote to tables it has no
privilege to write.

## Why this file exists

LocalCheckProd is a **v2 schema** (`v2_core_schema`, `v2_api_grants_and_rls`,
`v2_behavior_rpcs_and_metrics`, applied 2026-07-23). v2 revoked the default
Supabase ACLs and re-granted only what each client operation needs. Most
behaviour goes through `SECURITY DEFINER` RPCs; a small number of tables keep
narrow, **column-level** direct grants.

Two traps follow from that, and both bit us:

1. **Column-level grants are invisible in the usual view.**
   `information_schema.role_table_grants` shows only *table-level* grants. A
   table can look SELECT-only there while holding column-level INSERT/UPDATE.
   Use `information_schema.column_privileges`, or `has_column_privilege()`.

2. **`.upsert()` needs UPDATE on every column in the payload.**
   PostgREST compiles upsert to `INSERT … ON CONFLICT DO UPDATE SET <every
   column you sent>`. If one of those columns is not UPDATE-grantable the whole
   statement is rejected with `42501` — before RLS is ever consulted.

`docs/supabase/migrations/20260713_planned_visits.sql` and the other pre-v2
files in that folder were applied to the **old** project
(`jzclwnzcektqhgkkdeje`). They do not describe this database. Do not reason
about current privileges from them.

## The map

| Data | Correct write path | Notes |
| --- | --- | --- |
| Check in / out | `check_in(uuid,text,text)`, `check_out()` | RPC only; `check_ins` is SELECT-only |
| Runs — create | `create_run(...)` | RPC only |
| Runs — join / leave / cancel | `join_run`, `leave_run`, `cancel_run` | RPC only |
| Runs — **edit** | ❌ **none exists** | `runs` is SELECT-only. See broken list |
| Matches | `log_match(...)`, `confirm_match`, `reject_match` | RPC only |
| Friendships | `request_friend`, `accept_friend_request`, `remove_friendship` | RPC only; `friendships` is SELECT-only |
| Planned visits | **direct write**, column-level | INSERT `(user_id, court_id, planned_at, note, visibility)`; UPDATE same **minus `user_id`**; DELETE table-level |
| Activity likes | **direct write** | INSERT + DELETE granted |
| Profiles | **direct write**, column-level | UPDATE on the profile-owned columns |
| User settings | **direct write**, column-level | INSERT + UPDATE |
| Courts — add | ❌ **none exists** | `courts` is SELECT-only. See broken list |

## Planned visits: never use a plain upsert

`authenticated` may INSERT `user_id` (you set your own) but may **not** UPDATE
it (you can never reassign a row to another user). That is deliberate. A plain
upsert tries to update `user_id` and is rejected.

Use `ignoreDuplicates: true`, which compiles to `ON CONFLICT DO NOTHING` and
needs no UPDATE privilege. Posting a planned time is idempotent, so this is
also the correct semantics.

```ts
await supabase.from("planned_visits").upsert(row, {
  onConflict: "user_id,court_id,planned_at",
  ignoreDuplicates: true,
});
```

Postgres's error hint recommends `GRANT UPDATE ON public.planned_visits TO
authenticated`. **Do not do that** — it re-grants `user_id` and undoes the v2
design.

## Friend requests are pending, not instant

`request_friend` inserts `status = 'pending'`. There is no client path that
produces `'accepted'` directly; the addressee must call
`accept_friend_request`. `fetchFriends` filters to `'accepted'`, so a
successful request will **not** appear in the friends list — surface it from
`fetchFriendshipStates` instead, or the button reads as broken.

## Still broken (verified, not yet fixed)

- **Add a Court** — `createCourt` inserts into `courts`, which is SELECT-only,
  and there is no `create_court` RPC. Needs a product decision (moderated
  submission RPC vs. narrow column grants) plus a migration.
- **Edit a Run** — `updateScheduledGame` updates `runs`, which is SELECT-only,
  and there is no update RPC. `cancel_run` exists; editing does not.

## How to check before you write

```sql
-- table-level (incomplete on its own)
select privilege_type from information_schema.role_table_grants
where table_schema='public' and table_name='X' and grantee='authenticated';

-- column-level (the one that actually matters)
select privilege_type, column_name from information_schema.column_privileges
where table_schema='public' and table_name='X' and grantee='authenticated';

-- direct answer for one column
select has_column_privilege('authenticated','public.X','col','UPDATE');
```

To prove a write works before shipping it, run it as `authenticated` inside a
`do $$ … $$` block that ends in `raise exception` — the exception rolls the
transaction back, so nothing persists either way:

```sql
do $$
begin
  perform set_config('role','authenticated', true);
  perform set_config('request.jwt.claims',
    json_build_object('sub','<user-uuid>','role','authenticated')::text, true);
  -- the exact statement the client sends
  raise exception 'rolled back';
end $$;
```

## The failure mode to watch for

Every one of these bugs was invisible because the service layer discarded the
error:

```ts
await supabase.from("friendships").insert({...});   // no `error` destructured
} catch { /* best-effort */ }                        // never fires: supabase-js
                                                     // returns errors, it does
                                                     // not throw
```

Always destructure `error`, always surface it, and never let the UI
optimistically claim a write succeeded before the server confirms it.
