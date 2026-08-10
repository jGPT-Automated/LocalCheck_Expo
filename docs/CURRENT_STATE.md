# Current state

Last reconciled: 2026-08-10 against the isolated PR #28 stabilization worktree
and the live LocalCheckProd migration ledger. The items under "Release 1 branch
state" are not production state. Reconfirm the exact `main` SHA after PR #28
merges.

## Production checkpoint

- iOS/TestFlight checkpoint: app `1.0.1`, build `13`, release tag `v1.0.5`.
- PR #28 release candidate: app `1.0.2`; the native version is bumped because
  Add Court introduces the `expo-image-picker` config plugin. Its build number
  will be assigned remotely by EAS after the approved merge.
- EAS project: `agenticjess-os/localcheck`
  (`9c906173-0258-45a9-a3fe-786cda373c66`).
- Supabase production project: `qkrnmyexzvaxiqfxwwfb`.
- Installed binaries use EAS Update with `runtimeVersion.policy = appVersion`.
- Production OTA rollback remains available through EAS Update republish.

## Current product contract

- Authentication: email/password and Apple Sign-In.
- Discovery: court list/search plus native Mapbox map. Map viewport queries are
  location-driven across market boundaries; Explore narrows market results in
  expanding geographic windows before sorting by distance.
- Presence: atomic check-in switching and server-driven expiration.
- Schedule: planned visits and hosted runs.
- Social: profiles, friendships, feed activity, notifications, and reversible
  block/report safety controls managed from Settings.
- Competition: sport-specific ELO and reviewed match lifecycle.
- Realtime: private scoped Broadcast invalidation followed by authoritative
  refetch.

All durable product state comes from Supabase. There is no application API
server or local-data fallback. The Expo browser target renders this same app for
development and testing.

## Known release risks

- Mapbox, push notifications, Apple Sign-In, and SecureStore require physical
  iOS verification; browser success does not prove them.
- The old Add Court modal that called a dead `/api` route remains retired. The
  PR #28 branch now has an authenticated Supabase flow, but it is not production
  proven until its backward-compatible cloud changes are approved, deployed,
  and accepted/rejected physical photo tests pass.
- Push registration was reported broken on build 13. Treat it as open until a
  newer physical build proves registration, foreground/background/cold-start
  routing, tickets/receipts, retries, and invalid-token cleanup.
- Account deletion needs physical Apple-token revocation verification before
  App Store release confidence.

## Pull-request quarantine

PR #25 and PR #26 were large, overlapping changes with unresolved review and
runtime risk. Do not merge either wholesale. Recover an individual change only
after restating its current product contract, rebasing it onto current `main`,
and verifying it independently.

PR #28 (`codex/mvp-visual-polish`) is the single final roll-up. Its ancestry
contains the complete lifecycle reset from PR #27 plus every subsequent MVP UI,
design-system, testing, and handoff commit. Merge #28 only; close #27 as
superseded. Closing a pull request or deleting its task branch does not remove
the commits incorporated into #28 or the review history retained by GitHub.

## Release 1 branch state

- Add Court, block/report, sport-specific ELO review, three-day automatic
  confirmation, and durable push delivery have been recovered into the clean
  root-level app and covered by focused source and unit contracts.
- The approved splash artwork is present; signed-out launch uses the full
  reveal and signed-in launch completes pin → W → check in 1.6 seconds.
- Detail-header logo geometry is explicitly clipped to its requested square,
  the Me notification bell is restored while Inbox remains, and profile Log
  Game fetches an opponent by ID rather than leaderboard membership.
- GitHub CI no longer requires runner-provided `rg`. All four EAS workflow files
  validate with the Expo schema/CLI.
- Expo's connected GitHub base directory was changed from `/artifacts/mobile`
  to `/` on 2026-08-10 and visibly confirmed as saved, so EAS now resolves the
  cleaned root-level repository.
- `main` is not currently protected. PR #28 therefore treats explicit approval,
  a clean `quality` check, and a clean Codex review as mandatory operational
  gates before merge.
- The production project was inspected read-only before release: its current
  migration ledger ends at `20260804125610`, its existing tables/RPCs remain
  live, and only `delete-account` is currently deployed as an Edge Function.
  The four PR #28 migrations and two new functions are source-only. Connected
  signed-out auth/splash QA passed at 390×844 and 1280×900 with no overflow;
  signed-in connected surfaces and physical-device QA remain open.

## Immediate gates

1. Complete source/release checks, connected preview, and the two-device matrix.
2. Push the verified snapshot, reply to and resolve PR #28's three review
   conversations with concrete evidence, and obtain explicit release approval.
3. Deploy the backward-compatible Supabase changes/functions and verify them.
4. Keep GitHub's `eas-build-ios:production` label on PR #28 so the Expo GitHub
   integration
   produces the pull-request build requested for review. This label does not
   submit to TestFlight.
5. The approved merge to `main` automatically produces and submits a fresh
   TestFlight binary through `.eas/workflows/release-ios.yml`.
6. In App Store Connect, wait for processing, verify the new build internally,
   then deliberately add it to the external tester group or App Review. A merge
   does not perform those App Store Connect approvals.

## Next-agent starting point

- Begin from updated `origin/main` after PR #28 merges; do not resume PR #25,
  #26, or #27.
- Treat the last known TestFlight checkpoint above as historical until App
  Store Connect confirms the new build number produced by the merge.
- Remaining release confidence is primarily physical-device work: push token
  registration and delivery, Apple Sign-In/account-deletion revocation,
  Mapbox/location, session restoration, and the multi-user matrix.
- Small visual follow-ups must improve the shared owner named in
  `docs/product/DESIGN.md`, include browser and iPhone evidence, and avoid
  introducing a parallel component or token.
