# LocalCheck current state

Last verified: 2026-07-29, America/Chicago

This is the short current truth. Use the activity ledger for history and the
release runbook for deployment steps.

## Solid checkpoint

| Item | Verified state |
| --- | --- |
| GitHub repository | `jGPT-Automated/LocalCheck_Expo` |
| Canonical local folder | `/Users/JesseH/Projects/LocalCheck_Expo` |
| Delivery branch | GitHub `main` |
| Delivered source | GitHub `main` contains feature commit `32bc0d6` and its delivery record. Verify the current remote tip when an exact hash matters. |
| Canonical review PR | Open [#22 — consolidate LocalCheck MVP candidate](https://github.com/jGPT-Automated/LocalCheck_Expo/pull/22), branch `codex/mvp-consolidation`, based directly on GitHub `main` `7772b61`. GitHub currently marks it ready for review, but open product and physical-device gates still block merge. Use the current PR head when an exact candidate hash matters. |
| Local working state | PR #22 is the only canonical review branch. Its seven review findings now have locally verified fixes awaiting push: friend-request access, stable Schedule court selection, retained check-in history on fetch failure, court-scoped feed data, Create Run routing, authoritative ranked badges, and reproducible account-deletion constraints/secrets. Nothing in this PR is merged or active in Supabase. PR #21 remains superseded because its useful implementation is absorbed by #22. The user-owned `.claude/launch.json` remains untouched and locally excluded. |
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

## What is not complete

- The notification and sport-Elo candidate is not active in LocalCheckProd. The migration and Edge Function source have not been deployed, the Database Webhook has not been created, and no notification row or rating was changed during this implementation pass.
- Phone push requires a new native iOS build because the candidate adds `expo-notifications` and `expo-device`. Build 9 cannot receive this feature through OTA alone. The durable in-app inbox remains the source of truth if a phone push fails.
- The current Elo candidate is intentionally basic: separate basketball and pickleball ratings, 1200 start, standard K=32, opponent confirmation, objection with no rating change, and seven-day automatic confirmation. Advanced rating mechanics and the final objected-score retention rule remain later work.
- TestFlight build 9 still opens public `postgres_changes` channels, so LocalCheckProd continues to log `PrivateOnly` retries from that installed client. Jesse approved saving the repaired source candidate to `main`, but no OTA/TestFlight delivery was authorized, so the installed phone client remains unchanged.
- The rebuilt local browser joined private Jaycee Park, Houston, and signed-in-user topics with `SUBSCRIBED` status and no local `PrivateOnly` error. Jesse then confirmed a TestFlight-originated court change appeared live in the already-open browser without a tab switch. This proves the new receiving path; reverse-direction and full two-phone acceptance remain open until the repaired client is delivered to the phone.
- Physical native-map acceptance remains open. The web preview passed Houston market scope, map-layer positioning, low-zoom clustering, and styling. Cluster expansion now follows Mapbox GL JS's documented callback contract, but its final automated click replay was blocked by the preview controller's localhost safety policy. TestFlight build 9 does not contain this candidate.
- App-wide profile privacy is not complete. The current `profiles` contract has no persisted visibility field, leaderboard queries cannot filter it, and the Settings value is session-scoped check-in visibility. The local Compete presentation prevents the signed-in hidden user from appearing twice, but durable cross-client privacy requires an approved schema/service/RLS change and full surface audit.
- Four client write paths target tables they cannot write. LocalCheckProd is a v2 schema that revoked default ACLs and routes behaviour through `SECURITY DEFINER` RPCs, with narrow **column-level** grants on a few tables. `information_schema.role_table_grants` hides column-level grants, which is why this went unnoticed. Full map and verification recipes: [`BACKEND_WRITE_PATHS.md`](BACKEND_WRITE_PATHS.md).
  - **Schedule "My Times"** — fixed client-side. `authenticated` may INSERT `user_id` but not UPDATE it, and `.upsert()` compiles to `ON CONFLICT DO UPDATE SET user_id = …`, rejected with `42501`. Now uses `ignoreDuplicates: true` (`DO NOTHING`), verified against production in a rolled-back transaction. **No migration required** — an earlier `GRANT` migration was written on a wrong diagnosis and has been deleted.
  - **Add Friend** — fixed client-side. `friendships` is SELECT-only; the old code inserted directly and discarded the error. Now uses `request_friend` / `accept_friend_request` / `remove_friendship`. `request_friend` creates **`pending`**, the profile button shows `REQUESTED`, and Me → Friends exposes incoming accept/decline actions plus the full Friends screen.
  - **Add a Court** — still broken. `courts` is SELECT-only and no `create_court` RPC exists. Needs a product decision plus a migration.
  - **Edit a Run** — still broken. `runs` is SELECT-only and no update RPC exists.
- The local candidate no longer reports an empty or court-less Schedule save as success. It disables an unchanged Save, retains failed selections, and supports a Court Details deep-link with the court preselected. Signed-in write proof on a physical client is still required before delivery.
- Add Friend does nothing in build 9. The local candidate uses the existing friend-request RPCs and includes incoming accept/decline surfaces, but physical two-account proof is still required.
- The local Profile candidate obtains a real lifetime `check_ins` row count rather than labeling court-time minutes as check-ins.
- Normal hot-reload Expo web still needs Watchman on this machine; without it, Node file watching reaches `EMFILE`. The repeatable export-and-serve fallback is working, but source edits require restarting the script. The launcher now calls the checked-in app's installed Expo binary directly, so a different global or pnpm version cannot prompt an agent to replace the canonical dependency tree.
- The repeatable preview server now sends no-cache headers for every export asset and serves the Expo app shell for direct client routes such as `/schedule` and `/court/:id`. This prevents the stable development bundle filename from reopening a stale build after restart. It remains an export preview, so code edits still require rerunning the script.
- The imported web app has not yet passed install/build/preview inside this pnpm workspace; source synchronization is complete, integration is not.
- The shared-system browser pass is complete. Physical iPhone acceptance remains open for safe areas, keyboard/sheet behavior, native Mapbox, dense Schedule states, and same-viewport comparison against the supplied mocks.
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

## Next sequence

1. Jesse reviews Home, Explore List/Map, Profile, Compete, Court Details, and Schedule from open PR #22 in the refreshed preview; fix visible mismatch before release.
2. Prove Schedule add/remove persistence with a signed-in account. Preserve Apple Sign-In unchanged.
3. Review the prepared notification and sport-Elo contract, then obtain Jesse's explicit approval before applying its migration or deploying its push sender.
4. Prove the in-app inbox and score confirm/object flow with two accounts. Then make one native iOS build and prove phone pushes on physical devices.
5. Obtain Jesse's explicit approval before merging PR #22 or triggering OTA/EAS/TestFlight. Physical Mapbox and two-way Realtime acceptance remain separate native QA gates.
6. Complete recovery snapshot/runbook, privacy/compliance, App Store QA, screenshots/metadata, external TestFlight, and submission.

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
- Required contributor architecture: [`APP_ARCHITECTURE.md`](APP_ARCHITECTURE.md)
- Workspace/archive classification: [`WORKSPACE_MAP.md`](WORKSPACE_MAP.md)
