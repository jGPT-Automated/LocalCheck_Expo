# LocalCheck Activity Ledger

Status: Active, chronological operating record
Last updated: 2026-07-28

## How this ledger is used

- Append a dated entry on nearly every meaningful LocalCheck work turn.
- Record the requested outcome, actions taken, problems encountered, resolution or open question, evidence, and the next highest-value action.
- Do not rewrite history to make a failed attempt disappear. Later entries may correct earlier conclusions with new evidence.
- Keep `LAUNCH_CONTROL.md` as the concise current-state and priority view. Use this file for the chronological trail that explains how the project reached that state.
- Product and design decisions also belong in `DECISIONS.md`; notable brand-system changes also belong in `CHANGELOG.md`.

## 2026-07-28 — Verified MVP candidate delivered to GitHub main

**Outcome requested:** Retry the final source push after the previous Codex usage-limit rejection, without disturbing newer local work.

**Action and verification:** Refreshed the explicit remote `main` ref, confirmed local `main` still contained feature commit `32bc0d6` and documentation commit `f973ac3`, and pushed `249c926..f973ac3` to GitHub `main` without force. The canonical checkout had since moved to `fix/schedule-save-and-navigation-polish` with two newer commits and an unrelated untracked `.claude/launch.json`; that branch and file were preserved untouched. This follow-up record was prepared from an isolated `main` worktree and pushed separately so the repository no longer claims delivery is blocked.

**Boundary:** Source delivery only. No OTA, TestFlight build/submission, production schema mutation, merge of the newer fix branch, or release action was performed.

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
