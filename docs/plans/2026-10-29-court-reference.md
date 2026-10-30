# Home, Explore and court reference — proposed scope

Reference selected by Jesse:
https://claude.ai/artifact/8spJMh7kUccqnifRnL9siM

Jesse limited this work to Home, Explore and the court page. The Explore court
drawer is included because it connects those screens. Settings, notifications,
auto check-in management, Schedule, Compete and Me are outside this change.

## Implementation approach

Adapt the existing Expo screens and canonical components to the selected
reference. Keep the installed fonts, icon libraries, bottom-sheet library and
existing application data contracts. A separate demo or a transplant of the
artifact's mock state would not update the app and is not the approach.

No Supabase access, schema changes, migration execution or backend deployment.
Preview verification uses isolated fixtures with all backend traffic intercepted.
No new dependencies, native configuration, build, OTA or merge.

## First implementation slice

- [x] Court page has Feed / Schedule / Players / Info. D67 subsequently
  removes the duplicate drawer tabs; the Court link remains.
- [x] Combine the existing heat map, slot detail and games in one scroller.
- [x] Inspect all four tabs, drawer navigation and old links at three sizes.
- [x] Capture the rendered slice for the draft PR; broader visual/accessibility
  work remains pending, with no baseline limits raised.

## Home

- Jesse's clarification: Home is an at-a-glance visual dashboard, not a copy
  of the full court page. It shows who's here now, the active game/open run,
  queue and upcoming games. His latest revision moves Feed exclusively to the
  court page. Do not retain a Home feed based on the earlier instruction.
- Compact HOME header and one coherent court identity area. Sport icon sits
  below the court name, inline with location/distance. Restore a subtle
  sport-specific background trace, with clear separation before the avatars.
- Avoid the crowded name-versus-large-counters split. The presence count
  belongs with Here now. Court switching must still update the whole view.
- Check-in and Join queue are compact controls near their sections, not
  full-width bars. Presence and game membership remain separate states.
- Monochrome avatar boxes with quiet borders/initials; no multicolored tier
  rims, active bars or glows. Any future tier distinction should be subtle.
- Current-game court art is simple. Show it only for a real active game;
  an empty court does not receive a fictional game, roster or countdown.
- Current players, a compact games/line summary, and upcoming games. Tapping
  the summary opens a nested view using the selected Playtomic card structure;
  active rosters, line positions and game actions belong there, not on Home.
- Joining and roster state must be clear: already joined, spots available or
  full. Use actual game membership, not court presence, to fill game slots.
- Pickleball: two players per team, four total. Basketball: five per team,
  ten total. This is settled; no further clarification is needed.
- Selecting a court updates the roster, games, metrics and action target together.
- Keep free accounts at one court and LocalPlus at its existing five-court limit.
- Preserve access to existing activity and planning functions; no invented
  attendance, players or game data from the prototype enters the product.

## Explore and drawer

- Compact header with List/Map control and anchored search.
- Your Courts and Near You sections, using the same compact court identity
  and Live/Locals metric pair as Home and the drawer.
- No tab pills in the drawer (D67). Card opens the existing drawer, with court identity, activity
  bars, horizontal roster, check-in and explicit court-page navigation.
- Preserve the existing map, discovery, sport filtering and add-court paths.
  Fit secondary controls into this layout rather than silently deleting them.
- Use the established bottom-sheet gestures and stable opening detents.

## Court page

- Jesse specified four tabs, in order: **Feed / Schedule / Players / Info**.
  Replace the prior proposed Today / Week / Players arrangement. The first
  tab is called Feed, not Live. Jesse's latest revision puts Feed here only.
- Schedule combines the heat map with upcoming games. The separate Games
  destination is incorporated there; Players and Info remain accessible.
- Compact back/save/check-in action row, then shared court identity and metrics.
- Tabs remain anchored while their content scrolls. Players sort controls remain
  anchored above the list. Activity bars and time-slot details use actual
  existing check-in/planning data.
- Reuse the current weekly planning grid and player rows. Keep current ranking,
  privacy and entitlement rules; prototype tier names do not redefine them.

## Game lifecycle described by Jesse — specification, not shipped behavior

- The rolling queue is an explicit opt-in beyond checking in. A full waiting
  lobby is ready; it must not be marked as playing while another game occupies
  the court. Never fill game slots from presence alone.
- Proposed completion path for review: Finish game opens the existing result
  form with roster/teams known; recording the end of play and advancing the
  queue are separate from resolving score/ELO review. Elapsed time is a display,
  not proof that a game has ended. The local game page currently has a creator-
  led final-score/review flow; no production behavior has been queried.
- Winner-stays versus full-group rotation, unattended finishes, and ending
  without a score are not settled. Do not silently bake those rules into the
  design or pretend the generated mockup implements them.
- Scheduled games can be created up to seven days ahead and must start more
  than two hours in the future.
- Hour slots can hold a scheduled game or an open run. Working interpretation:
  an unscheduled near-term hour is an open run; entering the two-hour window
  does not silently relabel an already scheduled game. Confirm before building
  that transition logic.
- Games start on the half hour. Fifteen minutes before that is the readiness/
  team-balancing point: for a 6:30 start, the check happens at 6:15.
- A sufficiently filled game balances teams. Insufficient players can trigger
  an invitation notice or dissolution back to ordinary open play.
- The exact shortage threshold, invitation grace period and dissolution
  deadline have not been specified. Do not invent them or mark them implemented.
- Purpose: let people opt into playing/competing together without needing to
  approach strangers and organize the game themselves.
- Existing local client code provides scheduled rosters/joining and planned
  visits. This inspection does not establish that the new lifecycle exists
  in production. No server has been queried to find out.
- This description does not authorize Supabase access or changes. Durable
  lifecycle/timer/notification work requires Jesse's separate unmistakable
  green light; frontend display must not pretend those actions occurred.

## Shared ownership and visual boundaries

- CourtSummary, CourtListItem, HomeCourtHero and CourtSheetContent own the shared
  court presentation. Improve those sources and check every affected view.
- ScreenHeader, CompactSelect, PlayerAvatar, CourtBusyChart, CourtSchedulePanel,
  CourtPlayersPanel and the existing court overview components supply the related
  controls and content. Add variants only where needed to avoid changing screens
  outside this scope.
- Match the selected reference's compact, left-aligned court identity and
  two-metric layout. This replaces the earlier large centered three-metric
  treatment on these views. Existing art assets are not deleted.
- Use native safe areas instead of drawing the reference's phone frame,
  status bar, clock or home indicator.
- Keep labels legible and controls at least 44pt even where the mockup uses
  smaller text or targets. Long names wrap within the available space.
- Preserve standard iOS edge Back; do not copy the mockup's custom whole-panel
  pointer handlers. Vertical scrolling must not navigate back.

## Review and delivery

Compare the reference and app in the same state and viewport. Inspect Home
before/after check-in and switching courts; Explore List/Map/search; card →
drawer → court; each court tab and sort; loading, empty, error and long names.
Check 375×667, 393×852 and 430×932, including short content that should not bounce.
Use screenshots and interaction evidence for the review, not CI status.
Send resulting app screenshots inline. Do not call this implementation complete
until the affected views have been inspected together.

Status: first court-navigation slice implemented and walked through at all
three sizes with isolated data; remaining Home/Explore/reference work is pending. Execution is
inline, as Jesse explicitly requested action without further questions.
