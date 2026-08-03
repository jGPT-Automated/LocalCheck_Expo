# LocalCheck current state

Last verified: 2026-08-01, America/Chicago

This is the short current truth. Use the activity ledger for history and the
release runbook for deployment steps.

## Solid checkpoint

| Item | Verified state |
| --- | --- |
| GitHub repository | `jGPT-Automated/LocalCheck_Expo` |
| Canonical local folder | `/Users/JesseH/Projects/LocalCheck_Expo` |
| Delivery branch | GitHub `main` |
| Delivered source | GitHub `main` is `81ff0a4` — PR #22 (MVP consolidation), PR #23 (app version 1.0.0→1.0.1), and PR #24 (current documentation/build-incident refresh) are merged. Tag `v1.0.5` remains the build-13 source checkpoint at `d193ac8`. |
| Canonical review PR | [#22 — consolidate LocalCheck MVP candidate](https://github.com/jGPT-Automated/LocalCheck_Expo/pull/22) is merged and closed, not open. It is now historical — its content is `main`. |
| Local working state | The current assessment/docs are on local branch `codex/current-build-assessment`; no PR is open. GitHub `main` remains the delivered source of truth. |
| Release tag | `v1.0.5` → checkpoint commit `d193ac8` (app version `1.0.1`, build 13). `v1.0.4` (commit `249c926`, build 9) is the prior checkpoint, now superseded. |
| TestFlight | LocalCheck `1.0.1 (13)` delivered 2026-08-01; Jesse confirmed it launches, feels snappy, and core logic works. Push notification registration is still broken on this build — see "What is not complete." |
| Successful EAS workflow | `019fbb3e-b3b6-7830-ad63-cb4545af256c` (build 13 + submit, 2026-08-01). Prior checkpoint: `019f9e9b-188e-70b8-9ff3-f1aa9a66b52e` (build 9, 2026-07-26). |
| Expo project id | `9c906173-0258-45a9-a3fe-786cda373c66` |
| Supabase project | LocalCheckProd `qkrnmyexzvaxiqfxwwfb` |

## Local design-foundation candidate

The local `codex/current-build-assessment` branch now contains the first shared
UI-foundation checkpoint. It does not change Supabase, Realtime, service, or
navigation contracts. The candidate adds one app-shell geometry, primary and
detail headers, shared tabs and segments, 44-point shared controls, reduced
motion handling, optional rather than generic haptics, one Me/other-player
profile scaffold, and a continuous court-sheet outline. The confirmed contract
and release gates are in
[`product/DESIGN_FOUNDATION.md`](product/DESIGN_FOUNDATION.md).

A fresh interactive web export is running at `http://127.0.0.1:8082/`. Signed-in
browser review covered Home, Explore, Schedule, Compete, Me, Settings, another
player's profile, and the selected-court sheet. TypeScript and whitespace checks
pass. Expo Go and physical iPhone acceptance remain open, so this is not yet a
TestFlight-ready or delivered checkpoint.

The primary-header candidate now reserves one fixed trailing slot across all
five tabs. Current browser evidence shows Home live-player count, Schedule's
one-hour attendance look-ahead, Explore's 10-mile court count, Compete's compact
rank visibility, and the Me Settings action without changing title geometry.

Build 13 is the current solid device checkpoint: it carries PR #22's full MVP
consolidation (Home/Explore/Schedule/Court Details/Compete UI, the notification
inbox and sport-Elo candidate, private-Broadcast Realtime client changes) plus
the fixes below. Two-device Realtime acceptance and the notification/Elo
end-to-end contract remain open — notification storage/RPCs are now partially
live, but the push sender is not deployed and split Elo fields are absent.
Build 13 contains the client code, not proof it works end to end on hardware.
See [`ACTIVITY_LEDGER.md`](product/ACTIVITY_LEDGER.md)
2026-08-01 entry for the full build-9→13 incident writeup.

## What is complete

- GitHub main restored as the local mobile source of truth.
- Mapbox secret download credential fixed in Expo environments.
- EAS fingerprint mismatch removed by the `appVersion` runtime policy.
- Tagged iOS build completed and submitted to TestFlight.
- Old global polling storm removed; acting-device and focus/foreground refreshes remain, without a recurring timer.
- A local Realtime release candidate now replaces every shipping-app `postgres_changes` listener with authorized private Broadcast topics. One hub deduplicates topics, coalesces invalidations, caps exact court topics, closes all channels while inactive/hidden, restores desired topics on return, and fails closed after repeated subscription errors.
- Explore now uses a Compete-style full-width `List` / `Map` switch, market-scoped discovery (five visible, ten fetched), premium smoky cards with in-card Check In, active/local counts, and restrained sport metadata. Web points are Mapbox canvas layers with built-in clustering; native uses the equivalent `ShapeSource` layers. The signed-in preview passed list, cluster-rendering, and Schedule multi-select checks.
- Schedule now has inline `View / Edit` mode. Cell taps only update pending local state; `Save` commits the additions/removals together and performs one catch-up refresh. Browser QA selected and cancelled multiple cells without writing test data.
- The local MVP visual candidate now applies one shared Oswald/Inter type hierarchy and header baseline across primary tabs; compact matte court cards; real sport-library icons; smaller settings and map chrome; and ranked/friend avatar states where orange glow means ranked and the star means friend.
- The 2026-07-29 reference pass makes the shared primary-tab title a stable 22 px Inter lockup, moves the unboxed sport filter before Explore search, and reduces normal discovery cards to a lighter one-line court name with tighter spacing. Home now uses a full-width matte court section rather than a discovery card. Its identity, roster, and next run stay fixed while only the activity feed scrolls. The selected map sheet uses court metrics rather than decorative player tiles.
- Schedule now covers 8 AM through 11 PM in two-hour heat buckets, defaults to the current bucket whenever the screen regains focus, highlights the current row/column/cell, separates View from Edit, and presents upcoming runs as a horizontal snapping rail. Create Run and Add Court share the same form-sheet shell.
- Court Details now keeps one stable court card above four scrollable sections: `Feed`, `Locals`, `Schedule`, and `Details`. Locals use the requested ranked/friend avatar language; Schedule reuses the heatmap contract; Details only renders court-facility facts that actually exist in the data.
- The canonical dependency tree is now a real pnpm install rather than archive symlinks. `script/start_local_preview.sh` produces a fresh interactive export at port 8081 when Watchman is unavailable; the export and release gate pass from the canonical checkout.
- The local Compete candidate now has separate basketball and pickleball views backed by separate rating fields. Until its additive migration is active, it safely falls back to the old combined rating. A hidden current-user placeholder remains inline without changing public row numbering or duplicating the user publicly in that client view.
- A local notification and score-review candidate now includes an in-app inbox, unread badge, friend request/accept alerts, run invitations, score confirmation/object actions, and bounded phone-push source. Its exact product and activation contract is in [`NOTIFICATIONS_AND_ELO.md`](NOTIFICATIONS_AND_ELO.md).
- The contributor contract is now explicit in [`APP_ARCHITECTURE.md`](APP_ARCHITECTURE.md). It records provider order, service and RPC boundaries, Realtime topics, native-build gates, and the logic that each screen must preserve during UI work.
- The local mobile release gate now runs TypeScript plus five focused Realtime lifecycle/scoping tests; it passed on 2026-07-27.
- The exact applied `v2_scoped_realtime_broadcast` migration source was recovered byte-for-byte from the archived release worktree into `docs/supabase/migrations/202607220004_v2_scoped_realtime_broadcast.sql` and checked against the live functions, policy, triggers, and `courts_with_stats.market` contract. No production mutation was made.
- Build-9 screen/flow evidence and Jesse's annotations are stored under `docs/product/screen-library/releases/ios-1.0.0-build-9/`.
- Product, brand, launch, decision, and activity documents are consolidated under `docs/product/`.
- A dependency-free snapshot of web `main` at `7a5b74d` is imported under `artifacts/web`; its 56 source files matched the verified upstream commit before adding local provenance metadata.
- PR #22 (MVP consolidation) merged to `main` as `bcf9605` on 2026-07-30.
- The iOS distribution provisioning profile was regenerated via `eas credentials` (Build Credentials → do not reuse original → generate new) so it includes the Push Notifications / `aps-environment` capability that `expo-notifications` (added in PR #22) requires to compile. This was blocking every build of `main` (builds 10, 11) with `XCODE_BUILD_ERROR` before the fix.
- App version bumped `1.0.0` → `1.0.1` (PR #23, commit `d193ac8`) so the runtime version changes too (`runtimeVersion.policy: appVersion`). This stops future native binaries from being considered OTA-compatible with updates meant for the pre-`expo-notifications` runtime.
- Tag `v1.0.5` → build 13 → TestFlight, both `build_ios` and `submit_ios` succeeded (workflow `019fbb3e-b3b6-7830-ad63-cb4545af256c`). Jesse confirmed on-device: no launch crash, app "works for the most part," "feels snappy," core logic present.

## What is not complete

- The Add Court review follow-up now derives an established canonical market
  from nearby court coordinates and moves quota, duplicate detection, and
  insertion into one locked database transaction. Its new migration and the
  updated `verify-court` function remain unapplied/undeployed, so Add Court is
  still not a production-ready flow.
- Report/Block controls now fail closed behind a backend capability probe, and
  the unapplied safety migration blocks direct `run_participants` writes across
  blocked relationships as well as invitations. Until that migration is
  applied, installed clients do not render the controls.

- LocalCheckProd is now in a **partial notification state**. Read-only inspection on 2026-08-01 confirmed live `notifications`, `push_tokens`, and `run_invitations` tables; notification/run RPCs; and `profiles.push_notifications_enabled`. The `send-notification` Edge Function was not deployed (only `delete-account` was listed), and no Database Webhook or two-phone delivery proof was established. The exact reduced migration applied to production is not represented as one canonical migration on GitHub `main`; reconcile repository and live truth before further backend work.
- The sport-split Elo backend is not active. Live `profiles` still exposes the combined `elo_rating` and does not expose `elo_basketball` or `elo_pickleball`; the client fallback prevents a crash but the UI promise remains ahead of storage truth.
- Phone push registration is still broken on build 13, even with the native module present and the provisioning-profile entitlement fixed. Tapping "Turn on Phone Alerts" returns "Alerts are not on: The phone could not be registered." Not yet root-caused. Leading theory (unverified): EAS credentials has a distinct, separate "Push Notifications: Manage your Apple Push Notifications Key" entry that this session never touched — only "Build Credentials" (distribution cert + provisioning profile) was regenerated. `expo-notifications`' `getExpoPushTokenAsync()` needs an APNs key uploaded to EAS so Expo's push service can talk to Apple on the app's behalf; if that key was never created, registration would fail exactly like this. Check `eas credentials` → iOS → production → "Push Notifications: Manage your Apple Push Notifications Key" before assuming anything else. The durable in-app inbox remains the source of truth if phone push stays broken.
- The current Elo candidate is intentionally basic: separate basketball and pickleball ratings, 1200 start, standard K=32, opponent confirmation, objection with no rating change, and seven-day automatic confirmation. Advanced rating mechanics and the final objected-score retention rule remain later work.
- Build 13 now ships the private-Broadcast Realtime client (it was part of PR #22, merged 2026-07-30) — the old public `postgres_changes`/`PrivateOnly` failure mode described below should no longer apply to what's installed, but this has **not been re-verified against build 13 specifically**. Confirm before relying on it.
- The rebuilt local browser joined private Jaycee Park, Houston, and signed-in-user topics with `SUBSCRIBED` status and no local `PrivateOnly` error. Jesse then confirmed a TestFlight-originated court change (from build 9) appeared live in the already-open browser without a tab switch. This proved the new receiving path against build 9; reverse-direction and full two-phone acceptance on build 13 remain open.
- Physical native-map acceptance remains open. The web preview passed Houston market scope, map-layer positioning, low-zoom clustering, and styling. Cluster expansion now follows Mapbox GL JS's documented callback contract, but its final automated click replay was blocked by the preview controller's localhost safety policy. TestFlight build 9 does not contain this candidate.
- App-wide profile privacy is not complete. The current `profiles` contract has no persisted visibility field, leaderboard queries cannot filter it, and the Settings value is session-scoped check-in visibility. The local Compete presentation prevents the signed-in hidden user from appearing twice, but durable cross-client privacy requires an approved schema/service/RLS change and full surface audit.
- Four client write paths target tables they cannot write. LocalCheckProd is a v2 schema that revoked default ACLs and routes behaviour through `SECURITY DEFINER` RPCs, with narrow **column-level** grants on a few tables. `information_schema.role_table_grants` hides column-level grants, which is why this went unnoticed. Full map and verification recipes: [`BACKEND_WRITE_PATHS.md`](BACKEND_WRITE_PATHS.md).
  - **Schedule "My Times"** — fixed client-side. `authenticated` may INSERT `user_id` but not UPDATE it, and `.upsert()` compiles to `ON CONFLICT DO UPDATE SET user_id = …`, rejected with `42501`. Now uses `ignoreDuplicates: true` (`DO NOTHING`), verified against production in a rolled-back transaction. **No migration required** — an earlier `GRANT` migration was written on a wrong diagnosis and has been deleted.
  - **Add Friend** — fixed client-side. `friendships` is SELECT-only; the old code inserted directly and discarded the error. Now uses `request_friend` / `accept_friend_request` / `remove_friendship`. `request_friend` creates **`pending`**, the profile button shows `REQUESTED`, and Me → Friends exposes incoming accept/decline actions plus the full Friends screen.
  - **Add a Court** — still broken in build 13, but the local source candidate now replaces the nonexistent `/api/courts/verify` call and rejected direct insert. It uses a Gorhom task sheet, removes manual sport selection, reverse-geocodes editable location data, and invokes an authenticated `verify-court` Edge Function that performs Gemini classification, duplicate protection, and the complete authorized insert together. `GEMINI_API_KEY` is present as a Supabase secret. Deployment was blocked by the Codex account usage limit and did not start; see [`product/ADD_COURT_HANDOFF.md`](product/ADD_COURT_HANDOFF.md) for the exact activation and proof steps.
  - **Edit a Run** — still broken. `runs` is SELECT-only and no update RPC exists.
- The local candidate no longer reports an empty or court-less Schedule save as success. It disables an unchanged Save, retains failed selections, and supports a Court Details deep-link with the court preselected. Signed-in write proof on a physical client is still required before delivery.
- Add Friend does nothing in build 9. The local candidate uses the existing friend-request RPCs and includes incoming accept/decline surfaces, but physical two-account proof is still required.
- The local Profile candidate obtains a real lifetime `check_ins` row count rather than labeling court-time minutes as check-ins.
- Normal hot-reload Expo web still needs Watchman on this machine; without it, Node file watching reaches `EMFILE`. The repeatable export-and-serve fallback is working, but source edits require restarting the script. The launcher now calls the checked-in app's installed Expo binary directly, so a different global or pnpm version cannot prompt an agent to replace the canonical dependency tree.
- The repeatable preview server now sends no-cache headers for every export asset and serves the Expo app shell for direct client routes such as `/schedule` and `/court/:id`. This prevents the stable development bundle filename from reopening a stale build after restart. It remains an export preview, so code edits still require rerunning the script.
- The imported web app has not yet passed install/build/preview inside this pnpm workspace; source synchronization is complete, integration is not.
- The shared-system browser pass is complete. Physical iPhone acceptance remains open for safe areas, keyboard/sheet behavior, native Mapbox, dense Schedule states, and same-viewport comparison against the supplied mocks.
- The new design-foundation candidate is local only. It still needs Jesse's
  visible review, Expo Go smoke testing, focused release checks, and explicit
  approval before any commit, push, OTA, or TestFlight build.
- Account-deletion client and Edge Function source exist in the local candidate. A 2026-07-29 read-only live-schema check disproved the archived `ON DELETE RESTRICT` review warning: `profiles.id` cascades from `auth.users`, profile-owned rows cascade, and retained historical references use `SET NULL`. A checked-in migration now reproduces that contract. The function now generates Apple's short-lived ES256 client secret from `APPLE_PRIVATE_KEY`, `APPLE_KEY_ID`, `APPLE_TEAM_ID`, and `APPLE_CLIENT_ID`, matching the uploaded Supabase secrets. Deployment and physical delete-account proof remain merge/release blockers.
- App Store release QA/submission is still ahead.

## Approved working direction

- One brand accent: `#FF5500`; no scattered alternate oranges.
- One shared primary-tab header: mark + tab name; no top-right profile avatar.
- Schedule defaults to the shared heatmap; `Edit My Times` enables multi-select and `Done` saves once.
- Host a Run uses standard native date/time controls and the shared modal-form shell.
- Court preview uses a proven contextual bottom sheet; form tasks use a standard modal presentation.
- Court pages use a stable summary followed by `Feed`, `Locals`, `Schedule`, and `Details` tabs.
- Home uses a full-width matte local-court section. `Who's Here` owns its inline `View all` action, and only the Activity Feed scrolls.
- Explore keeps the shared header and uses `List` / `Map` as its primary view switch.
- Court cards use basketball blue and pickleball green only as restrained metadata in the emblem, faint glowing court geometry, smoked hue, and a thin left identity edge. Orange remains the live/action/ranked signal.
- Presence terminology converges on `Check in`, `Here now`, and `Locals` with one meaning per count.
- A court check-in is durable database state, not WebSocket presence. Phone lock, backgrounding, disconnect, or leaving a screen never means checkout. Live subscriptions exist only while a relevant screen is active; returning to the app performs one scoped catch-up refresh without requiring tab switching.
- Keep Add Court and LocalPlus in the product plan. Finish their trusted service integrations; do not turn compliance review into a default recommendation to delete functional product surfaces.

## 2026-08-03 — Apple compliance and safety source checkpoint

- Added the supplied Expo `ios.privacyManifests` asset to `app.json`; Expo CNG
  will generate the native `PrivacyInfo.xcprivacy` during prebuild.
- Settings now reads the version and build from native application metadata.
- Notification taps now accept only the known `/friends`, `/notifications`,
  `/match/<uuid>`, and `/run/<uuid>` destinations. This protects navigation;
  notification recipient selection remains server-side by `user_id`.
- Live read-only inspection found the actual push gap: production has the
  notification/token tables and RPCs, but zero registered device tokens,
  seven pending notifications, and no deployed `send-notification` function.
  The local client now surfaces the database registration error instead of the
  generic "phone could not be registered" message, and the sender source now
  retries transient Expo failures and records exact ticket errors.
- Added a local, unapplied `user_blocks` / `user_reports` migration plus profile
  Report and Block controls. The migration removes friendships, prevents
  blocked run interactions, and enforces profile/activity/check-in/run
  visibility at the database layer. No production schema was changed.
- Added the Apple-only owner checklist under `product/AppStore_Docs`; Google
  Play is explicitly outside the MVP submission scope.
- Verification: mobile TypeScript, notification-route tests, and all Realtime
  tests pass. Production deployment and two-phone push proof remain separate
  approval/physical acceptance steps.

## 2026-08-03 — Add Court source checkpoint

- Replaced the hand-built/nonfunctional Add Court path with a shared
  `TaskBottomSheet` backed by `@gorhom/bottom-sheet` modal, scroll, and input
  primitives.
- Removed the sport selector. Gemini's structured result is the only sport
  classification path and accepts basketball or pickleball at 80% confidence.
- Added editable reverse-geocoded location, explicit access reporting,
  authenticated invocation, a five-per-day guard, 150-meter duplicate guard,
  and one server-side verification/create transaction boundary.
- Photos are analyzed inline but not stored. The Gemini and service-role keys
  never enter the client.
- Static/release checks and a fresh web export pass. Production deployment and
  physical accepted/rejected-photo proof remain open because the Supabase
  deployment path was blocked by the Codex account usage limit before any
  mutation occurred.

## Next sequence

Build 13 is live and functional on Jesse's phone as of 2026-08-01. PR #22 is
merged; steps 1, 2, and 5 below from the pre-2026-08-01 plan are done. Updated
priority order:

1. **UI/design polish** — Jesse's stated next priority now that the app is
   functional again ("this could finally be the last push, ui update stuff").
2. Root-cause and fix phone-push registration ("Alerts are not on: the phone
   could not be registered") — see the APNs-key theory in "What is not
   complete." Needs another native build once fixed (push key alone may not
   need one — confirm before assuming a rebuild is required).
3. Reconcile the live reduced notification schema/RPC state with one canonical
   checked-in migration, then obtain Jesse's explicit approval before deploying
   a push sender/webhook or making any additional production change. Keep the
   sport-split Elo migration out of the current MVP scope unless separately approved.
4. Re-run two-device Realtime acceptance against build 13 specifically (prior
   proof was against build 9's older client).
5. Physical Mapbox quality acceptance on build 13.
6. Complete recovery snapshot/runbook, privacy/compliance, App Store QA,
   screenshots/metadata, external TestFlight, and submission.

**Process gap worth deciding on, not yet fixed:** `publish-ota-update.yml`
fires on every push to `main` regardless of content. That's what let PR #22's
`expo-notifications` addition (a native-requiring change) get OTA-published
onto build 9's older native binary and crash it — see the RELEASE_RUNBOOK
gotcha and the 2026-08-01 ledger entry. Worth a guard (e.g. only auto-publish
when the diff is JS/asset-only) but that's a workflow-behavior decision for
Jesse, not something to change unilaterally.

## Web truth

- Remote web `main`: `jGPT-Automated/LocalCheck_WEB` at `7a5b74d03aaa20a07ecf58d3ef4d2daef903c2be`.
- The old local PR checkout was `codex/weather-auth-heatmap` at `cb60ad406747`, ten commits ahead of main with local package changes. It is preserved at `/Users/JesseH/Projects/archive/LocalCheck_WEB_PR2-branch-2026-07-26` and is not current truth.
- Current source snapshot: `artifacts/web`, imported from that exact main commit without dependencies or nested Git metadata.
- Remaining work: validate package-manager integration, build, and preview before calling the web app monorepo-ready. Do not merge the archived PR branch by assumption.

## Evidence and history

- Activity and decisions: [`product/ACTIVITY_LEDGER.md`](product/ACTIVITY_LEDGER.md)
- Launch burn-down: [`product/LAUNCH_CONTROL.md`](product/LAUNCH_CONTROL.md)
- Build-9 screen map: [`product/screen-library/releases/ios-1.0.0-build-9/SCREEN_MAP.md`](product/screen-library/releases/ios-1.0.0-build-9/SCREEN_MAP.md)
- Release procedure: [`RELEASE_RUNBOOK.md`](RELEASE_RUNBOOK.md)
- Canonical design-system entry: [`product/design system/README.md`](product/design%20system/README.md)
- Current design acceptance: [`product/DESIGN_QA.md`](product/DESIGN_QA.md)
- Current first-time-user and production UI assessment: [`product/assessments/2026-08-01-current-build-assessment.md`](product/assessments/2026-08-01-current-build-assessment.md)
- Required contributor architecture: [`APP_ARCHITECTURE.md`](APP_ARCHITECTURE.md)
- Workspace/archive classification: [`WORKSPACE_MAP.md`](WORKSPACE_MAP.md)
