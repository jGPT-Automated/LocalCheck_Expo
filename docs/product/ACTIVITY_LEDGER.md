# LocalCheck Activity Ledger

Status: Active, chronological operating record
Last updated: 2026-07-28

## How this ledger is used

- Append a dated entry on nearly every meaningful LocalCheck work turn.
- Record the requested outcome, actions taken, problems encountered, resolution or open question, evidence, and the next highest-value action.
- Do not rewrite history to make a failed attempt disappear. Later entries may correct earlier conclusions with new evidence.
- Keep `LAUNCH_CONTROL.md` as the concise current-state and priority view. Use this file for the chronological trail that explains how the project reached that state.
- Product and design decisions also belong in `DECISIONS.md`; notable brand-system changes also belong in `CHANGELOG.md`.

## 2026-07-28 — Canonical MVP draft PR opened; stale preview and PR split resolved

**Outcome requested:** Restart the stale local preview, consolidate every current MVP change into one canonical review PR, preserve useful history while removing competing open PRs, and leave the canonical checkout clean before any merge or TestFlight action.

**Preview:** Stopped the old port-8081 process, rebuilt the canonical Expo web export, and served it with no-cache asset headers plus Expo Router direct-route fallback. The user's visible `/compete` tab was explicitly refreshed to the new bundle and showed the current ranked/hidden-row candidate rather than the stale UI.

**Repository:** Committed the Profile, Court Details, Schedule, Friends, shared visual system, preview tooling, canonical design assets, and account-deletion candidate as `db7e0db` on `codex/mvp-consolidation`. Opened draft PR [#22](https://github.com/jGPT-Automated/LocalCheck_Expo/pull/22) directly against `main`. A final documentation-only commit follows this entry. PR #21's code is fully represented by this branch; #21 is closed as superseded rather than deleted so its discussion and commits remain recoverable.

**Configuration cleanup:** Removed a stale Expo Router production origin pointing to `replit.com`; LocalCheck does not use that host for production server requests. Disabled the image picker's default Android microphone permission because LocalCheck only requests court photos. Kept the existing Expo project, OTA URL, bundle identifier, Supabase target, and Apple Sign-In capability unchanged.

**Verification:** `pnpm --filter @workspace/mobile run check:release` passed TypeScript and all five focused Realtime tests. Expo public-config resolution passed without the stale host or microphone permission. `git diff --check` passed. The preview remains browser evidence only; native Mapbox, Schedule writes, sheets/safe areas, account deletion, and reverse-direction Realtime still require their documented physical/backend acceptance.

**Boundary:** Draft PR and documentation only. No merge, OTA, EAS build, TestFlight submission, Supabase function deployment/migration, or App Store action was performed. Jesse's explicit approval remains required after visual review.

## 2026-07-28 — MVP consolidation candidate: Profile, Court Details, Schedule, and repeatable preview

**Outcome requested:** Prioritize the supplied Profile and Court Details mocks, make Schedule truly save, keep Apple Sign-In untouched, and stop before push/OTA so Jesse can inspect the product decisions visually.

**Implementation:** Rebuilt Profile around the approved identity/Elo/stat/tab hierarchy and replaced the mislabeled court-time-minutes value with a real lifetime `check_ins` row count. Consolidated Home, Explore, and Court Details on the same smoked sport-identity court card; corrected its four-stat narrow-iPhone overflow. Court Details now has Feed, a real here-now/locals list, and the supplied seven-day court heatmap backed by `planned_visits`, visible run participants, privacy-safe anonymous counts, add/remove attendance, and a court-preselected Create Run handoff. Schedule keeps View/Edit multi-select, disables unchanged saves, retains failed work, and uses idempotent inserts rather than the rejected update-style upsert. Incoming friend accept/decline and player request states are present in the candidate, but Friends remains after the current core-screen acceptance gate.

**Preview/tooling repair:** Canonical root and mobile `node_modules` are real pnpm installs, not archive links. The preview script now avoids Expo's unwritable external cache and automatically uses a fresh interactive export when Watchman is absent, because normal Node watching reaches `EMFILE`. The workspace override that excluded the Mac ARM LightningCSS helper was removed and the lockfile records that optional native package. The deprecated Mapbox config-plugin token property was removed; native builds now read `RNMAPBOX_MAPS_DOWNLOAD_TOKEN` directly from EAS.

**Verification:** `pnpm --filter @workspace/mobile check:release` passes TypeScript and all five focused Realtime tests; `git diff --check` passes; a fresh canonical web export serves successfully on port 8081. Automated visual comparison is still blocked because the chosen in-app browser refuses automated localhost control. Jesse's refreshed signed-in preview is therefore the visual and interaction acceptance surface.

**Boundary:** No push, merge, OTA, TestFlight build/submission, production schema mutation, or Apple Sign-In change. The account-deletion client/Edge Function remains an undeployed candidate and must not be called complete. Profile visibility is still not a durable backend contract.

**Next highest-value action:** Jesse checks Profile, Court Details → Details, and Schedule → Edit in the refreshed preview. Fix visible or behavioral mismatches, obtain explicit approval, then create a clean reviewed commit before any delivery action.

## 2026-07-28 — Verified MVP candidate delivered to GitHub main

**Outcome requested:** Retry the final source push after the previous Codex usage-limit rejection, without disturbing newer local work.

**Action and verification:** Refreshed the explicit remote `main` ref, confirmed local `main` still contained feature commit `32bc0d6` and documentation commit `f973ac3`, and pushed `249c926..f973ac3` to GitHub `main` without force. The canonical checkout had since moved to `fix/schedule-save-and-navigation-polish` with two newer commits and an unrelated untracked `.claude/launch.json`; that branch and file were preserved untouched. This follow-up record was prepared from an isolated `main` worktree and pushed separately so the repository no longer claims delivery is blocked.

**Boundary:** Source delivery only. No OTA, TestFlight build/submission, production schema mutation, merge of the newer fix branch, or release action was performed.
## 2026-07-27 — CORRECTION: write-path audit; Schedule and Add Friend root-caused and fixed without any migration

**This entry corrects the previous one.** That entry concluded Schedule could not save because `planned_visits` was missing a `GRANT INSERT`, and proposed a migration. **That diagnosis was wrong.** It was reached from `information_schema.role_table_grants`, which shows only *table-level* grants and silently hides column-level ones. The migration was never applied and has been deleted.

**Actual root cause (Schedule):** LocalCheckProd grants `authenticated` column-level INSERT on `(user_id, court_id, planned_at, note, visibility)` and column-level UPDATE on the same set **minus `user_id`** — deliberately, so a row can never be reassigned to another user. The client used `.upsert()`, which PostgREST compiles to `INSERT … ON CONFLICT DO UPDATE SET user_id = excluded.user_id, …`. That requires UPDATE on `user_id` and is rejected with `42501` before RLS is consulted. Confirmed empirically by running the exact statement as `authenticated` in a rolled-back transaction: the upsert failed with `42501`, and the same insert with `ON CONFLICT DO NOTHING` succeeded and wrote a row. Fix is `ignoreDuplicates: true`, client-side only. **No database change was made or is needed.** Postgres's own error hint suggests granting table UPDATE; following it would re-grant `user_id` and undo the v2 design, and is explicitly warned against in code and docs.

**Actual root cause (Add Friend):** `friendships` is SELECT-only for `authenticated`; v2 routes all friendship writes through `request_friend`, `accept_friend_request`, and `remove_friendship`. `addFriend` inserted directly with `status: 'accepted'`, never destructured `error`, and wrapped the call in a `catch` that cannot fire because supabase-js returns errors rather than throwing — so the failure was fully invisible while the UI optimistically showed success. Now wired to the RPCs. Critically, `request_friend` creates **`pending`**, not `accepted`, while `fetchFriends` filters to `accepted`: swapping in the RPC alone would have produced the identical "button does nothing" symptom. Added `fetchFriendshipStates`, a separate `pendingFriendIds` in `AppContext`, and a `REQUESTED` button state; removing a pending request reuses `remove_friendship`. The optimistic `setFriendIds` that caused the flash-then-revert is gone.

**Two more broken write paths found by the same audit, not fixed:** `createCourt` inserts into `courts` (SELECT-only, and no `create_court` RPC exists), and `updateScheduledGame` updates `runs` (SELECT-only, no update RPC). Both need a product decision plus a migration and are recorded rather than guessed at.

**Provenance correction:** `docs/supabase/migrations/20260713_planned_visits.sql` and its pre-v2 siblings were applied to project `jzclwnzcektqhgkkdeje`, not LocalCheckProd. They do not describe the current database and must not be used to reason about current privileges. LocalCheckProd's real history is the `v2_*` migrations applied 2026-07-23.

**New durable doc:** [`docs/BACKEND_WRITE_PATHS.md`](../BACKEND_WRITE_PATHS.md) maps every client write to its correct backend path, records the two traps (column-level grants invisible in `role_table_grants`; `.upsert()` requiring UPDATE on every payload column), lists the still-broken paths, and gives the read-only privilege queries plus the rolled-back-transaction recipe for proving a write works before shipping it.

**Verification:** `pnpm run check:release` green — TypeScript clean, five Realtime tests passing. Both root causes and the Schedule fix were proven against production in transactions that rolled back; no row was added, changed, or deleted. **Not verified:** signed-in click-through of the repaired Schedule save and Add Friend button, because confirming them requires signing in.

**Boundary:** No migration applied, no schema change, no production data mutation, no OTA, no TestFlight build, no merge.

**Next highest-value action:** Sign in on the preview and confirm a planned visit actually persists and the friend button reaches `REQUESTED`; then decide the product shape for Add a Court and Edit a Run, which remain hard-blocked.

## 2026-07-27 — Checkpoint pushed as PR #20; Schedule save root-caused to a missing GRANT; navigation and sheet polish

**Outcome requested:** Review the unpushed local work against `main` and open a PR to lock the checkpoint in; onboard through the agent docs and report whether that read order works; confirm a live preview; run an honest UI/UX and architecture review; then fix the highest-leverage defects — Schedule "My Times" not saving, the `View / Edit` control, the white flash on interactive swipe-back, and the inconsistent task sheets.

**Checkpoint delivered:** Local `main` was two commits ahead of `origin/main` (`32bc0d6`, `f973ac3`) with a clean tree. Both were pushed on branch `checkpoint/realtime-broadcast-and-mvp-ui` and opened as PR #20 against `main`. `pnpm run check:release` was re-run independently on that branch before opening it: TypeScript clean, five Realtime tests passing. Local `main` was not moved.

**Schedule save — root cause found, and it was not the client.** Jesse reported the heatmap could not save times, and his capture showed the partial-failure banner. Read-only inspection of LocalCheckProd showed `planned_visits` held two rows with the newest dated 2026-07-23 and zero rows written in the previous three hours, so the writes never reached Postgres. The unique constraint `(user_id, court_id, planned_at)` that the client's `onConflict` depends on exists; the RLS policies `planned_visits_insert_self` and `planned_visits_update_self` exist and are correct; the schema, the broadcast trigger, and the `activity_events` upsert target all check out. The actual defect is at the privilege layer: `planned_visits` grants to `authenticated` are `SELECT, DELETE` only. RLS filters rows *within* privileges a role already holds, so without `GRANT INSERT` Postgres rejects with `42501` before any policy runs, and the existing insert/update policies are dead letters. Because `DELETE` *is* granted, removals succeeded while every addition failed — exactly the partial-failure banner. `20260713_planned_visits.sql` created the table and its policies but never issued the grants.

**Migration written, not applied:** `docs/supabase/migrations/20260727_grant_planned_visits_writes.sql` grants `insert, update` on `public.planned_visits` to `authenticated` and asserts afterward that both the grant and the governing policy exist. It widens no row-level access — effective access remains `user_id = auth.uid()` per the existing policies. `activity_events` deliberately keeps `SELECT`-only for `authenticated` because only the `SECURITY DEFINER` trigger writes it. **This has not been applied to production; it needs Jesse's go-ahead.** Until it is applied, Schedule saving stays broken regardless of client changes.

**Client defects fixed alongside it:** `saveMyTimes` returned silently when no court was selected, so Save did nothing with no feedback; it now shows a message and opens the court picker. It also called an empty batch a success — every pending slot already past reduced `additions` to `[]`, and `[].every(Boolean)` is `true`, so the editor closed as if it had saved. An empty batch is now reported honestly. The single boolean failure flag became a message field so a save can never look successful when nothing reached the database. Past slots were already disabled in edit mode, so that path was a narrow edge case rather than the reported bug.

**Design changes:** The full-width `VIEW / EDIT` segmented control was removed — mode is not navigation, and a segmented control reads as a destination. `EDIT` / `CANCEL` now lives in the existing `ScreenHeader` action slot (iOS Reminders/Photos grammar), which also returns vertical space to the grid; the row beneath now only reports state. The white flash on interactive swipe-back was react-navigation's default light card background: the root `Stack` had no `contentStyle`, so one was set to `Colors.background`, and `GestureHandlerRootView` was given the same background so nothing light is exposed mid-gesture.

**Sheet unification:** Five `presentationStyle="pageSheet"` modals each hand-rolled their own header, and all repeated `paddingTop: Platform.OS === "ios" ? top : top + 12` — which double-counts the inset on iOS, where a pageSheet is already inset below the status bar. That is why sheet titles collided with the status bar and rounded corners in Jesse's captures. `components/sheet/FormSheet.tsx` is now the single shell for task/creation forms: consistent header, eyebrow, 44pt close target, and correct per-platform top padding. Pick a Court, Host a Run, I'll Be There, and Edit Run were migrated to it and their dead local styles removed. `AddCourtModal` keeps its bespoke stepper header for now and received only the padding correction, with a comment tying it to `FormSheet`; folding it in fully is an open follow-up. The `@gorhom/bottom-sheet` court preview is unchanged — quick look stays a bottom sheet, doing a task uses `FormSheet`.

**Review findings recorded:** Colour and type tokens are well adopted (28 of 36 files import `Colors`, 24 import `Typography`, one literal font name app-wide), but there is no spacing scale at all, 517 raw `<Text>` and 255 raw `Pressable` call sites, 28 independent `StyleSheet.create` blocks, 38 distinct raw hex literals, and 24 raw `rgba()` literals. `ScreenHeader` covers three files against a decision that all five primary tabs share it. The approved presence vocabulary is unadopted: `HERE NOW` appears zero times while `ACTIVE` appears 219 times and `LIVE` 107. `explore.tsx` and `index.tsx` have no safe-area handling at all. Two entirely different tab bars ship simultaneously (`NativeTabs` and a classic JS `Tabs`), so the web preview cannot validate iOS visual work.

**Verification:** `pnpm run check:release` passed after every edit — TypeScript clean, five Realtime tests passing. The preview was rebuilt and served, and the new code was confirmed present in the exported bundle. The app booted with no new console errors (only a pre-existing React 19 `element.ref` library warning). **Not verified:** the signed-in Schedule screen was not visually confirmed. Expo's dev export writes a constant bundle filename (`entry-d41d8cd9…`, the MD5 of an empty string), so the browser served a stale cached bundle; clearing that cache also cleared the session, and entering credentials is outside what this agent will do. Pixel confirmation of the Edit/Cancel header, the sheets, and the swipe-back background is an open manual check.

**Boundary:** No production database change, no OTA, no TestFlight build or submission, and no merge. Local `main` untouched; work is on `fix/schedule-save-and-navigation-polish`.

**Next highest-value action:** Apply the `planned_visits` grant migration with Jesse's approval — Schedule cannot save until then — then sweep `services/` for the same swallow-and-return-false pattern that hid this failure for days.

## 2026-07-27 — Map layers, Explore card grammar, and Schedule batch editing completed

**Outcome requested:** Stop map points from drifting or forming false lines, use documented Mapbox behavior instead of free-coded markers, bring Explore cards closer to the premium Home treatment, reuse Compete's segmented-control language, remove inconsistent header subtitles, and replace Schedule's per-time drawer with inline multi-select editing. Prioritize the MVP-critical changes, verify them in the preview, document them, and deliver the candidate to `main`.

**Implementation:** Web Explore now feeds one GeoJSON source into Mapbox circle/symbol layers, uses built-in low-zoom clustering and expansion, and updates source data without rebuilding DOM markers. Native retains its documented `ShapeSource`/`CircleLayer`/`SymbolLayer` path. Viewport reads remain debounced, sequenced, capped at 250, and now include the saved local market so a Texas-wide viewport does not query or display irrelevant markets. Explore cards removed emoji sport icons, colored side stripes, boxed stat bands, and the detached action row. They now use a restrained single-color emblem, faint sport geometry and smoked hue, open active/local stats, and an in-card Check In action. Explore's primary switch matches Compete's segmented control. Compete's dynamic rankings subtitle and Schedule's duplicate profile entry were removed from primary headers.

**Schedule resource behavior:** `View / Edit` is inline above the weekly grid. Edit mode accepts multiple pending cell selections, preserves the underlying heat, supports public/friends/private visibility for new times, and exposes Cancel plus one Save action. Cell taps do not write. Save issues only the required idempotent additions/removals, then performs one planned-visits refresh; a partial failure keeps the pending selection and shows a retry message.

**Verification:** Mobile TypeScript and all five focused Realtime tests passed after implementation; `git diff --check` also passed. A fresh export was served at `http://127.0.0.1:8081/`. Signed-in phone-width browser QA showed the featured and discovery cards, the Compete-style Explore switch, honest open stats, Mapbox-rendered Houston points, a seven-court low-zoom cluster, the cleaned Compete header, and two simultaneous Schedule selections with a single `SAVE 2 TIMES` action. The test selections were cancelled, so QA made no planned-visit database mutation. After correcting cluster expansion to Mapbox GL JS's documented callback API, the preview controller blocked the final automated localhost reload under its browser-safety policy; cluster-click expansion therefore remains a focused manual replay alongside native physical-map acceptance. The candidate was committed on local `main` as `32bc0d6`. GitHub rejected the push before execution because the Codex account had reached its usage limit, so `origin/main` does not yet contain the candidate.

**Boundary:** No OTA, TestFlight build/submission, App Store action, or production schema mutation was performed. Native physical-map acceptance remains open because the installed build does not contain this source candidate.

## 2026-07-27 — Explore candidate rebuilt; map-marker and Compete presentation defects fixed

**Outcome requested:** Make Explore coherent across phone and preview: stable usable markers, a full-width `List` / `Map` switch, the player's local court featured before relevant nearby courts, bounded location-aware data, and website-inspired court-card identity. Also remove the misleading combined-sport ranking filter and stop a hidden player from appearing both publicly and as a duplicate hidden footer row.

**Implementation:** Explore now defaults to a bounded market/city query when a local court is known, fetches at most ten candidates, shows five until `View All`, and keeps global search user-triggered and capped. The local court has a featured identity card with real active/local counts. Basketball and pickleball receive restrained blue/green geometry, a matching right edge, and a glowing emblem; LocalCheck orange remains reserved for live state and primary actions. The parent Explore screen owns one full-width `List` / `Map` switch. Native Mapbox reapplies its scoped camera only after map readiness, includes a visible local-court point immediately, and uses sport-identity quiet pins plus orange live pins.

**Map root causes and resolution:** Web marker hover/selection scaling had been applied to Mapbox's outer marker element, overwriting Mapbox's translation transform and making markers jump into a false line. Scaling now lives on an inner visual element while Mapbox exclusively owns the outer translation. Runtime inspection then found eight stale Los Angeles context markers carried into the Houston map thousands of pixels off-screen; context merging is now limited to the current local market plus the local court, while viewport results remain authoritative.

**Compete truthfulness:** Removed the `All / BB / PB` selector because `profiles` stores one `elo_rating` and `fetchLeaderboard` cannot produce real sport-specific standings. Local rankings identify the court and sport; regional/global rankings are explicitly overall Elo. When the current user is hidden, the client removes their public row and inserts one inline owner-only placeholder at the would-be position without renumbering public players.

**Privacy boundary:** This is not app-wide privacy enforcement. `profiles` has no persisted profile-visibility field, profile adapters currently default to public, and Settings visibility is session-scoped check-in visibility. Solving privacy across leaderboards, people lists, schedules, and profiles requires an approved backend contract/migration plus service and RLS work. No production database change was made.

**Verification:** `pnpm --filter @workspace/mobile check:release` passed TypeScript and all five Realtime tests; `git diff --check` passed. A fresh static preview export was served at `http://127.0.0.1:8081/`. Signed-in browser QA showed Houston scope, the local court first, five of seven nearby courts, the new card art/counts, a single correctly translated map marker, and a working marker click that opened Jaycee Park's court sheet. Compete showed one inline hidden row and no sport-ranking selector. Native phone behavior remains unverified until Jesse approves delivery of this local candidate.

**Boundary:** No push, merge, OTA, TestFlight build, or production mutation was made.

## 2026-07-27 — Scoped private Broadcast client implemented; first live cross-client proof passed

**Outcome requested:** Let an agent implement resource-smart realtime so an active viewer sees a relevant court change without switching tabs, while backgrounded/hidden clients do no live work and connection state never controls check-in state.

**Implementation:** Added one signed-in `RealtimeHub` that accepts only authorized private `court:*`, `market:*`, `user:*`, and `run:*` topics. Duplicate consumers share one physical channel. Minimal invalidations are coalesced before authoritative RLS-protected refetches; map/list counts use a market topic instead of one channel per marker; exact court topics are capped at 20; malformed events are ignored; all channels close when the native app backgrounds or the web page hides; desired topics are recreated on foreground; and three consecutive channel failures fail closed instead of retrying forever. `CourtPresenceContext`, the app data store, and run detail now consume the hub. No recurring polling or socket-driven checkout was added.

**Repository/provenance:** Recovered `docs/supabase/migrations/202607220004_v2_scoped_realtime_broadcast.sql` byte-for-byte from the archived release worktree. Read-only LocalCheckProd inspection confirmed the source still matches the live receive policy, ten invalidation triggers, helper/functions, and `courts_with_stats.market`. No database change was applied.

**Verification:** `pnpm --filter @workspace/mobile run check:release` passed TypeScript plus five focused hub tests covering private subscription/deduplication/coalescing, inactive cleanup/recreation, failure containment, topic authorization, and the court-topic cap. No shipping-app `postgres_changes` listener remains. The rebuilt signed-in preview loaded Jaycee Park and reported successful private subscriptions for that court, Houston, and the signed-in user with no local `PrivateOnly` error. Jesse then confirmed a TestFlight-originated court change appeared in the already-open browser without a tab switch: the new receiving path works against production Broadcast.

**Boundary:** TestFlight build 9 still contains the old public listeners and continues to produce `PrivateOnly` retries while active. The reverse browser-to-phone path cannot be accepted until the repaired JavaScript reaches the phone. No push, OTA, TestFlight build, merge, or production mutation was made; each requires Jesse's explicit approval.

**Tooling clarification:** Finder's `December 31, 1969` date on the cached Supabase skill is a zero/Unix-epoch packaging timestamp, not the age of the guidance. The skill identifies itself as January 2026, its changelog includes June 2026 work, and current official Supabase docs still recommend private Broadcast for scalable, authorized database-change delivery.

## 2026-07-27 — Two-client realtime baseline failed; private-channel mismatch confirmed

**Outcome requested:** Determine whether current behavior is genuinely realtime and define a resource-smart implementation where active viewers of the same court converge immediately, inactive/irrelevant clients do no live work, and phone lock/background never implies checkout.

**Physical/runtime evidence:** Jesse kept the TestFlight app and local web client on Jaycee Park. After the phone checked in, the phone showed one active player while the web client stayed at zero. After the web client also checked in, web showed two active players and two roster entries while the phone stayed at one. Both clients updated their own mutations, but neither received the other client's update on the same screen. Navigation/focus caused a fresh query and exposed the latest state. This fails the no-tab-switch realtime acceptance criterion.

The supplied Profile capture showing `0 CHECK-INS` is a separate data-contract bug, not proof about channel delivery: the profile/player adapters currently feed `total_court_time_minutes` into the property and UI label named `checkIns`. Correct that metric meaning independently from the Realtime repair.

**Root cause confirmed:** LocalCheckProd Realtime logs during the test repeatedly report `PrivateOnly: This project only allows private channels`. Shipping `CourtPresenceContext.tsx` and `AppContext.tsx` create channels without `config.private: true`, subscribe with `postgres_changes`, and do not inspect/report subscription status. The app's explicit post-mutation refresh explains why the acting client updates; focus/foreground refreshes explain why tab switching appears to repair the other client. The rejected channels were retrying roughly every 1.5–2.5 seconds in the sampled log window, so the broken path was also creating avoidable connection churn.

**Backend correction to the earlier repo-only audit:** The live project already contains migration `v2_scoped_realtime_broadcast`, a scoped `realtime.messages` receive policy, and private database triggers that send minimal `invalidate` events to `court:{id}`, `market:{slug}`, `user:{id}`, and `run:{id}` topics. The repository does not currently contain the matching migration source, and the shipping mobile client does not consume this live contract. Therefore the remaining feature work is primarily client integration, lifecycle management, observability, migration-source recovery, and two-client/two-phone verification—not inventing the backend topic model from scratch. No production mutation was made during this diagnosis.

**Accepted product contract:** Check-ins remain database state and never end because a socket closes, the screen locks, or the app backgrounds. Subscribe only to the currently relevant private court/market/user/run topics, coalesce invalidations into authoritative refetches, remove channels when inactive or out of scope, and perform one scoped catch-up refresh on foreground. Keep the separate 45-minute server auto-checkout policy explicit as a product timer; it is not Realtime presence and should be changed only through a separate product decision.

**Next acceptance:** With two signed-in clients held on the same court, A's check-in/out must update B without navigation; a backgrounded B must hold no active screen subscriptions and catch up once on return; a client viewing an unrelated court must receive no court-specific event/refetch; subscription status/errors and active topic counts must be visible in diagnostics.

## 2026-07-27 — Local preview dependency root cause confirmed

**Outcome requested:** Start a live mobile-app preview, but stop if the approach would be messy, non-repeatable, or unsustainable.

**Evidence:** The canonical repo's root `node_modules`, `artifacts/mobile/node_modules`, and ignored `artifacts/mobile/.env` are symlinks into `/Users/JesseH/Projects/archive/LocalCheck_Expo-local-before-main-2026-07-26`. The archived root dependency tree is about 7.6 GB and 445,000 files; the mobile-level tree is about 298 MB and 20,000 files. Watchman is not installed. The normal `pnpm exec expo start --web --localhost --port 8081` path loaded the linked environment, reached Metro, and failed consistently with `EMFILE: too many open files, watch`.

**Diagnostic boundary:** A static web export first failed because Metro rejected the external Expo Router entry path. A temporary Metro override under `/private/tmp` admitted the archived dependency paths and produced a bundle successfully. That proves the canonical source can bundle, but it is not a durable fix: it is not a live-reloading server, it still depends on the archive, and it does not prove dependency parity with the canonical lockfile. No project source or permanent Metro configuration was changed.

**Accepted fix direction:** Do not install Watchman or commit Metro exceptions merely to preserve the cross-checkout dependency links. Establish enough disk headroom; move the two dependency symlinks and the `.env` symlink to `/Users/JesseH/Projects/Delete`; recreate `.env` locally without logging or documenting its values; install only the mobile app and required workspace packages from the canonical pnpm lockfile; then verify dependency versions, typecheck, a normal Expo live server, and a browser/device smoke pass. Keep TestFlight/development builds as the authority for native-only Mapbox, Apple Sign-In, SecureStore, and Location behavior.

**Temporary realtime-test handoff:** At Jesse's request, served the successful diagnostic web export locally at `http://127.0.0.1:8081/` so it can act as the second signed-in client alongside TestFlight. The in-app browser rendered the LocalCheck `/auth` screen with the LocalCheckProd environment loaded. Browser inspection found no runtime errors; the only warning was the existing React Native Web `shadow*` deprecation. The tab is left open for Jesse to authenticate and run the cross-client check-in/court-state test. This exported client is interactive and can receive Supabase updates, but it has no hot reload and does not replace the canonical dependency-install fix or native-device acceptance.

**Repeatability added:** Added `script/start_local_preview.sh` and its isolated `script/metro.preview.config.cjs`, then documented the single command in the first-read `AGENTS.md`. The entrypoint chooses normal Expo when canonical dependencies exist and otherwise recreates the proven interactive export-and-serve fallback without changing the app's default Metro configuration. This turns the successful diagnostic path into a visible, repeatable bridge while preserving the explicit gate for a lockfile-derived canonical dependency install.

**Verification:** Shell syntax and the Metro configuration syntax passed; the script is executable; its start path recognized the existing LocalCheck server rather than launching a duplicate; and a fresh `--export-only` run bundled 1,692 modules and exited successfully. The active preview still returned HTTP 200 on port 8081, the changed documentation passed whitespace validation, and no secret-value pattern was present in the new script, configuration, or first-read instructions.

## 2026-07-26 — Canonical source restored and launch order reset

**Outcome requested:** Stop working from stale local files and prioritize a functional phone build, native map, real Realtime behavior, then cohesive UI/brand and App Store submission.

**Actions:**

- Preserved the stale/diverged Expo checkout intact in `/Users/JesseH/Projects/archive/LocalCheck_Expo-local-before-main-2026-07-26`.
- Restored `/Users/JesseH/Projects/LocalCheck_Expo` to clean GitHub `main` from `jGPT-Automated/LocalCheck_Expo`.
- Established `/Users/JesseH/Projects/LocalCheck_Brand/LAUNCH_CONTROL.md` as the cross-project current-state and launch-priority document.

**Issue and resolution:** Local files mixed stale work with newer GitHub truth. Archiving rather than deleting preserved provenance and prevented accidental loss.

**Impact:** The canonical Expo folder now tracks the shipping source. Launch work is ordered around user-visible outcomes, not database-advisor or RPC cleanup.

## 2026-07-26 — Mapbox native-build credential repaired

**Outcome requested:** Get current `main` into TestFlight so the native Mapbox implementation can be tested on Jesse's phone.

**Actions:**

- Confirmed the iOS build requires a secret Mapbox token with `Downloads:Read` for native SDK artifacts.
- Updated Expo's `MAPBOX_DOWNLOADS_TOKEN` for development, preview, and production.
- Recreated `RNMAPBOX_MAPS_DOWNLOAD_TOKEN` as a secret compatibility variable across the same environments.
- Kept secret token values out of documentation and logs.

**Issue and resolution:** Workflow `019f9e4c-2678-7938-bfd4-e9629ba46c02` failed while installing `MapboxCommon` with HTTP 403. Correct token scope and Expo environment wiring removed that blocker.

**Impact:** The next build passed Mapbox dependency installation and reached Expo's project fingerprint validation.

## 2026-07-26 — Expo fingerprint failure fixed and build 9 delivered

**Outcome requested:** Complete the current-main iOS build and make it available through TestFlight.

**Actions:**

- Diagnosed workflow `019f9e7e-1ccb-7466-9b0e-765db0bf2b28` as a local-versus-EAS fingerprint mismatch involving generated native autolinking data.
- Changed the mobile runtime-version policy from nondeterministic `fingerprint` to stable `appVersion`.
- Committed and pushed `249c926` (`fix: stabilize Expo runtime version for iOS builds`) to `main`.
- Pushed tag `v1.0.4`, triggering workflow `019f9e9b-188e-70b8-9ff3-f1aa9a66b52e`.
- Verified from App Store Connect and Jesse's TestFlight screen that LocalCheck 1.0.0 build 9 is complete and available as an update.

**Issue and resolution:** EAS and local fingerprint calculation produced different native hashes despite the same source. The app-version runtime policy removed that nondeterministic release blocker while retaining explicit binary versioning.

**Impact:** Current `main` is now testable on Jesse's phone. Physical map and Realtime acceptance remain unproven until the app is updated and exercised.

## 2026-07-26 — Identity direction clarified; unapproved replacement removed

**Outcome requested:** Correct the TestFlight icon while keeping brand decisions collaborative.

**Actions:**

- An inferred LC-monogram replacement was immediately rolled back after Jesse rejected it.
- Restored the original Expo icon assets; moved the rejected monogram materials to `/Users/JesseH/Projects/archive/LocalCheck-rejected-monogram-2026-07-26/brand-logo`.
- Recorded `/Users/JesseH/Projects/LocalCheck_JAWS/Brand Asset Sheet.dc.html` as the current provisional visual base.
- Recorded the bracketed-check critique: awkward brackets, a checkmark that feels placed rather than integrated, poor optical balance, and a display face that feels too heavy.

**Issue and resolution:** The agent selected a logo without an approved source. The change was never committed or pushed, and the operating rule is now explicit: no logo or UI direction is implemented before collaborative review.

**Impact:** Build 9 shows the current bracketed-check concept. It is directionally relevant, not a final approved identity.

## 2026-07-26 — Browser references captured and workspace cleaned

**Outcome requested:** Preserve useful open design/project resources, understand Jesse's visual quality bar, and clear the crowded in-app browser.

**Actions:**

- Saved Material Design, App Store Tracker, Asoinspo, UI Vault, Logosystem, Tubik, Jesse's GitHub Design list, and Jesse's Dribbble likes in `REFERENCES.md`.
- Saved Supabase, Expo, and Mapbox project-admin links in the same reference index.
- Reviewed the design tabs and recorded the useful signals: benefit-led App Store frames, high-contrast mobile composition, map-led product moments, restrained bright accents, integrated logo geometry, and familiar mobile interaction structure.
- Closed the saved resource tabs and left one blank handoff tab for the upcoming local preview.

**Impact:** The visual references remain recoverable without keeping the browser crowded. They are a quality bar, not automatic approval to copy or implement a direction.

## 2026-07-26 — Realtime verification queued before UI work

**Outcome requested:** Test the real app locally and determine whether it uses Supabase's standard recommended Realtime approach, including Broadcast and channel subscription behavior.

**Current truth:** Current `main` uses `.on('postgres_changes', ...)` followed by `.subscribe()` in `AppContext.tsx` and `CourtPresenceContext.tsx`. It does not use `.on('broadcast', ...)` or database-triggered `realtime.broadcast_changes()`. Commit `249c926` changed only the Expo runtime-version policy and deployment documentation, so no Realtime migration occurred after PR #19.

**Documentation check:** Current Supabase guidance lists Broadcast as the recommended method for scalability and security. Postgres Changes is the simpler, lower-setup option and is suggested mainly for quick testing or low connected-user counts.

**Decision:** LocalCheck has removed the worst polling behavior, but it has not reached the requested standard Realtime architecture. Broadcast migration and a two-client acceptance test are required before Realtime is accepted.

**Next action:** Start a local preview without changing UI, capture the current behavior as a baseline, then define and execute the Broadcast migration with private channel authorization, database triggers, client subscriptions, cleanup, foreground catch-up, and two-client proof. UI/UX work stays behind this gate.

## 2026-07-26 — Build 9 screen library started

**Outcome requested:** Map the current TestFlight UI before redesign and preserve release-specific source captures for regression tracking, website storytelling, and future App Store assets.

**Actions:**

- Created `screen-library/releases/ios-1.0.0-build-9/` with release metadata, a navigation map, screenshot index, capture rules, and marketing-use restrictions.
- Recorded the first functional regression from the physical app: `Add Friend` appears on another player's profile but produces no visible result; Jesse confirms it worked in an earlier release.
- Captured the current empty Log Game form as the first locally persisted build-9 screen.

**Preview issue:** The canonical clean checkout has no dependency installation. Reusing the archived install by cross-folder symlink loaded the correct environment but Metro could not watch or resolve the external dependency tree. No package download occurred and no product code was changed. Local preview setup is paused while the physical build-9 screen map is captured.

**Next action:** Continue the physical screen inventory in user-flow order, then return to the local preview with a storage-safe local dependency layout.

## 2026-07-26 — Mobile table-stakes audit criteria added

**Observation:** Full-page scrolling allows content to move behind the iOS time, Dynamic Island, connectivity, and battery area. Jesse flagged it as visibly bad UI/UX.

**Assessment:** This is a safe-area and scroll-ownership defect, not a subjective style preference. It must be checked across every screen before visual polish.

**Skill evidence:** The installed official Expo native-UI guidance requires top and bottom safe-area coverage and automatic inset adjustment for scrollable lists. A `find-skills` search also identified Thumb First as the strongest external mobile-specific design/device audit option; no external skill was installed without approval.

**Action:** Added a release-wide table-stakes checklist covering safe areas, touch targets, type scaling, contrast, assistive technology, navigation, state coverage, keyboard behavior, reduced motion, and component consistency.

## 2026-07-26 — Primary tab-header direction confirmed

**Observation:** The Schedule header combines a tiny mark, a generic heavy title, and a top-right avatar without a coherent relationship.

**Decision from Jesse:** Make the mark and page title a shared lockup across primary tabs. Tab titles use the same typographic language as the LocalCheck wordmark to connect the app from tab to tab. Remove the profile avatar from the header because the `Me` tab already owns that navigation.

**Constraint:** The current display font remains too bulky and is not final. This decision locks the shared header grammar, not the final font or logo construction.

## 2026-07-26 — Schedule multi-select direction confirmed

**Observation:** Build 9 requires selecting and confirming one weekly availability square at a time, making repeated planning slow and annoying.

**Decision from Jesse:** The heatmap is read-only by default. `Edit My Times` enables a multi-select mode, cells toggle on/off, and `Done` saves the whole set back into the shared heatmap.

**Acceptance implications:** Personal selection and group heat must remain distinguishable, failed saves retain pending work, cells expose accessible state, and other clients receive the saved availability through Broadcast without tab switching.

## 2026-07-26 — Schedule structure and hierarchy reviewed

**Good baseline:** Schedule keeps its header fixed, so content does not pass behind the iOS status area.

**Defects identified by Jesse:** The content region still has awkward vertical scrolling, and its font sizes, weights, padding, and visual hierarchy are not logical or consistent.

**Direction:** Retain the fixed safe-area-aware header. Define a shared product type ramp, horizontal gutters, and spacing rhythm before visual implementation; do not tune each Schedule element independently.

## 2026-07-26 — Home people row added to hard-polish scope

**Observations from Jesse:** A long player name is cut off without graceful handling, while the `View All` box is larger than an actual player tile and receives disproportionate visual weight.

**Source check:** `HomeScreen.tsx` currently forces each player into a 48-point-wide tile, renders only `p.name.split(" ")[0]`, and gives `View All` a separate 72-point bordered card. The visual mismatch is encoded in the component rather than caused by the test name alone.

**Direction:** Treat the full Who's Here module as one polish task. Person and View All tiles share geometry; compact names truncate intentionally while full accessible names remain available; long single-token handles, friends, hidden users, empty state, and carousel ending all receive explicit states.

## 2026-07-26 — Sheet, Host a Run, color, and court-page contracts aligned

**Observations from Jesse:** The court drawer and Host a Run drawer use different visual styles and both feel unnatural on mobile. Host a Run is unintuitive, especially its custom day/time selection. Multiple orange values and locally invented components weaken cohesion. The full Court page should use a tab view for Feed, Locals, and Details.

**Source and documentation check:** The court preview already uses the proven `@gorhom/bottom-sheet` v5 package; Host a Run uses React Native's standard `pageSheet` modal but contains custom `DayGrid` and `TimeGrid` controls. Current Expo documentation recommends its native-backed DateTimePicker, and Expo Router documents modal/form-sheet presentations for focused workflows.

**Working decisions:**

- Keep the court preview as a contextual bottom sheet and creation/editing as modal form tasks, but give both one shared visual and behavioral shell.
- Replace the Host a Run custom day/time grids with Expo-supported native date/time pickers.
- Lock `#FF5500` as the single brand orange and route screens through shared color and component tokens.
- Restructure the Court page around a persistent identity/live summary and three tabs: Feed, Locals, Details.

**Implementation status:** Recorded for collaborative review; no UI code changed in this mapping pass.

## 2026-07-26 — Build 9 feels materially more live

**Physical-test observation from Jesse:** The current TestFlight build behaves much more like a realtime app than the earlier version. This is a meaningful product improvement and validates removing the old global polling/tab-switch dependency.

**Acceptance boundary:** The observation is positive qualitative evidence, not final Realtime sign-off. Build 9 still uses Supabase Postgres Changes subscriptions rather than the approved Broadcast path, and the two-client/two-phone acceptance test remains open.

**Priority effect:** Preserve the improved behavior through the Broadcast migration. UI polish can now focus on shared components and flows without treating the entire live-data experience as broken.

## 2026-07-26 — Build 9 declared a solid checkpoint

**Outcome requested:** Freeze the current working state, preserve the latest physical-device evidence, and organize the local workspace around one clear product source of truth.

**Evidence preserved:** Copied six additional 9:33–9:44 AM captures into the build-9 screen library with content hashes. They cover Home/Court and Compete/Player navigation transitions, Add a Court, Jesse's annotated map direction, the map empty state, and annotated court-sheet terminology/count issues.

**Source-of-truth verification:** `/Users/JesseH/Projects/LocalCheck_Expo` is a clean `main` checkout at `249c926ae3ac`, exactly matching live GitHub `jGPT-Automated/LocalCheck_Expo` `main`. The repo contains the Expo app at `artifacts/mobile` and the working EAS/TestFlight workflows at `artifacts/mobile/.eas/workflows/`.

**Web finding:** `/Users/JesseH/Projects/LocalCheck_WEB_PR2` is not web `main`. It is `codex/weather-auth-heatmap` at `cb60ad4`, ten commits ahead of `origin/main`, with local package-file modifications. Preserve it as an archive/reference rather than presenting it as current web truth.

**Workspace direction:** Use the already-existing pnpm workspace in `LocalCheck_Expo` as the canonical product repo. Keep the proven mobile/EAS path stable. Bring a clean copy of web `main` into the workspace only through a deliberate migration and verification step; do not blend the old PR checkout into current truth.

## 2026-07-26 — One active LocalCheck workspace established

**Actions:**

- Moved this product/brand/launch document set and the build-9 screen library into `LocalCheck_Expo/docs/product`.
- Copied the provisional JAWS Brand Asset Sheet into `docs/product/references/` so the active visual base remains available inside the canonical repo.
- Moved the remaining JAWS workspace intact to `/Users/JesseH/Projects/archive/LocalCheck_JAWS-reference-2026-07-26`.
- Moved the non-main web PR checkout intact to `/Users/JesseH/Projects/archive/LocalCheck_WEB_PR2-branch-2026-07-26`, preserving its branch and uncommitted package files.
- Added concise `AGENTS.md`, `docs/CURRENT_STATE.md`, `docs/WORKSPACE_MAP.md`, and `docs/RELEASE_RUNBOOK.md` entry points to the canonical repo.
- Preserved the stale July 13 source/task audit and pre-checkpoint agent map under `docs/archive/` and replaced their old top-level paths with pointers.

**Outcome:** `/Users/JesseH/Projects/LocalCheck_Expo` is the only active top-level LocalCheck folder. Nothing was deleted, the working EAS app path remains `artifacts/mobile`, and every future agent has one explicit catch-up path.

## 2026-07-26 — Clean web main imported into the product workspace

**Action:** Exported verified `jGPT-Automated/LocalCheck_WEB` `main` at `7a5b74d03aaa` into `LocalCheck_Expo/artifacts/web` using Git's commit archive. No dependencies or nested Git metadata were copied. All 56 source files matched the upstream commit before adding `UPSTREAM.md` provenance.

**Boundary:** This completes source organization, not web integration acceptance. The web app still carries its upstream npm lockfile while the parent workspace uses pnpm, and disk is too constrained for a safe fresh install. Build and preview verification remain a separate gate.

## 2026-07-28 — MVP visual and Schedule candidate verified locally

**Implemented:** Consolidated the primary-tab header and Oswald/Inter hierarchy; tightened matte court cards; moved sport filtering into the Explore search row; preserved city-scoped court discovery; added ranked/friend avatar states; rebuilt Me; split Court Details into Feed, Locals, Schedule, and Details; and rebuilt Schedule around 8 AM–11 PM heat buckets, current-time focus, View/Edit modes, a snapping run rail, and the shared form-sheet shell.

**Runtime evidence:** The signed-in export preview rendered Home, Explore List/Map, Compete, Me, all four Court Details tabs, the Schedule heatmap, and the Host a Run drawer. Direct `/schedule` and `/court/:id` loads now resolve through the preview app shell. The exported bundle is explicitly no-cache, preventing the stable Expo development bundle name from retaining a previous build after restart.

**Static evidence:** `pnpm --filter @workspace/mobile run check:release` passed TypeScript and all five scoped-Realtime tests. Browser logs contained framework deprecation warnings and one self-recovered court-channel warning, but no render or navigation exception during the inspected flows.

**Boundaries:** Apple Sign-In was not changed. No Supabase migration, Elo rewrite, merge, push, OTA, EAS build, or TestFlight action occurred. The external Elo handoff remains review-only until its schema assumptions and match-confirmation lifecycle are reconciled with the live contract.
