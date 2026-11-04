# Dashboard design follow-up implementation plan

> **For agentic workers:** Use the existing Expo/React Native components and
> the execution-plan workflow; verify each task in the rendered app.

**Goal:** Deliver the visual follow-up deferred from merged PR #89, and make
paired frontend screenshots the permanent PR/history standard.

**Architecture:** Keep CourtDayPlanner shared by Home and the Explore drawer.
Improve SlotCard rather than creating a competing hour-card component. Reuse
ScheduledGameCard for actual games and existing planned-visit/RSVP services.

**Tech stack:** Expo SDK54, React Native, existing Feather icons, shared
PlayerAvatar, CourtBusyChart, theme tokens and Gorhom drawer.

**Spec:** Jesse's attached charcoal dashboard/chart and timeline screenshots,
the PR89 review's two visual mismatches, and the latest request to own delivery.
The mockup/question process was previously opted out of. This implements those
references, retaining D65's court header/art. No new visual direction.

## Boundaries and remaining work

| Requested outcome | This checkpoint |
| --- | --- |
| Home/drawer: Here now → boxed daily chart/selected hour → next game | Implement using shared sections |
| Selected hour: square avatars, compact + / check instead of Going | Implement via SlotCard; keep accessible add/remove labels |
| Court future rows: overlapping square stack, readable count/names, game JOIN | Implement via the same SlotCard and ScheduledGameCard |
| Shared charcoal/orange system, graph-end arrows, one day label | Retain tokens/arrows; add planner panel only |
| Side-by-side visual history for every frontend PR | PR template, contributor rules and retained index |
| LocalPlus five-court list, default/reorder, Home/Schedule dropdown, nested Settings toggles | Draft backend/frontend contract for review; not represented as shipped |
| Home header live-count navigation / saved-court selector | Live-count link implemented in this refinement; selector still awaits the reviewed saved-court contract |
| Actual scheduled game 10/4-slot visual | Next frontend slice using existing capacity and participants |
| Drawer one-root-scroller / fixed inner-window removal | Separate frontend slice; this checkpoint removes unsolicited resnap-close only |
| Hourly open-run lobby/queue and end-of-game progression | Separate backend review; do not turn planned visits into game membership |

## Review focus

- Planned intent, durable game RSVP and current presence remain different states.
- Private attendance stays anonymous; visible visitor/game identities deduplicate.
- Changing day/hour while a save is pending must not display the old error on a new slot.
- At 375px the selected card and next game remain reachable above the tab floor.
- Moving the planner above next game must reveal the selected card, not scroll past it.

## Tasks

- [x] Confirm merged main `19dac69`; inspect existing owners and read live
  schema/RPC/policy definitions without reading player rows or invoking writes.
- [x] Add paired PR screenshot template and visual history; independently
  review the helper's documentation and correct historical capture provenance.
- [x] Capture baseline Home/drawer/selected hour/court future rows at
  375×667, 393×852 and 430×932 with all app backend traffic intercepted.
- [x] Wrap shared CourtDayPlanner chart/selected slot in one charcoal panel;
  render non-compact selected slot. The initial hairline/duplicate heading is superseded by the refinement below. Move next-game
  section after the planner on Home and drawer, and reveal the selected slot
  using its measured position instead of scrolling to the page end.
- [x] Update SlotCard's existing attendance action to a 34pt Feather plus/check surface within a 44pt
  control with busy/selected semantics and accessible add/remove names. Keep
  error and retry behavior. Compact rows show up to three overlapping square
  avatars with count/names; hidden people contribute only an anonymous count.
- [x] Render scheduled timeline games through ScheduledGameCard's compact
  presentation. Reuse its joined/full/choose-team behavior and existing
  joinRun; never convert a planned-visit toggle into an RSVP. Preserve every
  selected-hour game link in the full dashboard card as well as the timeline.
- [x] Verify the drawer stays open without input: the before-fix trace
  proved a queued snap-to-collapsed command caused index 0 → -1 → dismiss
  without a backdrop press. Remove redundant commands, preserve measured
  points, explicit expand and pan-down close.
- [x] Verify selected-hour profile/game links dismiss the drawer before routing,
  and immediate day-change/scrub reads the displayed day. Both wrong behaviors
  were reproduced before their shared callback fixes.
- [x] Exercise add/remove, failed save/retry, day/hour changes, private/empty
  states, game join/full/joined/choose-teams and all shared usages. Compare
  baseline/head screenshots and inspect the captured renders at all sizes.
- [x] Update authority docs, record remaining backend-dependent work and the
  read-only inspection, open the visual PR and retain paired evidence/index.

No dependency/native configuration change, Supabase write, applied migration,
function deployment, production release or merge. Live inspection is authorized
read-only; every proposed backend modification remains a review draft.

Visual checkpoint: [PR #90](https://github.com/jGPT-Automated/LocalCheck_Expo/pull/90), open and unmerged. Remaining rows above are subsequent slices, not completed features.


## PR #90 refinement — one selected-hour section

**Approved direction, on this branch:** Jesse's latest annotation treats the
selected hour as one entity. The planner header owns day, selected hour and
attendance count once; the graph and square attendees follow without another
hour heading or internal divider. The visible plus/check tile matches the
34pt avatar while its actual target stays 44pt. Home's court-page link moves
beside the live count; the large arrow beside Check in is removed. Existing
court art, shared palette, Feed/Schedule defaults and all durable actions stay
with their current owners.

**QA list:** basketball and Candy Cane pickleball Home, expanded Explore drawer,
and Court selected future hour; Home header court link; planned-visit empty,
error/retry/confirmed/removal; graph day-change/scrub; shared Schedule selected
card. Capture at 375×667, 393×852 and 430×932, intercept backend HTTP and block
sockets before navigation. Compare against `96f0c7f` using the same fixtures.

**Separate review draft:** each hour will contain a casual open lobby as well
as planned attendance. Checking in means present; joining a spot means intent
to play. This is not the existing planned-visit plus action. No lobby storage,
auto-start, ranked vote, or game-end behavior is represented as implemented by
this visual refinement. See the backend review draft for the proposed contract
and unanswered policy details, including the unfinished three-player example.


## November 4 correction — follow the supplied design, not a partial polish

The previous hierarchy checkpoint did not meet Jesse's full visual request.
The requested next pass uses his supplied pickleball court green `#3FC397`,
14% wash, mint metadata `#9CCFBE`/label `#BDD7CF`, neutral tiles and orange
only for intentional action/live meaning. It removes data-only metric strips
from Home and the drawer, keeps their art, makes the live chevron sit close
to the number, and adds the real saved-court dropdown using CompactSelect.
The current contract holds one court; do not fabricate five memberships.

One selected-hour unit keeps day/time together, count beside its people,
tight chart-to-people spacing, attendance plus on that row even in game hours,
and a second consistent-height game/Create action row. Empty and populated
collapsed slots reserve the same space. Real scheduled games expand vertically
into square member/open positions (10 basketball, 4 pickleball), using existing
RSVP and team-choice rules; a vacant spot must be actionable, not decoration.
Home/drawer Up next reuse that same expandable card rather than another
horizontal avatar/progress presentation. All relevant shared callers must be
checked at three sizes, including empty/filled Schedule and expanded rosters.

The recurring hourly casual lobby and five-court storage remain separately
reviewed server changes. This visual pass must neither claim they exist nor
repurpose planned visits as game membership.
