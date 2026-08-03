# LocalCheck Launch Control

Status: Active operating document
Last verified: 2026-08-03
Release authority: Jesse must explicitly approve production deploys, TestFlight builds/submissions, backend mutations, and merges.

## Jesse's launch order

This is the priority order. Do not let lower-level technical hygiene displace it.

1. **Get the current app-source checkpoint onto Jesse's phone.** Complete: app-source commit `d193ac8`, tag `v1.0.5`, produced LocalCheck 1.0.1 build 13 (PR #22 MVP consolidation + PR #23 version bump). GitHub `main` has since advanced to documentation commit `81ff0a4` without changing that binary checkpoint. App Store Connect processing completed, TestFlight offers the update, and Jesse confirmed on-device it launches without crashing, feels snappy, and core logic works. Prior checkpoint was `249c926`/`v1.0.4`/build 9. See `ACTIVITY_LEDGER.md` 2026-08-01 entry for the incident/fix writeup — push notification registration is still broken on build 13 and remains open.
2. **Bring the current UI to the public-app bar.** Use the 2026-08-01 assessment to remove false affordances, establish shared production primitives, repair first-run identity/location/privacy, and normalize accessibility/action states before adding delight. Apple Sign-In stays unchanged.
3. **Then prove Friends and the intentionally small notification set.** Run invite, friend request/accept, and final-score confirm/object only.
4. **Then return to native/reliability acceptance.** Verify Mapbox physically and finish reverse-direction/background Realtime checks in parallel with real pilot feedback.
5. **Then close App Store loops.** Privacy, onboarding, account deletion, recovery, store assets/metadata, external TestFlight, and review submission.

Database advisor notes, RPC implementation details, and scale optimizations are not launch blockers unless they directly break one of those five outcomes.

## Outcome ladder

1. Keep LocalCheckProd stable and prove the old polling failure cannot recur.
2. Put the current native mobile app in TestFlight and validate it with two real accounts on two physical devices.
3. Finish the pilot-critical game, privacy, schedule, settings, onboarding, and account-compliance loops.
4. Keep the public website honest, useful, and on the same backend and product language as mobile.
5. Complete App Store metadata, screenshots, privacy disclosures, review notes, and submission only after the app passes the release gates below.

## Current operating truth

| Surface | Verified state | Authority / constraint |
| --- | --- | --- |
| Shared backend | `LocalCheckProd` (`qkrnmyexzvaxiqfxwwfb`) is healthy; 56 courts and the current mobile v2 schema are live. The old `jzclwnzcektqhgkkdeje` project still exists but is deprecated. | No new production schema until web and mobile use one contract. Do not delete or pause the old project without Jesse's approval. |
| Mobile source | GitHub `main` is `81ff0a4`. PR [#22](https://github.com/jGPT-Automated/LocalCheck_Expo/pull/22) merged the MVP candidate; PR #23 changed app/runtime version to 1.0.1; PR #24 refreshed current build/incident documentation. Build 13 still comes from tag `v1.0.5` at `d193ac8`. The mandatory contributor guardrails are in [`../APP_ARCHITECTURE.md`](../APP_ARCHITECTURE.md). Apple Sign-In remains enabled and unchanged. | Notification storage/RPCs are partially live, but sender/webhook delivery and sport-split Elo storage are not. Physical two-device QA remains open. Phone push registration is broken on build 13. |
| Mobile distribution | EAS is connected to the correct repo and `artifacts/mobile`; all environments point to LocalCheckProd and have the required Mapbox tokens. LocalCheck 1.0.1 build 13 completed 2026-08-01 and TestFlight offers it as an update; Jesse confirmed it installs and runs without the prior launch crash. | Fix phone-push registration, then run native map and two-device Realtime acceptance against build 13 specifically (prior acceptance evidence was against build 9's older client). |
| Public website | The deployed site is visually aligned with the graphite/orange direction and its court explorer resolves 56 Supabase courts. `LocalCheck_WEB` main is PR #1 at `7a5b74d`. | The old PR #2 checkout is archived at `/Users/JesseH/Projects/archive/LocalCheck_WEB_PR2-branch-2026-07-26`. It is ten commits ahead of main with preserved local package changes and must not be mistaken for deployed truth. |
| Web PR #2 | Weather and shared-planning heatmap are implemented, but GitHub has no status checks. | Blocked from merge: two unresolved P2 review threads, a non-critical weather request without a timeout, stale-session recovery, and a second planning model (`court_time_intents`) that conflicts with production `planned_visits`. |
| Web PR #3 | Remotion-style hero work is open and mergeable. | Defer until product/release foundations are closed; brand roadmap treats launch-media motion as optional after the product UI is approved. |
| Brand | This folder is the working governance and cross-platform product contract. | `DESIGN.md`, the logo, and its decisions remain draft until Jesse locks them through collaborative review. |
| JAWS | Contains historical research and experimental specimens; `Brand Asset Sheet.dc.html` is the current provisional visual base. | Its bracketed-check construction and heavy display typography are not final. Reconcile conflicting specimens before reuse. |
| Agent library | `/Users/JesseH/Projects/agents` is a reusable skill/reference corpus, not a LocalCheck product repo. | Use its rigorous-verifier contract for evidence, resource, lifecycle, and end-to-end checks; do not treat generic design files as product decisions. |
| Local verification | The stale checkout remains preserved in the archive, while the canonical repo now has a real lockfile-derived pnpm install. The repeatable export fallback is live at port 8081 and the release gate passes. Normal Expo live mode still reaches `EMFILE` because Watchman is not installed. | The fallback is interactive but has no hot reload and is not native proof. Restart it after code edits; TestFlight remains authoritative for Mapbox, Apple Sign-In, SecureStore, and Location. |

## Burn-down

### P0 — release blockers

- [x] Remove the global 30-second polling storm from mobile `main`.
- [x] Point mobile, web runtime, and EAS environments at LocalCheckProd.
- [x] Verify LocalCheckProd health, realtime publication membership, Apple provider state, and current data shape.
- [x] Archive the dirty/diverged local Expo checkout intact and restore the canonical local path to clean GitHub `main` at `7a6862e`.
- [x] Land a release gate on mobile `main` before OTA publication. `check:release` runs TypeScript plus five focused Realtime tests.
- [x] Verify the release candidate builds from the canonical checkout without relying on the stale branch checkout. The interactive web export and release gate pass; visual acceptance remains open.
- [x] Repair the Mapbox SDK-download credential and pass native dependency installation.
- [x] Resolve the EAS fingerprint mismatch, build current `main`, and deliver LocalCheck 1.0.0 build 9 to TestFlight.
- [ ] Deliver the local private-Broadcast replacement for every shipping-app `postgres_changes` listener after review and Jesse's explicit push/release approval.
- [x] Verify the live scoped Broadcast foundation: migration `v2_scoped_realtime_broadcast`, topic authorization, and database invalidation triggers are present on LocalCheckProd.
- [x] Recover the exact live Broadcast migration source into the repository so the production contract is repeatable and reviewable.
- [ ] Complete two-client proof for subscription status, cleanup, reconnect, foreground catch-up, and reverse-direction delivery. Private subscription and TestFlight-to-browser delivery are proven; background/scoping and browser-to-phone remain open.
- [ ] Run a two-account, two-device physical test: Apple Sign-In, foreground/background reconnect, check-in/out, scoped court presence, planning/RSVP, game logging, and profile/feed updates.
- [ ] Fix every failure from that physical pass before inviting waiting pilot users.

### P1 — pilot-ready product

- [ ] Deploy and physically prove Add Court's completed authenticated Gemini verification/create source; then finish Edit Run's authorized update path. Add Court now has a library-backed task sheet, no manual sport selector, server-side duplicate/rate guards, and a complete authorized row insert, but the `verify-court` function was not deployed because the Codex account usage limit blocked the deployment path before mutation. See `ADD_COURT_HANDOFF.md`.
- [ ] Establish the shared production UI foundation and migrate the core journey. Current assessment: [`assessments/2026-08-01-current-build-assessment.md`](assessments/2026-08-01-current-build-assessment.md).
  Local candidate implemented and browser-reviewed on 2026-08-01; Expo Go,
  physical iPhone accessibility/sheet/map QA, release checks, and Jesse's
  approval remain before this item is complete.
- [ ] Meet the accessibility baseline: readable type, 44-point targets, roles/states, VoiceOver order, Dynamic Type, reduced motion, outdoor contrast, and long-content resilience.
- [ ] Prove the game loop end to end against LocalCheckProd, including Elo/win/loss/profile/feed effects.
- [ ] Complete visibility/privacy enforcement across leaderboards, planned visits, schedules, profiles, and court people lists. The local duplicate/inline Compete presentation is fixed, but `profiles` still has no persisted visibility contract and the database cannot yet enforce leaderboard privacy.
- [ ] Accept and physically prove the weekly availability candidate. Mobile now uses the same `planned_visits` contract on Schedule and Court Details, with multi-select batch save and idempotent inserts; signed-in add/remove proof remains.
- [ ] Reorganize Settings; fix Manage Account; wire dead controls; keep LocalPlus visible only with honest entitlement state and complete its RevenueCat purchase/restore path before it becomes purchasable.
- [ ] Rebuild onboarding on current `main` and verify first-session success on a clean account.
- [x] Replace the missing `POST /api/courts/verify` source path with an authenticated server-side vision verification and authorized court-create path; the Gemini secret remains server-side. Deployment and physical proof are tracked separately above.
- [ ] Add crash/error visibility and a minimal incident runbook before expanding the pilot.

### P1 — website reliability and coherence

- [ ] Decide whether PR #2 is adapted to `planned_visits` or reduced to weather/layout only; do not ship a duplicate planning table.
- [ ] Resolve both PR #2 review threads and add status checks for lint, build, rendered HTML, keyboard/focus, reduced motion, and console/network errors.
- [ ] Reverify the court explorer and representative court pages at desktop and phone widths against LocalCheckProd.
- [ ] Correct every repo document that calls `court_time_intents` or a local-only model the shared production contract.
- [ ] Keep PR #3 deferred until PR #2 and the shared design/data contracts are settled.

### P1 — App Store compliance

- [ ] Implement in-app account deletion; Apple requires deletion, not only deactivation. Revoke Sign in with Apple tokens where applicable.
- [ ] Publish and link a privacy policy in the app and App Store metadata.
- [ ] Apply and physically verify the checked-in user block/report migration and profile controls; add the support contact path before public release.
- [ ] Prepare accurate location and data-use disclosures.
- [ ] Complete LocalPlus with RevenueCat, StoreKit product mapping, purchase/restore, and server-side entitlement sync before enabling purchase in the release build; do not delete its designed UI.
- [ ] Complete App Store Connect metadata, screenshots, review notes, support URL, age rating, privacy nutrition labels, and a review account/instructions where needed. EAS Submit only uploads the binary; it does not submit the app for App Review.

### P2 — hardening and scale

- [ ] Enable leaked-password protection in Supabase Auth.
- [ ] Document intentional backend-only `subscriptions` access and the client RPC threat model.
- [ ] Harden `court_planned_times` to an empty fixed `search_path` while preserving its privacy-safe aggregate behavior.
- [ ] After Broadcast migration, measure channel/topic fan-out and document capacity thresholds before pilot growth.
- [ ] Scope the global scheduled-game query before the court/player population makes its current 300-row cap meaningful.

## Release gates

A milestone is complete only when all applicable evidence exists:

1. **Source:** exact branch and commit recorded; dirty local work accounted for.
2. **Static:** typecheck/lint and focused automated tests pass on the release commit.
3. **Backend:** migrations, grants/RLS, realtime membership, and environment target verified on LocalCheckProd.
4. **Runtime:** clean-account and returning-account paths tested; foreground/background, offline/reconnect, expired-auth, empty-data, and failure states exercised.
5. **Physical:** two-device TestFlight evidence for realtime and multiplayer loops.
6. **Visual/accessibility:** outdoor legibility, phone/desktop layout, 44-point targets, keyboard/focus, screen-reader names, and reduced motion checked.
7. **Distribution:** compatible EAS build succeeds, submit succeeds, TestFlight processing finishes, and the intended build is installed.
8. **Approval:** Jesse explicitly approves each merge, deploy, TestFlight release, pilot expansion, and App Store submission boundary.

## Delegation contract

Every implementation task given to another agent must include:

- the canonical repo, base commit, and files in scope;
- the user-visible acceptance criteria and non-goals;
- the LocalCheckProd/data-contract constraints;
- required automated, runtime, physical, accessibility, and documentation evidence;
- a no-deploy/no-merge boundary unless Jesse explicitly authorizes it;
- a verifier pass that inspects the diff and reproduces the claimed result instead of accepting a completion message.

## Immediate decision queue

Items 1 and 4 from the pre-2026-08-01 queue are done: PR #22 merged, build 13
delivered to TestFlight with Jesse's approval on each release-triggering
action (provisioning-profile regen, version bump, tag push). Remaining:

1. **Production UI system and journey repair** — Jesse's explicitly stated next
   priority now that the app is functional again. Follow the 2026-08-01
   assessment: table stakes first, then LocalCheck-specific delight.
2. Root-cause and fix phone-push registration on build 13 (see
   `CURRENT_STATE.md` and the 2026-08-01 `ACTIVITY_LEDGER.md` entry).
3. Preserve Apple Sign-In unchanged. Prove Schedule add/remove persistence and
   the shared form sheets on a physical signed-in client.
4. Review the cloud Elo PR and handoff selectively against the live schema. Do
   not apply its migration wholesale or mutate production before the match
   confirmation/objection lifecycle is approved.
5. Finish reverse-direction/background/scoping checks and run two-phone
   Realtime acceptance against build 13 specifically — prior acceptance
   evidence (2026-07-27) was against build 9's older client.
6. Turn physical QA and pilot feedback into the next tightly scoped
   implementation pass.
7. Decide whether `publish-ota-update.yml` needs a guard against publishing
   native-requiring changes unconditionally — see the 2026-08-01 ledger entry
   for why this matters; it's what caused this session's crash.

## Evidence ledger — 2026-08-01

- EAS build history: builds 10 and 11 (`main`/`bcf9605`) both errored with `XCODE_BUILD_ERROR` — stale provisioning profile missing the Push Notifications/`aps-environment` entitlement `expo-notifications` now requires.
- Fix: `eas credentials` → iOS `production` → Build Credentials → declined reusing the original profile → new profile generated (Developer Portal ID `DR4YF2N5J5`).
- Version bump: `app.json` `expo.version` `1.0.0` → `1.0.1` via PR #23 (`d193ac8`), so the next native build's runtime version diverges from OTA updates published for the old one.
- Tag `v1.0.5` on `d193ac8` → workflow `019fbb3e-b3b6-7830-ad63-cb4545af256c` → build 13 → both `build_ios` and `submit_ios` succeeded.
- Physical evidence: Jesse confirmed on TestFlight that build 13 installs, launches without the prior `ErrorRecovery`/SIGABRT crash, feels snappy, and core logic works.
- Still failing: push notification registration ("Alerts are not on: The phone could not be registered") on build 13 — separate, unresolved issue; see `ACTIVITY_LEDGER.md`.
- Full incident writeup with root causes for all three problems found (stale-rerun mechanism, provisioning profile, OTA/native runtime mismatch): `ACTIVITY_LEDGER.md` 2026-08-01 entry.

## Evidence ledger — 2026-07-27

- Two-client Jaycee Park test: acting clients refreshed themselves, but the other active client stayed stale without navigation (0 vs 1, then 1 vs 2 active players).
- Realtime logs during the test repeatedly returned `PrivateOnly: This project only allows private channels`; the sampled failures retried roughly every 1.5–2.5 seconds.
- Shipping mobile creates public `postgres_changes` channels and ignores subscribe status; focus/foreground queries explain the tab-switch catch-up.
- LocalCheckProd already has migration `v2_scoped_realtime_broadcast`, scoped private-channel RLS, and invalidation triggers for check-ins, activity, friendships, profiles, matches, planned visits, runs, and participants. Its source is missing from this checkout.
- Product contract: check-in state is durable and independent of connection/app state; relevant active viewers receive live invalidations, inactive viewers unsubscribe and catch up once on return.
- Local candidate: all shipping-app public listeners were removed; the hub opens only private scoped Broadcast channels, shares/deduplicates topics, coalesces invalidations, caps exact court topics at 20, closes channels when inactive, and fails closed after three consecutive subscription errors.
- Static proof: `pnpm --filter @workspace/mobile run check:release` passed TypeScript and five focused Realtime tests; `rg` found no shipping-app `postgres_changes` listener.
- Runtime proof: the rebuilt signed-in preview reported `SUBSCRIBED` for `court:3bc01099-488e-4dd2-8d4c-3c18ff314d59`, `market:houston`, and its own `user:*` topic with no local `PrivateOnly` log. Jesse confirmed the active browser updated from a TestFlight-originated court change without tab switching.
- Explore browser proof: Houston scope, featured local court, bounded five-of-seven list, active/local counts, sport-identity art, one correctly positioned marker, no stale Los Angeles marker set, and marker click opening the Jaycee Park sheet.
- Compete browser proof: misleading combined-sport tabs removed and one inline hidden owner row shown without a duplicate public row; backend-wide profile privacy remains open.
- Provenance: the recovered Broadcast migration is byte-for-byte identical to the archived applied source, and live read-only inspection confirmed its RLS policy, ten triggers, helper/functions, and market column. No production mutation, push, or release occurred.

## Evidence ledger — 2026-07-26

- GitHub: Expo PR #17 closed/superseded; PR #19 merged as `7a6862e`; no open Expo PRs.
- Source audit: no recurring interval in the shipping mobile client on `origin/main`; scoped channels and foreground resync are present.
- Repo-only Realtime audit: shipping listeners use `.on('postgres_changes', ...)`; no `.on('broadcast', ...)` client subscription or matching migration source is present in the checkout. The live backend's already-applied Broadcast migration and triggers were not verified until the 2026-07-27 evidence above.
- Supabase: LocalCheckProd healthy; all public tables RLS-enabled; publication includes the seven realtime tables used by mobile; Apple and Email providers enabled.
- EAS: correct repository/base directory/environment values; latest installed-compatible binary is build 6; `7a6862e` fingerprint updates have no compatible build.
- EAS release attempt: manual workflow `019f9e4c-2678-7938-bfd4-e9629ba46c02` for `main` failed during `MapboxCommon` pod installation with HTTP 403; no build or submission was produced.
- EAS retry: workflow `019f9e7e-1ccb-7466-9b0e-765db0bf2b28` passed the Mapbox step but failed because local and EAS native fingerprints differed.
- Release resolution: commit `249c926` changed runtime-version policy from `fingerprint` to `appVersion`; tag `v1.0.4` triggered workflow `019f9e9b-188e-70b8-9ff3-f1aa9a66b52e`.
- Distribution: App Store Connect shows LocalCheck 1.0.0 build 9 complete, and Jesse's TestFlight app offers the update.
- Website: live homepage and court explorer rendered; explorer transitioned to `Supabase live` and its API returned `source: supabase` with 56 courts.
- GitHub web PR #2: two unresolved review threads and no commit status checks.
- Local repositories: Expo and web worktrees contain pre-existing changes; Brand/JAWS/agents are not Git repositories.
- Verification constraint: build-heavy local checks were intentionally not run at 157 MiB free space.
