# LocalCheck current state

Last verified: 2026-07-27, America/Chicago

This is the short current truth. Use the activity ledger for history and the
release runbook for deployment steps.

## Solid checkpoint

| Item | Verified state |
| --- | --- |
| GitHub repository | `jGPT-Automated/LocalCheck_Expo` |
| Canonical local folder | `/Users/JesseH/Projects/LocalCheck_Expo` |
| Branch | `main` |
| Local `HEAD` and GitHub commit | Local `main` contains the candidate at `32bc0d6`. `origin/main` does not yet contain it because GitHub push execution was blocked by the Codex account usage limit. |
| Local working tree | Clean after the candidate commit. The candidate includes private Broadcast, Mapbox-native Explore layers/clustering, premium Explore cards, truthful Compete privacy/rank presentation, Schedule batch editing, tests, preview tooling, and documentation. |
| Release tag | `v1.0.4` → checkpoint commit |
| TestFlight | LocalCheck `1.0.0 (9)` available to Jesse |
| Successful EAS workflow | `019f9e9b-188e-70b8-9ff3-f1aa9a66b52e` |
| Expo project id | `9c906173-0258-45a9-a3fe-786cda373c66` |
| Supabase project | LocalCheckProd `qkrnmyexzvaxiqfxwwfb` |

Build 9 is the first solid checkpoint for this phase: the current GitHub main
reached TestFlight, native Mapbox dependencies installed, and Apple Sign-In
remains enabled. Its public Realtime listeners are rejected by the private-only
project. The local candidate now receives scoped private Broadcast updates in
the browser, but it has not been delivered to TestFlight.

## What is complete

- GitHub main restored as the local mobile source of truth.
- Mapbox secret download credential fixed in Expo environments.
- EAS fingerprint mismatch removed by the `appVersion` runtime policy.
- Tagged iOS build completed and submitted to TestFlight.
- Old global polling storm removed; acting-device and focus/foreground refreshes remain, without a recurring timer.
- A local Realtime release candidate now replaces every shipping-app `postgres_changes` listener with authorized private Broadcast topics. One hub deduplicates topics, coalesces invalidations, caps exact court topics, closes all channels while inactive/hidden, restores desired topics on return, and fails closed after repeated subscription errors.
- Explore now uses a Compete-style full-width `List` / `Map` switch, market-scoped discovery (five visible, ten fetched), premium smoky cards with in-card Check In, active/local counts, and restrained sport metadata. Web points are Mapbox canvas layers with built-in clustering; native uses the equivalent `ShapeSource` layers. The signed-in preview passed list, cluster-rendering, and Schedule multi-select checks.
- Schedule now has inline `View / Edit` mode. Cell taps only update pending local state; `Save` commits the additions/removals together and performs one catch-up refresh. Browser QA selected and cancelled multiple cells without writing test data.
- Compete no longer presents `All / BB / PB` as separate rankings when the backend stores only one overall Elo. A hidden current-user placeholder now appears inline at its would-be position without changing public row numbering or duplicating the user publicly in that client view.
- The local mobile release gate now runs TypeScript plus five focused Realtime lifecycle/scoping tests; it passed on 2026-07-27.
- The exact applied `v2_scoped_realtime_broadcast` migration source was recovered byte-for-byte from the archived release worktree into `docs/supabase/migrations/202607220004_v2_scoped_realtime_broadcast.sql` and checked against the live functions, policy, triggers, and `courts_with_stats.market` contract. No production mutation was made.
- Build-9 screen/flow evidence and Jesse's annotations are stored under `docs/product/screen-library/releases/ios-1.0.0-build-9/`.
- Product, brand, launch, decision, and activity documents are consolidated under `docs/product/`.
- A dependency-free snapshot of web `main` at `7a5b74d` is imported under `artifacts/web`; its 56 source files matched the verified upstream commit before adding local provenance metadata.

## What is not complete

- TestFlight build 9 still opens public `postgres_changes` channels, so LocalCheckProd continues to log `PrivateOnly` retries from that installed client. Jesse approved saving the repaired source candidate to `main`, but no OTA/TestFlight delivery was authorized, so the installed phone client remains unchanged.
- The rebuilt local browser joined private Jaycee Park, Houston, and signed-in-user topics with `SUBSCRIBED` status and no local `PrivateOnly` error. Jesse then confirmed a TestFlight-originated court change appeared live in the already-open browser without a tab switch. This proves the new receiving path; reverse-direction and full two-phone acceptance remain open until the repaired client is delivered to the phone.
- Physical native-map acceptance remains open. The web preview passed Houston market scope, map-layer positioning, low-zoom clustering, and styling. Cluster expansion now follows Mapbox GL JS's documented callback contract, but its final automated click replay was blocked by the preview controller's localhost safety policy. TestFlight build 9 does not contain this candidate.
- App-wide profile privacy is not complete. The current `profiles` contract has no persisted visibility field, leaderboard queries cannot filter it, and the Settings value is session-scoped check-in visibility. The local Compete presentation prevents the signed-in hidden user from appearing twice, but durable cross-client privacy requires an approved schema/service/RLS change and full surface audit.
- Add Friend does nothing in build 9 and is a confirmed regression.
- Profile `CHECK-INS` is wired to `total_court_time_minutes`, so the label and value do not represent the same metric; this is separate from Realtime delivery.
- Normal Expo live preview is not yet reliable in the clean checkout. Both canonical `node_modules` paths are symlinks into the archived pre-main checkout. Metro's live server reaches the external dependency tree, then fails with `EMFILE` because Watchman is absent and the archived root dependency tree contains roughly 445,000 files. `script/start_local_preview.sh` now provides one repeatable entrypoint: normal Expo when dependencies are canonical, or an interactive export-and-serve fallback while the archive links remain. The fallback is suitable as a second Realtime client but has no hot reload and is not the durable dependency repair.
- The imported web app has not yet passed install/build/preview inside this pnpm workspace; source synchronization is complete, integration is not.
- UI needs the documented shared-system pass: safe areas, headers, typography, spacing, colors, components, sheets/forms, court tabs, map layout, and terminology.
- App Store release QA/submission is still ahead.

## Approved working direction

- One brand accent: `#FF5500`; no scattered alternate oranges.
- One shared primary-tab header: mark + tab name; no top-right profile avatar.
- Schedule defaults to the shared heatmap; `Edit My Times` enables multi-select and `Done` saves once.
- Host a Run uses standard native date/time controls and the shared modal-form shell.
- Court preview uses a proven contextual bottom sheet; form tasks use a standard modal presentation.
- Court pages use a stable summary followed by `Feed`, `Locals`, and `Details` tabs.
- Explore keeps the shared header and uses `List` / `Map` as its primary view switch.
- Court cards use basketball blue and pickleball green only as restrained metadata in the emblem, faint geometry, and smoked hue; no colored side stripe. Orange remains the live/action signal.
- Presence terminology converges on `Check in`, `Here now`, and `Locals` with one meaning per count.
- A court check-in is durable database state, not WebSocket presence. Phone lock, backgrounding, disconnect, or leaving a screen never means checkout. Live subscriptions exist only while a relevant screen is active; returning to the app performs one scoped catch-up refresh without requiring tab switching.

## Next sequence

1. Restore the local preview with a canonical, lockfile-derived mobile dependency installation. First establish a safe disk budget; then move the archived-dependency symlinks to `Delete`, replace the ignored `.env` link with a canonical local `.env` without exposing its values, run a filtered pnpm install for the mobile app and its workspace dependencies, and verify typecheck plus the normal Expo start command. Do not make the archived checkout a permanent Metro dependency.
2. Review the private-Broadcast candidate on `main`, prove reverse-direction/background/scoping behavior, then obtain Jesse's explicit approval before OTA/TestFlight delivery.
3. After approved delivery, run the physical native-map acceptance pass and capture evidence; do not substitute the verified web preview for the phone.
4. Complete two-phone live-flow acceptance and fix Add Friend.
5. Implement shared tokens/components and the approved screen changes collaboratively.
6. Complete App Store QA, screenshots/metadata, and submission.

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
- Workspace/archive classification: [`WORKSPACE_MAP.md`](WORKSPACE_MAP.md)
