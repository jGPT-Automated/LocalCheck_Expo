# Supabase workflow

Supabase `LocalCheckProd` (`qkrnmyexzvaxiqfxwwfb`) is the only backend.

```text
supabase/
  config.toml          local project configuration
  migrations/         immutable ordered schema history
  functions/          Edge Function source
  tests/database/      SQL authorization and contract specifications
  seed.sql             safe local-only seed entry point
```

The migration files through `20260804125610` were reconciled from the live
production `supabase_migrations.schema_migrations` ledger. Files dated
`20260810200103` and later are PR #28 release-candidate source and are not yet
applied. Never rename, edit, or replay an applied file as a new change.

## Ground every backend change

Before editing migration or function source, inspect `LocalCheckProd` read-only:

- confirm project ref `qkrnmyexzvaxiqfxwwfb` is active;
- compare the live migration ledger with `supabase/migrations/`;
- inspect the affected tables, columns, functions, policies, extensions, and
  deployed Edge Functions;
- state which proposed files are already deployed and which remain source-only.

Read-only inspection is grounding, not release authorization. Do not create a
new backend environment, apply SQL, deploy a function, change secrets, or alter
project settings unless the task explicitly authorizes that external action.

## Create a change

```bash
npx supabase migration new <short_description>
```

Write one forward migration. Include RLS, grants, indexes, Realtime/publication
effects, and recovery notes as part of the same pull request. Compare it with
the verified live contract, run focused source/unit checks, and document the
intended-user and denied-user acceptance cases. Migration apply, function
deploy, and production-secret changes require explicit release authorization.

## Edge Functions

Keep service-role and provider secrets in Supabase; public Expo variables never
contain them. Test pure request/delivery logic from source. After explicit
release approval, deploy one named function at a time and verify its
authenticated and unauthorized paths.

PR #28 adds two functions:

- `verify-court` requires the caller's user JWT, validates a submitted court
  photo with Gemini, and delegates the write to the service-role-only
  `create_verified_court` database function.
- `send-notification` accepts only the private database webhook secret. It
  atomically claims queued inbox rows, stores Expo tickets, checks receipts,
  retries bounded transient failures, and removes tokens Expo marks invalid.

The notification webhook URL and shared secret live in Supabase Vault. Public
Expo variables and migration source never contain the secret. A recurring
cold-worker job provides recovery in addition to the insert webhook, so a
temporary delivery failure does not strand inbox rows.

## PR #28 additive migrations

- `20260810200103_add_verified_court_creation.sql`: daily quota, market bounds,
  150m duplicate rejection, advisory locking, and atomic court creation.
- `20260810200110_add_user_safety_controls.sql`: block/report storage,
  filtering, RLS, grants, and write guards.
- `20260810200118_complete_sport_elo_review.sql`: basketball/pickleball ratings,
  pending review, confirm/reject, and three-day automatic confirmation.
- `20260810200126_complete_push_delivery.sql`: durable claims, delivery
  attempts, webhook dispatch, and recurring recovery.

These files are source-only until the release approval gate. Their presence in
Git does not mean they are deployed or production-proven.

## Realtime and API safety

Realtime schema access is locked down; LocalCheck uses private scoped Broadcast
topics. Do not enable broad public Postgres Changes. Treat Data API exposure as
explicit: client-visible tables need deliberate grants and RLS, while internal
tables should remain outside exposed schemas or inaccessible to client roles.
