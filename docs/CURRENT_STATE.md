# Current state

Last reconciled: 2026-08-12 against `origin/main` at `3ca9c6f`, the production
EAS Update channel, and LocalCheckProd.

## Production checkpoint

- iOS/TestFlight checkpoint: app `1.0.2`, build `14`, runtime `1.0.2`, source
  commit `bc1507f6cff43b0d6af67e6dd34016b3079ff7bb`.
- Latest production OTA: `Enable first-time push notification registration`,
  update `019ff2db-faca-700f-82be-9e0b1b0c249e`, group
  `e7ed1d7d-0d91-458c-adf1-941d807ce84d`, published 2026-08-11.
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
- Privacy: changing check-in visibility updates the active row and projected
  activity before the selector changes; relaunch hydrates the persisted mode.
- Schedule: planned visits and hosted runs.
- Social: profiles, friendships, persisted one-per-user activity hype, durable
  inbox notifications, production push delivery, and reversible block/report
  safety controls managed from Settings.
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
  2026-08-11 physical attempt failed because `verify-court` was absent from
  LocalCheckProd and returned HTTP 404. The authenticated function and its
  database contract were deployed on 2026-08-12; a signed-in accepted and
  rejected live-photo test still gates production proof of the Gemini path.
- Push registration and background delivery are proven on build 14: a physical
  iPhone registered after the production OTA and received a real friend-request
  alert. Foreground routing, cold-start navigation, retry/receipt handling, and
  invalid-token cleanup still need explicit device/provider evidence.
- Account deletion needs physical Apple-token revocation verification before
  App Store release confidence.

## Pull-request quarantine

PR #25 and PR #26 were large, overlapping changes with unresolved review and
runtime risk. Do not merge either wholesale. Recover an individual change only
after restating its current product contract, rebasing it onto current `main`,
and verifying it independently.

PR #28 was consolidated into `main` and produced TestFlight build 14. PRs #25–27
remain historical/superseded inputs and must not be merged wholesale. Recover a
specific missing behavior only after verifying it against current `main`.

## Release 1 production state

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
- Push delivery is active in LocalCheckProd. The durable delivery migration is
  applied, `send-notification` version 1 is deployed, the webhook secret is held
  in Supabase/Vault, and a direct database-to-function dispatch returned HTTP
  200 before the physical friend-request alert succeeded.
- The registration fix prompts only when iOS permission is undetermined,
  repairs an enabled account with an existing grant, and respects both LocalCheck
  opt-out and iOS denial. It requests the Expo token with EAS project id
  `9c906173-0258-45a9-a3fe-786cda373c66`.
- Add Court no longer asks new submissions to classify a court as free, paid,
  or private. Existing values on all 56 courts are unchanged; new verified
  rows use a nullable field through the service-role-only
  `create_verified_court_v2` RPC. `verify-court` version 2 is active with JWT
  enforcement and rejects unauthenticated requests with HTTP 401.
- Block/report is active in LocalCheckProd: both RLS tables, the caller-scoped
  RPCs, blocked-relationship read filters, and social/run write guards are
  deployed.
- Connected signed-out auth/splash QA passed at 390×844 and 1280×900 with no
  overflow. Signed-in browser QA remains the fast surface for focused follow-up
  changes; native-only acceptance remains on TestFlight.

## Current focused follow-up

- The current unmerged Profile/Compete branch implements the approved release
  references at 402×874 and 430×932 comparison viewports. Profile uses the
  canonical tab header, opens QR from the avatar, keeps Settings in the header, and
  separates actionable Inbox items from informational notifications. Compete
  uses equal-height sport/scope controls, quieter ranks, compact tier/record
  metadata, right-aligned ELO, and a same-height dimmed private-rank row.
- The same branch now keeps every primary tab on `ScreenHeader`, aligns its
  title with the 24px logo mark, orders Profile metadata as `sport · court`,
  balances Profile stat padding, and keeps Explore map controls above the tab
  bar on web and native.
- Log Game now places Court and its authoritative ranked Sport on one row,
  replaces free-typed dates with platform date controls, supports 1v1, 2v2,
  3v3, and 5v5 rosters through the same player search/QR selector, and uses a
  centered score review with an animated five-second auto-send trail plus
  equal-width Edit and Confirm actions.
- The 1v1 client retries the previously deployed `log_match` signature only
  when PostgREST explicitly reports that the new `p_played_on` signature is
  missing. A connected 12–4 submission was saved through this compatibility
  path on 2026-08-27; unrelated database errors are not masked or retried.
- Ad-hoc team submission/review/rating source is additive in
  `20260827143000_add_ad_hoc_team_matches.sql`. Team writes are not live until
  that migration and its prerequisite participant-review migration are applied.
- Score review reads no longer depend on a single nested PostgREST relationship
  query. RPC match IDs normalize both supported composite return shapes so a
  valid response cannot route to `/match/undefined`.
- TypeScript, focused backend/notification/release-model tests, design checks,
  and a fresh connected web export pass. Log Game has two current 430×932
  visual passes covering 1v1, 2v2, date-input semantics, countdown progression,
  Edit cancellation, and a saved 1v1 result. Native QR scan, receiving-account
  review/notification acceptance, and database migration deployment remain
  pending; team submission is not production behavior until those migrations
  are applied and the native client is released.

- PR #35 uses the final supplied LocalCheck vector assets through the shared
  brand component. Home now matches the established mark + title treatment on
  every other primary tab. The supplied chevron remains the detail back icon;
  W/L variants remain intentionally unused. Court detail uses the source
  lockup's spacing and an edge-aligned LocalCourt label.
- Home's horizontal player roster now uses equal tokenized spacing above and
  below each tile, matching the section-header rhythm at compact and expanded
  widths.
- Player profiles now use the same 24px mark and 8px lockup gap as shared app
  headers. The compact hero omits the long username and member-since line,
  keeping the player name, local court, and ELO on one clear axis.
- Player profile content is split into `VS YOU`, `ACTIVITY`, and `DETAILS`.
  The first tab uses a visually distinct series card; Details owns member
  since, local court, global sport rank, real trailing-90-day check-in activity,
  and the existing report/block controls.

- Compete retains the `main` Local/Regional/Global behavior. The current task
  adds the missing honest sport membership rule: a saved preferred sport wins;
  otherwise the saved home court's sport is used; accounts with neither are
  excluded. Local and Regional return no rows when the viewer has no home court.
- Home's no-court `EXPLORE COURTS` action returns to rectangular button geometry.
- These follow-up source changes are not production behavior until reviewed and
  released through the documented PR/OTA path.

## Immediate gates

1. Apply the participant-review, game-date, and ad-hoc-team migrations in ledger
   order, then complete the receiving-account score notification/review and one
   2v2 lifecycle. Install a fresh native build before QR/date-picker acceptance.
2. Exercise one accepted and one rejected Add Court live photo on a signed-in
   iPhone; verify the accepted court appears and the rejection inserts nothing.
3. Complete foreground/cold-start push routing plus receipt/retry/invalid-token
   evidence without reopening the already-proven registration path.

## Next-agent starting point

- Begin from updated `origin/main`; do not resume PR #25, #26, or #27.
- Treat TestFlight build 14 and the production OTA identifiers above as the
  current installed baseline until Expo/App Store Connect proves a later one.
- Push token registration and one background friend-request delivery are
  verified. Preserve that path while completing the remaining native matrix.
- Small visual follow-ups must improve the shared owner named in
  `docs/product/DESIGN.md`, include browser and iPhone evidence, and avoid
  introducing a parallel component or token.
