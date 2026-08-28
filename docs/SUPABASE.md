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
production `supabase_migrations.schema_migrations` ledger. On 2026-08-11 the
durable push migration `complete_push_delivery` was applied to LocalCheckProd.
Never rename, edit, or replay an applied file as a new change; inspect the live
ledger before describing any other release-candidate migration as deployed.

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

Create one new UTC-timestamped SQL file directly under `supabase/migrations/`;
the filename is `<YYYYMMDDHHMMSS>_<short_description>.sql`. A local Supabase
runtime or CLI is not a prerequisite for authoring or deploying a cloud
migration in this repository.

Write one forward migration. Include RLS, grants, indexes, Realtime/publication
effects, and recovery notes as part of the same pull request. Compare it with
the verified live contract and migration ledger, run focused source/unit
checks, and document the intended-user and denied-user acceptance cases. After
explicit authorization, apply the reviewed file to `LocalCheckProd` through the
connected Supabase migration tool, then verify the resulting cloud schema with
read-only queries. Function deployment and production-secret changes remain
separate explicitly authorized actions.

## Edge Functions

Keep service-role and provider secrets in Supabase; public Expo variables never
contain them. Test pure request/delivery logic from source. After explicit
release approval, deploy one named function at a time and verify its
authenticated and unauthorized paths.

PR #28 added two function sources:

- `verify-court` requires the caller's user JWT, validates a submitted court
  photo with Gemini, and delegates the write to the service-role-only
  `create_verified_court_v2` database function.
- `send-notification` accepts only the private database webhook secret. It
  atomically claims queued inbox rows, stores Expo tickets, checks receipts,
  retries bounded transient failures, and removes tokens Expo marks invalid.

Production status on 2026-08-12:

- `send-notification` version 1 is active. An unauthenticated request returned
  401, while `private.dispatch_push_webhook(null)` reached it through the Vault
  secret and returned HTTP 200 with an empty work claim.
- A real friend-request insert subsequently produced a physical iPhone push,
  proving the registration → database → Edge Function → Expo → APNs path.
- `verify-court` version 2 is active with platform JWT enforcement. Its deployed
  source matches the repository, calls `create_verified_court_v2`, and rejects
  unauthenticated requests with HTTP 401. A signed-in accepted and rejected
  live-photo test remains required to prove the Gemini provider path.

The client fix that unlocked push delivery lives in
`services/pushNotificationService.ts` and `context/NotificationContext.tsx`.
Startup now prompts only when system permission is undetermined, repairs token
registration when an opted-in account already has permission, and does nothing
after LocalCheck opt-out or iOS denial. `getExpoPushTokenAsync` uses the explicit
EAS project id from app configuration.

The notification webhook URL and shared secret live in Supabase Vault. Public
Expo variables and migration source never contain the secret. A recurring
cold-worker job provides recovery in addition to the insert webhook, so a
temporary delivery failure does not strand inbox rows.

## PR #28 additive migrations

- `20260810200103_add_verified_court_creation.sql`: daily quota, market bounds,
  150m duplicate rejection, advisory locking, and atomic court creation.
- `20260812111224_add_user_safety_controls.sql`: block/report storage,
  filtering, RLS, grants, write guards, and caller-scoped blocked-user listing
  for the in-app unblock path.
- `20260810200118_complete_sport_elo_review.sql`: basketball/pickleball ratings,
  pending review, confirm/reject, and three-day automatic confirmation.
- `20260810200126_complete_push_delivery.sql`: durable claims, delivery
  attempts, webhook dispatch, and recurring recovery. This applied file stays
  byte-for-byte immutable.
- `20260812032141_skip_stale_pending_push_notifications.sql`: idempotent source
  migration for retaining pre-push inbox rows while marking them push-skipped,
  preventing a burst of stale alerts after first device registration. It is not
  deployed by this pull request.
- `20260812111025_make_court_access_optional.sql`: preserves every historical
  access value, makes the field optional for new rows, and adds the
  service-role-only `create_verified_court_v2` RPC without an access argument.
- `20260828120000_match_dispute_resolution.sql`: source-only canonical score
  lifecycle. It converts legacy `rejected` rows to a seven-day `held` state,
  adds bounded dispute/revision metadata, participant-authorized approve,
  dispute, and held-game update RPCs, full-roster notifications, and cron-owned
  three-day approval / seven-day void deadlines. It must be applied after the
  participant-review and ad-hoc-team migrations and is not production behavior
  until the live ledger and two-account matrix prove it.

Source presence never proves deployment. `complete_push_delivery`,
`add_user_safety_controls`, and `make_court_access_optional` are present in the
live migration ledger. Push delivery has physical evidence; the safety schema
and new court contract have read-only live-schema evidence. Recheck the live
ledger and function list before asserting future status.

## Realtime and API safety

Realtime schema access is locked down; LocalCheck uses private scoped Broadcast
topics. Do not enable broad public Postgres Changes. Treat Data API exposure as
explicit: client-visible tables need deliberate grants and RLS, while internal
tables should remain outside exposed schemas or inaccessible to client roles.
