# TASKS.md — active MVP burn-down

> The fine-grained sprint list. Update status here as work lands (⬜ todo /
> 🔨 in progress / ✅ done + commit); log the narrative in `ACTIVITY_LOG.md`.
> Priorities: P0 = broken/blocking MVP feel · P1 = MVP core · P2 = MVP polish
> · P3 = backlog. Source: Jesse's 2026-07-16 direction + SOURCE_OF_TRUTH §4.

## P0 — broken today / feels broken

- ✅ **T1. Live presence everywhere** — realtime store + all 5 surfaces (d87293a)
- ✅ **T2. Court sheet = real drawer (v2 — native)** — the PanResponder version
  didn't actually track finger drags on device (tap-only). Replaced with the
  platform-native pattern from `.agents/skills/building-native-ui`
  form-sheet reference: `app/court-sheet.tsx` route presented as
  `formSheet` with `sheetAllowedDetents [0.45, 1.0]` + grabber — REAL UIKit
  sheet physics (drag, detent snap, swipe-dismiss), zero hand-rolled gesture
  code. Old CourtBottomSheet deleted; Explore/Map push the route.
  Convention for ALL sheets now: native (`formSheet` route or Modal
  `presentationStyle="pageSheet"`), never hand-rolled gestures.
- ✅ **T3. Log Game actions hidden behind bottom nav** — root cause: `padding`
  shorthand ordered after `paddingBottom` reset it to 20; fixed with
  tab-bar-aware bottom padding (web 84px / native inset+80).
- ✅ **T4. Map court cards stale** — both MapScreen variants now overlay
  `useCourtCounts` live counts onto markers, "courts live" bar, list items,
  and the selected-court sheet.

## P1 — MVP core

- ✅ **T5. Court view: active now + LOCALS list** — court sheet shows WHO'S
  HERE (avatar squares = active) and a LOCALS **list** (usernames + LAST
  CHECK-IN date per player, tap → profile). Data:
  `fetchLocalsWithLastCheckIn` (PostgREST per-parent embed, prod-verified).
  Visibility filtering still pending (part of T9). Court profile page
  (/court/[id]) still needs the same LOCALS list.
- ✅ **T6. Log Game from player profile** — LOG GAME button beside ADD FRIEND;
  deep link `/(tabs)/compete?tab=log&opponentId=<id>` preselects the opponent.
- ⬜ **T7. Game loop verified end-to-end** — two-account live test: log game →
  games/participants rows land, Elo/wins/losses update, Me history + feed show
  it. Fix whatever falls out.
- ✅ **T8. Feed: checkouts + games + color coding** — CHECKED OUT and game
  results now in the feed; chips + 3px left border color-coded per type
  (check-in accent · checkout muted · game win-green · runs neutral).
- ⬜ **T9. Privacy pass** — Compete leaderboard and planned-visit/schedule
  views respect profiles.visibility (public / friends / private). Court views
  show public users only (friends see friends).

## P2 — MVP polish / UX

- ⬜ **T10. Schedule tab pivot → weekly availability calendar** — primary
  surface = 7-day rolling week view of planned visits ("when I'm going"),
  with the user's own times + friends' times overlaid on one calendar so
  overlap is visible. Per-court version of the same view (public users only).
  Runs become secondary. Research standard weekly-calendar UI patterns first
  (predictable, familiar interactions — availability grid, not a booking app).
- ✅ **T11. Create-run / plan-visit modals rebuilt** — native pageSheet modals
  (swipe-to-dismiss); court field defaults to local court with ✕ + debounced
  typeahead; symmetric rolling-7-day grid; times/max-players in equal-width
  rows. Also fixed the page-level "NO RUNS SCHEDULED" bug: the day strip was
  the calendar week (incl. past days) while data fetches [today, +7d] — strip
  is now rolling next-7-days, and runs fetch from start-of-today.
- ⬜ **T12. Settings reorg** — preferred sport + local court to the top;
  hide LocalPlus UI for MVP; wire or remove dead toggles. Fix "manage
  account → home page" bug.

## P3 — backlog (explicitly deferred)

- ⬜ **T13. QR code on profiles** for quick add-friend / pick-opponent (Jesse:
  backlog until MVP is functional).
- ⬜ **T14. Me page: activity + pending items** — pending game results with
  confirm/dispute + 7-day auto-confirm. Deferred: likely too complicated for
  MVP; revisit after T7 proves the simple flow.
- ⬜ **T15. Onboarding flow rebuild** (from closed PR #7, on current main).
- ⬜ **T16. Compliance** — real delete-account, legal links → external
  TestFlight → App Store review.

## Parallel (other thread)

- 🔨 **Map redesign** — Sonnet thread. Coordination rule: if it adds
  @rnmapbox/maps (native), ship via version tag (full build), NOT OTA.
  Overlap warning: this repo touched `components/CourtsScreen.tsx` and
  `MapScreen` wiring in T1/T4.
