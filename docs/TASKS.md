# TASKS.md — active MVP burn-down

> The fine-grained sprint list. Update status here as work lands (⬜ todo /
> 🔨 in progress / ✅ done + commit); log the narrative in `ACTIVITY_LOG.md`.
> Priorities: P0 = broken/blocking MVP feel · P1 = MVP core · P2 = MVP polish
> · P3 = backlog. Source: Jesse's 2026-07-16 direction + SOURCE_OF_TRUTH §4.

## P0 — broken today / feels broken

- ✅ **T1. Live presence everywhere** — realtime store + all 5 surfaces (d87293a)
- ✅ **T2. Court sheet = real drawer** — CourtBottomSheet rebuilt: PanResponder
  drag with snap points peek (~40%: name, distance, live counts, CHECK IN,
  swipe-up affordance) / full / dismissed; interruptible springs + velocity
  handoff; check-in from peek expands to full; renders in a Modal so actions
  can never sit behind the tab bar; live distance via `court.distanceKm`.
  (needs on-device gesture verification)
- ✅ **T3. Log Game actions hidden behind bottom nav** — root cause: `padding`
  shorthand ordered after `paddingBottom` reset it to 20; fixed with
  tab-bar-aware bottom padding (web 84px / native inset+80).
- ✅ **T4. Map court cards stale** — both MapScreen variants now overlay
  `useCourtCounts` live counts onto markers, "courts live" bar, list items,
  and the selected-court sheet.

## P1 — MVP core

- ⬜ **T5. Court view redesign: active now + all locals** — court sheet & court
  profile show WHO'S HERE (active roster) and a LOCALS list (all players whose
  local court this is — presence store already fetches both). Respect profile
  visibility (public only for non-friends).
- ✅ **T6. Log Game from player profile** — LOG GAME button beside ADD FRIEND;
  deep link `/(tabs)/compete?tab=log&opponentId=<id>` preselects the opponent.
- ⬜ **T7. Game loop verified end-to-end** — two-account live test: log game →
  games/participants rows land, Elo/wins/losses update, Me history + feed show
  it. Fix whatever falls out.
- ⬜ **T8. Court activity feed: checkouts + logged games** — feed currently
  shows check-ins only; add checkout events and game results (log_game already
  writes game_result feed_posts rows server-side — read path needed; checkouts
  derive from check_ins.checked_out_at).
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
- ⬜ **T11. Create-run / plan-visit court picker UX** — kill the horizontal
  all-courts scroll. Default = user's local court; dropdown with typeahead
  showing the 5 closest courts matching the user's preferred sport.
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
