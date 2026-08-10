# Current state

Last reconciled: 2026-08-09 against the MVP visual-consolidation branch and the
live LocalCheckProd migration ledger. Reconfirm the exact `main` SHA after the
pull request merges.

## Production checkpoint

- iOS/TestFlight checkpoint: app `1.0.1`, build `13`, release tag `v1.0.5`.
- EAS project: `agenticjess-os/localcheck`
  (`9c906173-0258-45a9-a3fe-786cda373c66`).
- Supabase production project: `qkrnmyexzvaxiqfxwwfb`.
- Installed binaries use EAS Update with `runtimeVersion.policy = appVersion`.
- Production OTA rollback remains available through EAS Update republish.

## Current product contract

- Authentication: email/password and Apple Sign-In.
- Discovery: court list/search plus native Mapbox map.
- Presence: atomic check-in switching and server-driven expiration.
- Schedule: planned visits and hosted runs.
- Social: profiles, friendships, feed activity, notifications.
- Competition: sport-specific ELO and reviewed match lifecycle.
- Realtime: private scoped Broadcast invalidation followed by authoritative
  refetch.

All durable product state comes from Supabase. There is no application API
server or local-data fallback. The Expo browser target renders this same app for
development and testing.

## Known release risks

- Mapbox, push notifications, Apple Sign-In, and SecureStore require physical
  iOS verification; browser success does not prove them.
- Add Court is intentionally absent. The retired UI called a dead `/api` route;
  it must not return until an approved Supabase creation contract and RLS exist.
- Push registration was reported broken on build 13. Treat it as open until a
  newer physical build proves registration and delivery.
- Account deletion needs physical Apple-token revocation verification before
  App Store release confidence.

## Pull-request quarantine

PR #25 and PR #26 were large, overlapping changes with unresolved review and
runtime risk. Do not merge either wholesale. Recover an individual change only
after restating its current product contract, rebasing it onto current `main`,
and verifying it independently.

## Immediate gates

1. Merge the MVP visual-consolidation pull request after CI, preview, and review
   succeed.
2. Set the EAS project GitHub base directory to the repository root before
   running repository-triggered EAS workflows.
3. The approved merge to `main` automatically produces and submits a fresh
   TestFlight binary through `.eas/workflows/release-ios.yml`.
4. Verify the high-risk multi-user and native matrix in `docs/TESTING.md`.
