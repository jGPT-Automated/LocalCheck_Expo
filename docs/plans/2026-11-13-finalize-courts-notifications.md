# Finalize court behavior and notifications

## Authority and scope

Jesse's November 13 request: complete #90/#91 together, preserve the existing
design and fixed headers, make Now/Going usable, complete compact notification
history, and connect the court-page plus to a LocalPlus list shared by court
selectors. Reference: jGPT-Automated/LCv5 at `41ebfde` (read as reference only).
Implementation: `codex/finalize-courts-notifications`, main baseline `19dac69`,
with #90 `69757d5` and #91 `3e12738` integrated locally. Only Jesse merges.

## Diagnosed causes and implementation

- Home relied on stickyHeaderIndices inside a ScrollView. Its court hero is
  now a sibling above that scroller. Screen headers cannot shrink; Notifications
  uses ScreenViewport with its FlatList bounded beneath DetailHeader.
- The feed only generated hours 6–22, so Now did not exist at 2 AM. The range
  now includes the actual current hour. An explicit Now button returns there.
- Initial row layout ran before final content height. scrollTo clamped, but
  the old code cleared its target anyway. It now retains the requested hour
  until the actual position confirms it and retries after content-size changes.
  The selected hour starts directly below the chart; no preceding half-row.
- Planned attendance disappeared from the current-hour row, and the event
  mapper explicitly discarded planned_visit_created. Current-hour intent and
  its event now render. Plan reads page instead of truncating at 200; the court
  timeline reads its seven-day event window instead of truncating at 50.
  Request failure produces retry rather than a successful-looking empty feed.
- No saved-court backend exists. The new owner-only saved_courts relation and
  RPCs enforce a five-court total, including the existing local. That local
  remains first and remains the sole geofence/ranking anchor. Profile locking
  serializes membership/cap changes; a guard protects legacy local writes.
  Extra saves survive downgrade but are ineffective while free. No client
  storage, default replacement, reorder, multi-region or lobby implementation.
- The live manual check-in path does not notify friends. Prepared SQL records
  own manual events and books one delayed manual friend notice. Existing
  sharing/friendship/preferences/blocking/test-data limits apply. Automatic
  arrival stays at five minutes. New own notices retain visibility/source
  snapshots; old rows are not guessed/backfilled. Existing notice types and
  native push registration remain compatible with build 46. No Edge Function
  deployment is needed for the new timer kind: dispatch is database-owned.

## Reused owners

ScreenViewport, ScreenHeader/DetailHeader, HomeCourtHero/CourtTitleRow,
CourtBusyChart, HourSlotCard/SlotCard, ActivityRow, FormSheet/RunFlowSheet,
CourtSearchPicker, React Query and the scoped Realtime hub remain the owners.
SavedCourtList supplies the shared selection rows. Schedule, Log Game and
challenge/scheduled-game fields include the same server-owned list.

## Verification

- `pnpm check`: TypeScript, pure/source tests, design and documentation checks.
- `PGLITE_MODULE_PATH=/tmp/localcheck-db-test/node_modules/@electric-sql/pglite/dist/index.js node supabase/tests/database/finalize-courts.mjs`:
  Install the test engine separately with `npm install --prefix /tmp/localcheck-db-test --ignore-scripts --no-audit --no-fund @electric-sql/pglite@0.5.16`.
  This is disposable PostgreSQL only, never a production connection. Apply both exact
  migrations over representative prerequisite tables and the November 13
  read-only live run_timer/end_check_in snapshot. Exercise cap/idempotency,
  paid/free ownership/RLS, default preservation/downgrade, delayed notices,
  preferences/blocking/privacy, immutable audience, timer retry and checkout.
- `node scripts/visual-qa/finalize-courts-journey.mjs <preview> <output>`:
  actual Expo browser render at 375×667, 393×852, 430×932. Measure header/chart
  position during scroll; open Now; save Going/reload; save court/reload;
  choose it on Home without changing default; remove it. The late-night run
  sets `JOURNEY_NOW=2026-11-13T08:30:00Z` (2:30 AM Central).
- `CHROMIUM_PATH=/usr/bin/chromium node scripts/visual-qa/notification-log-journey.mjs <preview> <output>`:
  43 entries, equal-timestamp boundary, 20-row pages, page error/retry,
  Read all, recorded audiences and compact row alignment at all three sizes.
- Scoped visual audit compares the integrated #90/#91 checkpoint with the
  corrected source. Zero hard layout failures; inherited small-label/target
  debt is recorded rather than raising the repository's baseline.

All browser backend HTTP is intercepted and WebSockets blocked before
navigation. Saves mutate fixture memory only. These runs do not prove live
RLS, multi-device convergence, iOS/Safari rendering, background events, QStash
booking or APNs receipt. No phone-build acceptance is claimed.

## Deployment boundary and next action

Production remains unchanged. Prepare/review these files in order:

1. `supabase/migrations/20261113100000_saved_courts.sql`
2. `supabase/migrations/20261113110000_complete_check_in_notifications.sql`

Use the owner-controlled SQL-editor process in SUPABASE.md: byte-check the
file, Jesse runs it, verify schema and a rolled-back allowed/denied-user test,
then record its version/name in the migration ledger. Both migrations are
transactional with lock/statement timeouts. Do not publish this candidate before
the backend contracts are present. The preview before deployment uses fixtures
or displays the real backend's unavailable-contract error, never fake success.

After authorized deployment, exercise real free/Plus saves and two-account
manual/automatic friend notices, with actual phone receipt and privacy denial.
After review/merge, confirm installed runtime 1.0.4 and production channel
mapping, then deliberately publish the iOS OTA. EAS build 46 is FINISHED from
Oct 31; Apple processing/current installation were not checked. No new native
build is required by this source change.

Recovery: revert the client commit/republish the known-good compatible update.
The saved relation is additive; retain it and its data. If notification delivery
needs disabling, restore run_timer/end_check_in from the checked pre-deploy
definitions and remove the new record/snapshot triggers after marking only
unfired manual_check_in_notice timers cancelled. Preserve notification history.
Database recovery is an explicitly authorized production operation.
