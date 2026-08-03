# LocalCheck Activity Ledger

## 2026-08-03 - PR #25 review boundaries hardened

**Review findings:** Add Court used the reverse-geocoded city as its market and
performed quota/duplicate reads separately from insertion. The safety migration
guarded invitations but not direct run-participant writes, while its client
controls would publish before the unapplied RPCs existed.

**Implementation:** Added a service-role-only transactional court-create RPC.
It takes one advisory transaction lock, resolves the nearest established market
within the metro radius, checks the per-user UTC quota and 150-meter same-sport
duplicate boundary, and inserts only if both checks pass. The Edge Function now
delegates the entire persistence boundary to that RPC. The safety migration now
guards every run-participant insert/update against the run organizer's blocked
relationships and exposes an authenticated capability probe; player profiles
render Report/Block only after that probe succeeds.

**Boundary:** No migration, Edge Function, OTA, or production change was
performed. Apply both migrations before deploying `verify-court`; the safety
controls intentionally stay hidden until their migration is live.

Status: Active, chronological operating record
Last updated: 2026-08-03

## How this ledger is used

- Append a dated entry on nearly every meaningful LocalCheck work turn.
- Record the requested outcome, actions taken, problems encountered, resolution or open question, evidence, and the next highest-value action.
- Do not rewrite history to make a failed attempt disappear. Later entries may correct earlier conclusions with new evidence.
- Keep `LAUNCH_CONTROL.md` as the concise current-state and priority view. Use this file for the chronological trail that explains how the project reached that state.
- Product and design decisions also belong in `DECISIONS.md`; notable brand-system changes also belong in `CHANGELOG.md`.

## 2026-08-03 — Add Court rebuilt on a trusted Gemini boundary

**Requested outcome:** Keep Add Court, replace its odd hand-built drawer with a
library component, remove the manual sport choice, use the newly configured
Gemini API key, wire the feature end to end, and leave a documented PR for the
next agent.

**Root cause:** The prior UI posted to a route that does not exist, accepted a
client-selected sport, manufactured a confirmed local ID, and attempted a
direct `courts` insert. LocalCheckProd intentionally grants authenticated users
read access rather than arbitrary court inserts, and the production table now
requires provenance, access, setting, market, location, and verification fields
that the client did not provide.

**Implementation:** Added a shared `TaskBottomSheet` using Gorhom's modal,
scroll, and text-input primitives. The new two-step flow captures editable
reverse-geocoded location and access, then a court photo; no sport control is
shown. `courtService` invokes the authenticated `verify-court` Edge Function.
The function verifies the caller, bounds the payload, limits each user to five
submissions per UTC day, sends the inline image to Gemini's current Interactions
API with a strict structured schema, accepts only basketball/pickleball at 80%
confidence, checks same-sport duplicates within 150 meters, and uses the service
role only for the complete production insert. The photo is not stored and no
secret enters the client.

**Evidence:** Mobile `check:release` passed TypeScript, five Realtime tests, and
two notification-route tests. `git diff --check` and Edge Function TypeScript
syntax transpilation passed. A fresh Expo web export bundled and started on
ports 8082/8083. The in-app browser controller blocked localhost navigation by
policy, so no visual acceptance is claimed.

**Open boundary:** Production deployment was attempted through the supported
Supabase paths, but the Codex account usage limit blocked both connector and CLI
approval before a deployment began. No production function, schema, secret, or
row changed. `ADD_COURT_HANDOFF.md` records the exact deploy command and the
authenticated, physical-photo, duplicate, and no-write rejection proof still
required.

## 2026-08-02 - Profile hierarchy normalized against mobile type standards

**Feedback:** The Me header handle and identity panel were visibly oversized.
The long handle and player name both used 23/27 display treatment, ELO used
32/35, the avatar was 68 points, and the four-stat row was 70 points high.
Meanwhile, several supporting labels were only 9 or 10 points. The result was
simultaneously too loud and too small, with no stable middle hierarchy.

**Benchmark:** Official Material 3 uses 16/24 for `titleMedium`, 14/20 for
`bodyMedium`, 12/16 for `bodySmall`, and 11/16 for `labelSmall`. Apple identifies
17 points as the iOS default and 11 points as the custom-interface minimum, and
requires the relative hierarchy to survive Dynamic Type.

**Implementation:** Added a semantic compact-mobile type scale. The Me handle is
now 17/22, the shared profile name 16/20, ELO 24/28, stats 18/22, supporting
text 12/16, and labels 11/16. The shared profile avatar is 56 points and the stat
row is 58 points. The change applies to the owner and other-player profile
scaffold without changing profile data, ELO logic, navigation, or backend work.

**Evidence:** Same-viewport 430 x 932 captures are stored under
`design-qa/2026-08-02-profile-type-scale/`. The after state restores a clear
identity, context, and metrics sequence. Physical iPhone Dynamic Type,
VoiceOver, and maximum accessibility sizes remain native acceptance checks.

## 2026-08-02 - Header lockup corrected to the approved identity

**Feedback:** The unified header was geometrically consistent but still looked
basic and bulky. Home showed the generic destination label `HOME`, the raster
mark was optically large, and detail routes replaced the identity with a boxed
chevron.

**Implementation:** Home now carries the `LOCALCHECK` wordmark. Primary and
detail titles use one 23-point Oswald 500 role with 1.5-point tracking, paired
with a 26-point vector mark rendered from the approved geometry. Detail routes
keep the same left-edge footprint and resolve the mark into an orange back
chevron over the shared 220ms state interval. Reduce Motion skips the spatial
transition. The back target remains 44 points, and the existing navigation and
data contracts are unchanged.

**Verification:** `check:release` passed TypeScript plus all five focused
Realtime tests, and `git diff --check` passed. The preview was rebuilt at
`http://127.0.0.1:8082/`. Same-viewport browser review confirmed the lighter
`LOCALCHECK` Home lockup, matching Compete baseline and scale, compact rank
signal, and the unboxed branded Settings back state. Native push/pop timing,
Reduce Motion, VoiceOver, and physical iPhone optical review remain checkpoint
acceptance items.

## 2026-08-02 - Primary-header contextual slot normalized

**Feedback:** The larger Compete rank and hidden-state block changed the visual
weight and perceived position of that header compared with the other primary
tabs. Each primary header should carry one useful contextual signal without
allowing that signal to reshape the shared shell.

**Implementation:** Added one compact, reusable header metric inside a fixed
44-point trailing slot. Home now shows players live now. Schedule shows the
number of players in the one-hour look-ahead block. Explore shows the number of
loaded courts within 10 miles. Compete reduces the rank readout to rank plus a
short `YOUR RANK` or `HIDDEN` label while keeping the full reason available to
  accessibility. Me uses the same slot for Settings; the notification inbox
  remains reachable through Settings. No data writes, backend contracts, or
  navigation destinations changed.

**Verification:** The focused release gate passed TypeScript plus all five
Realtime lifecycle/scoping tests, and `git diff --check` passed. The static
preview was rebuilt at `http://127.0.0.1:8082/`. Same-viewport browser review
confirmed one matching title baseline and header height across Home, Schedule,
Compete, Explore, and Me. The visible values were `0 LIVE NOW`, `0 GOING +1H`,
`8 COURTS · 10 MI`, `#5 HIDDEN`, and the Settings gear. No user or backend data
was changed during verification.

## 2026-08-01 - Shared mobile design foundation implemented locally

**Outcome requested:** Establish one coherent, iOS-first visual foundation
across the working application before investing in signature effects. Keep all
working backend, Realtime, service, and navigation behavior intact, then produce
an Expo Go and TestFlight review checkpoint.

**Implementation:** Added semantic spacing, control, shell, and motion tokens;
one shared primary header; one shared detail header and 44-point icon action;
one reusable underline/segmented tab control; restrained pressed states;
reduced-motion-aware entry and live-pulse behavior; optional rather than
generic haptics; and a top-only court-sheet outline. Migrated the primary tabs,
Settings, Friends, Notifications, Court Details controls, and both owner/remote
player profiles onto the shared grammar. Me now places `@USERNAME` beside the
brand mark with Notifications and Settings at the top right. Another player's
profile uses the same identity, ELO, and stat scaffold instead of the legacy
parallel layout.

**Transition decision:** Retained the Explore/map card-to-detail morph as a
high-value post-foundation spike. The current React Navigation path is
experimental; `react-native-morph-card` adds native build surface; and Expo
Router Apple Zoom requires the SDK 55 migration. None entered this release
candidate.

**Verification:** Mobile TypeScript and `git diff --check` pass. The canonical
static preview was freshly rebuilt and served at
`http://127.0.0.1:8082/`. Signed-in browser review covered Home, Explore,
Schedule, Compete, Me, Settings, another-player profile, and the selected-court
sheet. The shared mark/title coordinates now repeat across primary tabs, the
long test username truncates safely beside 44-point actions, both profile types
read as one family, and the court sheet shows no perimeter seam in its resting
state. No form, check-in, friend, or backend write was submitted during QA.

**Open gate:** Expo Go, physical iPhone safe-area/Dynamic Type/VoiceOver/Reduce
Motion, sheet drag, native Mapbox, and release-check acceptance remain. No
commit, push, OTA, TestFlight build, merge, or production mutation was made.

## 2026-07-29 — PR #22 review fixes implemented locally

**Outcome requested:** Use one simple review loop: fix every open PR #22
comment, include the latest Home and Me polish, verify the candidate, push it,
then reply to and resolve each GitHub thread before asking for merge approval.

**Implementation:** Added incoming friend-request actions to Me, made a
Schedule deep link initialize court selection only once, retained the last
verified lifetime check-in count when a refresh fails, scoped Court Feed to the
opened court, routed Court Schedule creation into the preselected Host Run
form, and derived ranked court avatars from the same local leaderboard service
used by Compete. The Home check-in action is narrower and elevated; Me activity
copy uses the loaded Inter extra-light face.

**Account deletion:** Read-only production inspection confirms the current
foreign-key contract supports auth-user deletion. Added an unapplied migration
that reproduces that contract in a replacement project. Updated the Edge
Function to generate Apple's short-lived ES256 revocation client secret from
the four uploaded raw Apple secrets. The function is still undeployed and
physically untested; no Supabase data or schema changed.

**Verification:** Direct mobile TypeScript passed, all five focused Realtime
tests passed, `git diff --check` passed, and a fresh Expo export returned HTTP
200 with no-cache headers for `/` and `/elo`. Signed-in phone-width browser QA
confirmed the Home action, lighter Me activity copy, Friends access, exact
non-local court feed data, and Court Schedule → Create a Run opening the
preselected Host Run form. No form was submitted and no QA data was written.

**Delivery state:** GitHub push, thread replies, and thread resolution are the
remaining gates for this review loop. PR #22 remains the only candidate. No
merge, OTA, EAS build, TestFlight action, or production backend mutation is
authorized in this step.

## 2026-07-29 — Home MVP section and contributor protection contract

**Outcome requested:** Make the final Home change for the canonical MVP PR,
restart the preview, and document the working architecture so later cloud UI
tasks cannot silently break app logic, connectivity, dependencies, or release
boundaries.

**Home:** Replaced the reusable discovery-card treatment with a full-width
matte local-court section. The sport mark is small and quiet, sport text is
lighter, confirmed activity stats are centered, and the local-court badge is
restrained. A non-local discovery card now exposes a dim `Set local` action.
Moved the detached roster count into an inline `View all` action. Kept Next Run
in its compact form. The header, court section, roster, and Next Run stay fixed;
only the Activity Feed scrolls.

**Architecture:** Added `docs/APP_ARCHITECTURE.md` to the mandatory `AGENTS.md`
read order. It records provider order, screen owners, service/RPC write paths,
private Realtime topics, native-build boundaries, and a page-by-page list of
behavior that UI contributors must preserve. Updated the README, current state,
launch control, design decision, and design QA records to point to the same
contract.

**Preview/tooling:** A fresh Expo web export compiled and is served with no-cache
headers at `http://127.0.0.1:8081/`. The preview launcher now calls the app's
installed Expo binary directly. This avoids a pnpm-version mismatch that
prompted to replace the workspace dependency tree; the prompt was declined and
no dependency was changed. The first OS screenshot showed the browser still
holding the prior page. Refreshing the app window hid the browser pane, so the
fresh bundle is live but this Home state still needs Jesse's visible reload
acceptance.

**Release boundary:** No merge, OTA, TestFlight build, Supabase migration, Edge
Function deployment, or production data change occurred. Draft PR #22 remains
the only review candidate.

## 2026-07-29 — Preview restart and account-deletion review correction

**Outcome requested:** Restart the canonical preview, inspect the open review threads on draft PR #22, and verify the proposed Apple revocation-secret setup before Jesse enters any credentials.

**Preview:** Rebuilt the canonical `codex/mvp-consolidation` web export with the repository-pinned pnpm `10.13.1` toolchain and served it at `http://127.0.0.1:8081/`. Port 8081 returned HTTP 200 with explicit no-cache headers. Runtime Supabase data remains interactive; source edits require another export restart.

**Review correction:** A reviewer predicted that `auth.admin.deleteUser` would be blocked by profile foreign keys using `ON DELETE RESTRICT`, based on an archived pre-repair checkpoint. A fresh read-only inspection of LocalCheckProd found `profiles.id -> auth.users(id) ON DELETE CASCADE`; current profile-owned rows cascade, while retained history such as `activity_events.actor_id` and `courts.added_by` uses `SET NULL`. The archived constraint claim is not current production evidence.

**Real deletion gate:** The candidate Edge Function is still undeployed and untested. Its source currently reads `APPLE_CLIENT_ID` and a prebuilt `APPLE_CLIENT_SECRET`; it does not consume the raw `APPLE_PRIVATE_KEY`, `APPLE_KEY_ID`, or `APPLE_TEAM_ID` values Jesse collected. Before secrets are entered or the function is deployed, choose and implement one contract: preferably generate Apple's short-lived ES256 client-secret JWT inside the function from those four raw values, rather than manually rotating a stored client-secret JWT. No secret value, function deployment, database mutation, PR-thread reply, or thread resolution occurred in this review.

**Other open review findings:** Six client behaviors need scoped follow-up: incoming friend requests are not reachable from Me; a Schedule court deep link can overwrite a later manual court selection; a failed lifetime check-in count is presented as zero; non-local Court Feed reads from local-court-only state; Court Schedule's create action does not open the form; and the displayed court rank is derived from the visible roster rather than an authoritative leaderboard. The ranking contract requires Jesse's product decision before implementation.

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

## 2026-07-29 — Reference-led density and header pass verified

**Visual direction:** Used Jesse's `IMG_4869.jpg`–`IMG_4874.jpg` set as the spacing and restraint anchor without copying its camo avatar texture or fake map tiles.

**Implemented:** Standardized primary-tab titles at 22 px Inter; moved the unboxed Explore sport filter before Search; reduced discovery-card height, padding, emblem size, button shadow, and action height; and changed normal court names to a lighter, one-line treatment. The featured local court may still wrap to two lines. Existing plain player tiles keep orange glow for ranked users and a star for friends.

**Evidence:** A fresh signed-in export rendered Home, Explore List/Map, the selected map sheet, Schedule, Compete, Me, and Court Details at `430 × 932`. Combined source/implementation comparisons are in `docs/product/design-qa/2026-07-29/`, with the required report at `design-qa.md`. Direct TypeScript and `git diff --check` passed.

**Boundary:** The proposed collapsing Home card and pinned Schedule heatmap remain an interaction decision. No merge, push, OTA, EAS build, TestFlight action, Apple Sign-In change, or Supabase mutation occurred.

## 2026-07-29 — Notification and sport-Elo MVP candidate prepared

**Product contract:** Basketball and pickleball now have separate candidate
ratings. Both start at 1200 and use standard K=32 Elo. Logged scores stay
pending until the named opponent confirms them, an objection changes no
rating, and a bounded database job confirms unanswered scores after seven
days. The old combined rating stays for older installed clients.

**Notification scope:** Added a durable in-app inbox for friend request,
friend accepted, run invite, score review, score confirmed, and score objected.
Run hosts can invite accepted friends. Push permission is only requested after
the user turns alerts on; the app does not prompt on launch. Added the Expo push
sender source and deduplication state, but did not deploy it.

**Reliability:** Court sport is authoritative, pending games do not appear in
confirmed history, rating changes are atomic, and the score form carries one
stable request ID across retries to prevent duplicate matches.

**Evidence:** Direct TypeScript passed, all five scoped-Realtime tests passed,
Expo public config resolved the notification plugin, `git diff --check` passed,
and a fresh web export bundled the new routes and packages. Read-only live
queries confirmed the two current pending matches use supported sports. No live
row, schema, function, secret, webhook, or Edge Function changed.

**Release boundary:** A production migration, Edge Function deployment,
Database Webhook, two-account database test, and two-phone push test remain.
Because `expo-notifications` and `expo-device` add native code, phone push needs
a new TestFlight build; it cannot be added to build 9 by OTA alone. Apple
Sign-In was not changed.

## 2026-08-01 — Build 9→13 incident: stale rerun, provisioning profile, OTA/native crash, resolved

**Starting complaint:** Jesse reported TestFlight showed older/worse behavior
than expected after "rerunning" a workflow, and asked for help understanding
why. Three separate, real problems were found and fixed; this entry is the
full record so a future agent doesn't have to re-derive any of it.

**Problem 1 — TestFlight looked rolled back.** Build 12 (installed) and build 9
(the known-good earlier checkpoint) were the *exact same source commit*,
`249c926`. Cause: EAS Workflow's "re-run" action replays a run's original
triggering git ref — it does not re-resolve to `main`'s current HEAD. A
manual re-run of the old build-9 workflow run (tied to tag `v1.0.4`) rebuilt
that same old commit under a new build number. `main` itself (PR #22,
`bcf9605`) had never successfully built. Fix: always cut a fresh tag on the
current commit instead of re-running old runs (now documented in
RELEASE_RUNBOOK.md §6).

**Problem 2 — builds against `main` failed to compile.** Builds 10 and 11
(targeting `bcf9605`) both errored with `XCODE_BUILD_ERROR`: the cached iOS
provisioning profile (generated 2026-07-08) didn't include the Push
Notifications / `aps-environment` entitlement that `expo-notifications`
(added in PR #22, confirmed absent from `app.json` at commit `249c926` via
`git show`) now requires. Jesse enabled the capability on the App ID in Apple
Developer Console; the profile itself still needed regenerating. Fix: `eas
credentials` → iOS → `production` → Build Credentials → declined to reuse the
original profile, generated a new one. Confirmed resolved when build 13
compiled clean past the "Run fastlane" step.

**Problem 3 — the installed app (build 9/12) crashed on launch.** Crash
signature: `SIGABRT` in `StartupProcedure.throwException` →
`ErrorRecovery.crash` → `ErrorRecovery.notify(newRemoteLoadStatus:)`, ~0.37s
after launch. Root cause, confirmed against Expo's own error-recovery and
runtime-versions docs (not just inferred): `publish-ota-update.yml` publishes
to the `production` channel on *every* push to `main`, unconditionally. When
PR #22 merged, its `expo-notifications` addition got OTA-published under the
unchanged `runtimeVersion` (`policy: appVersion`, still resolving to `1.0.0`),
so build 9/12's older native binary — compiled before that native module
existed — downloaded and tried to run JS that called a native API it didn't
have. `expo-updates`' own error-recovery exhausted its rollback options (fresh
install, nothing to roll back to) and crashed by design. This exact risk was
already flagged in the 2026-07-29 ledger entry above ("phone push... cannot
be added to build 9 by OTA alone") — it happened anyway because
`publish-ota-update.yml` has no gate against it. Fix: bumped `expo.version`
1.0.0 → 1.0.1 (PR #23, `d193ac8`), which also bumps the effective runtime
version, so the next native build stops being OTA-compatible with updates
meant for the old runtime. Does not retroactively fix already-installed
binaries.

**Delivery:** Tag `v1.0.5` on `d193ac8` → workflow `019fbb3e-b3b6-7830-ad63-cb4545af256c`
→ build 13 (app version 1.0.1) → both `build_ios` and `submit_ios` succeeded →
App Store Connect processed it → Jesse updated via TestFlight.

**Verified on-device by Jesse:** App launches without the crash, "works for
the most part," "feels snappy," core logic present. This is real, positive,
physical-device evidence — the app is functional again.

**Still open, found during this pass:** Push notification registration fails
on build 13 — "Alerts are not on: The phone could not be registered" — a
different failure from problems 2 and 3 above, not yet root-caused. Leading
theory: EAS credentials has a separate "Push Notifications: Manage your Apple
Push Notifications Key" entry (an APNs auth key, distinct from the
distribution cert/provisioning profile) that this session never touched. See
`docs/CURRENT_STATE.md` "What is not complete" for the exact next check.

**Process gap surfaced, not yet fixed:** `publish-ota-update.yml` has no check
for whether a push to `main` is JS-only vs. native-requiring. That gap is what
let problem 3 happen. Worth a guard before it recurs; left as an open decision
for Jesse rather than changed unilaterally.

**Mistake made and corrected mid-session, worth recording:** attempted to tag
the fix as `v1.0.1` without first checking the full existing tag list —
`v1.0.1`–`v1.0.4` already existed from this project's build 4–9 history. `git`
correctly rejected the push (tags aren't force-overwritten by default); no
damage occurred. Corrected by running `git ls-remote --tags` against the
remote directly before choosing `v1.0.5`. Lesson: check full tag/version
history before picking any release identifier, not just the locally-cached
subset.

## 2026-08-01 — Current-main onboarding and production UI assessment

**Outcome requested:** Onboard to the current Expo project and recent GitHub
activity, research respected general/mobile design skills, start the canonical
preview, walk the clean signup and first-session journey as both a new user and
designer, and produce an evidence-backed current-build assessment with a scoped
improvement plan. The standard is a familiar production public app first, then
an intuitive and delightful LocalCheck-specific experience.

**Source and recent activity:** Refreshed `origin/main` before review. Current
GitHub `main` was `81ff0a4`; no PR was open. PRs #19, #20, #22, #23, and #24
represent the recent backend/realtime, mobile consolidation, version, and build
documentation sequence. Tag `v1.0.5` at `d193ac8` remains the build-13/TestFlight
checkpoint even though documentation commits now advance `main`.

**Runtime walkthrough:** Started `./script/start_local_preview.sh`. Watchman is
not installed, so its documented static export-and-serve fallback ran
successfully. A clean QA account was created through visible Auth and one local
court was set. The review covered Auth, empty Home, Explore List, set local,
populated Home, Schedule, Compete, Me, Settings, and the court sheet at a phone
viewport. No check-in, schedule, run, friend, match, notification, or deletion
action was submitted. Jesse was exercising Realtime concurrently; those
updates were treated as intentional user activity. Jesse separately confirmed
logout works in TestFlight and Expo Go, so two inert web-preview attempts are
not a mobile defect or backlog item.

## 2026-08-03 — Apple manifest, push root cause, and user safety checkpoint

The supplied Apple privacy-manifest asset is now canonical in the Expo config,
and Settings displays the native application version/build rather than a
hardcoded string. Notification navigation now uses a tested route allowlist.

Read-only LocalCheckProd evidence narrowed push failure to two concrete gaps:
`push_tokens` has zero rows and `send-notification` is not deployed; seven inbox
notifications remain pending. The token RPC and preference RPC do exist. The
client now reports the actual token-save error, and the checked-in sender now
retries transient Expo errors and persists exact ticket failures. No Edge
Function, secret, webhook, schema, or production data changed in this pass.

Added an unapplied directional block/report migration and matching profile UI.
It uses a separate `user_blocks` relation because blocking is directional,
removes any friendship, and applies the boundary in RLS instead of relying on a
cosmetic client filter. Added an Apple-only owner checklist for final URLs,
App Privacy answers, reviewer account, credentials, and final-binary proof.

Static evidence: `pnpm --filter @workspace/mobile run typecheck`, focused
notification-route tests, and all five Realtime tests passed.

**Design verdict:** The graphite/orange athletic identity, court-first Home,
five-tab shell, honest empty states, List/Map discovery, and contextual court
sheet are strong foundations. The visual direction is ahead of the
implementation system: 126 direct Pressable compositions coexist with a shared
button used on only four detail surfaces; secondary headers, selection
controls, rows, state feedback, spacing, touch targets, and type are repeatedly
free-coded. The app/component folders contain 172 explicit 6–10 px type
declarations even though the published scale starts at 11 px. Production
requirements and delight are scored separately in the report; delight never
compensates for a failed table-stakes requirement.

**Verified product defects/risks:** Court cards render an interactive `SET
LOCAL` inside the card Pressable, producing invalid nested-button semantics on
web. Add a Court is prominently exposed although LocalCheckProd has no
authorized court-write path; its modal can manufacture a confirmed client ID
and close as if successful. Host Edit Run is exposed although no update RPC
exists. Settings uses disclosure-row grammar for an in-place push toggle and
hard-codes 1.0.0. Reduced motion is not respected by entry/pulse animation.
Fallback/not-found/error surfaces escape the LocalCheck token and voice system.

**Backend read-only truth:** LocalCheckProd is healthy. It now has notification,
push-token, and run-invitation storage plus related RPCs and
`profiles.push_notifications_enabled`. It still has only combined `elo_rating`;
sport-split columns are absent. Only `delete-account` was listed as a deployed
Edge Function; `send-notification` was absent. This partial production state is
newer than the prior current-state paragraph and does not match one canonical
reduced migration on GitHub `main`. No backend mutation was made in this pass.

**Evidence:** `pnpm --filter @workspace/mobile run check:release` passed
TypeScript and all five focused Realtime tests. Nine captures are stored under
`design-qa/2026-08-01-onboarding-assessment/`. The full report is
[`assessments/2026-08-01-current-build-assessment.md`](assessments/2026-08-01-current-build-assessment.md).
Mobbin could not be used because its connector required a paid plan. Skill
research recommended Impeccable + Expo native UI + Vercel React Native, with
Emil Design Engineering for interaction depth; no skill was installed.

**Boundary:** This was a read-only/code-inspection and user-journey assessment
apart from the explicitly requested QA signup/local-court selection and
documentation artifacts. No product code, merge, push, OTA, EAS build,
TestFlight submission, or production mutation was performed or authorized.

## 2026-08-02 — Court-sheet shell and route-to-screen contract

**Requested checkpoint:** Fix the visually discontinuous court-detail drawer
one system at a time, state the implementation source before changing it,
verify it in the phone-size in-app preview, and establish a robust design map so
screens stop inventing local UI rules. Number-flow check-in motion remains the
next isolated checkpoint rather than being mixed into this sheet change.

**Source decision:** The supplied Expo Router Drawer article describes global
side navigation wrapped around bottom tabs. LocalCheck's affected surface is a
contextual court bottom sheet, and the app already has five stable top-level
tabs, so no side drawer was added. Current Gorhom v5 documentation supports a
custom animated `backgroundComponent`, custom handle, fixed detents, and safe
area insets. Expo's newer native-backed drop-in sheet does not support several
behaviors this surface uses, and LocalCheck remains on SDK 54; replacing the
library would add regression and native-build risk. Tamagui's theme model was
used only as the reference for semantic token ownership, not added as a second
styling system.

**Implementation:** `CourtSheetHost.tsx` now owns one animated graphite
background, a continuous 28pt handle region, shared top radii/hairline, and the
device top inset. `CourtSheetContent.tsx` explicitly paints its content surface
from the same semantic background. Court data, realtime presence, check-in,
Set Local, routing, detents, and dismissal logic were not changed.

**Verification:** The initial rebuild exposed a web scroll-indicator regression;
it was corrected before acceptance. The final preview was exercised at a phone
viewport in compact and expanded detents, with upward drag and swipe-down
dismissal. Before/after evidence lives in
`design-qa/2026-08-02-court-sheet/`. TypeScript and `git diff --check` passed.

**System documentation:** Added `SCREEN_SYSTEM.md`, which maps all five primary
destinations, every current detail/task route, the hidden legacy Feed route,
shared headers/profile/sheet/form owners, scrolling rules, overlay rules, and
the screen acceptance checklist. This is now the implementation map beneath
`DESIGN.md` and `DESIGN_FOUNDATION.md`; it does not claim that every mapped
screen already passes the contract.
