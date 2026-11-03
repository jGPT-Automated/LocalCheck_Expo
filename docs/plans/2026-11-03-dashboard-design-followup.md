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
| Home header live-count navigation / saved-court selector | Header/list follow-up; selector uses the reviewed saved-court contract |
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
  render non-compact selected slot, separated by a hairline. Move next-game
  section after the planner on Home and drawer, and reveal the selected slot
  using its measured position instead of scrolling to the page end.
- [x] Update SlotCard's existing attendance action to a 44pt Feather plus/check
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
