# Court activity feed and linked time chart

Requested by Jesse on Nov 3. Reference: jGPT-Automated/LCv5 main at
`41ebfde7c142f2534e2a8968b37fcb545c6802fc`,
`src/features/home/{HomeScreen,TodayTab,WeekTab}.tsx` and `src/theme/tokens.ts`.
Implement in this Expo SDK 54 app from current main a606de3, not PR #84.

## Color comparison

| Role | LCv5 | This app |
| --- | --- | --- |
| Canvas | #0D0D10 | #0D0D10 |
| Main text | #F2F2F6 | #F2F2F6 |
| Action orange | #FC4C02 | #FC4C02 |
| Soft orange ink | #FF7B4B | #FF7B4B |
| Panel | #18181D | #18181D (panel), #17171C (surface) |
| Sheet | #19191F | #121216 |
| Avatar/tile | #24242C | #24242C |
| Supporting text | #9A9AA7 | #9C9CA6 |
| Quiet text | #777783 and dimmer | #8A8A96 (readable muted) |
| Heat ramp | orange at 20/38/62/100% | identical |
| Sport ink | #D8C8B6 / #BDD7CF | identical |

Keep this app's shared palette and readable text. No global recolor or tier
rings. PlayerAvatar remains the shared rounded square. The reference's
structure/interaction, not its mock backend or SDK 58 dependencies, is reused.

## Implementation

- [x] Capture current Home, court Feed, court Week and expanded drawer with
  isolated fixtures. Block all backend HTTP and WebSockets before opening.
- [x] Extract chart-data loading into a shared hook; refresh on scoped realtime,
  foreground and confirmed plan changes. Add pure hourly slot models/tests.
- [x] Court Feed opens first. Pinned chart, one day label, day arrows on graph
  ends; horizontal bar drag scrubs hours. Vertical list scrolling updates the
  highlight. Current-hour roster uses square avatars; future hours use names
  and the existing Going action, past hours show actual activity. Never invent
  names for anonymous plans or count planned visits as current check-ins.
- [x] Reuse that chart and HourSlotCard on Home and expanded drawer. One day
  label; day changes clear an obsolete picked hour. Remove Home's event feed.
  Court destinations Feed / Schedule / Players / Info; Schedule combines the
  existing heatmap and games, and its selected cell opens the same hour row.
  Remove rejected drawer pills without inventing replacement navigation.
- [x] Exercise scrub, vertical scroll, day arrows/swipe, selected-slot heatmap
  handoff, Going/remove, privacy, failed save and reload against fixtures.
  Checked 375x667, 393x852 and 430x932. Native Dynamic Type was not exercised.
- [x] Update existing authority docs and package reviewable PR/screenshots.

No Supabase access, live account activity, SQL edits/deployment, queue backend,
new native dependencies, production release, Settings or subscription changes.
The mockup approval/question process was previously opted out of by Jesse;
this implements his selected LCv5 reference and explicit corrections.

## Evidence and limits

Court Feed uses one snapshot for bars and rows. Home/drawer compose the same
CourtDayPlanner and compact HourSlotCard, also with one snapshot. Selecting a
future hour reveals the whole row above Home's tab floor or the sheet edge.
Schedule's parent owns the common heatmap/slot/game gutter.

The isolated interactive journey exercised tap/drag scrub, vertical highlight
sync, anchored graph, day arrows and day-label swipe, anonymous attendance,
empty court, failed save/retry, confirmed add/reload/removal, heatmap-to-Feed
and data-load retry at all three sizes. No page errors. Feed chart y=253
before and after vertical scroll at all sizes. After the shared-planner
change, only Home/drawer were rechecked; the selected row cleared the 88pt
Home floor at every size. See committed design-qa evidence.

Scoped rendered audits: zero hard clipping/overlap/sideways-scroll failures
on current main and the branch. The committed accessibility baseline is
already exceeded by current main (14 entries); the combined Schedule and
changed content exposure produce 20 on the branch run. Existing sub-11pt
labels and small targets (including the seven-column heatmap) remain. The
baseline was not raised. This is not a clean accessibility sign-off.
Native iOS gesture arbitration/Dynamic Type and production realtime/RLS
were not exercised. No live Supabase or account was accessed.

## Approved PR #89 review correction

Jesse approved a logic-only patch before the checkpoint merge. Keep the
current avatars, cards, controls and palette; the Home/LocalPlus redesign is
separate. Implement all three corrections in one follow-up commit:

- [x] Heatmap navigation passes the actual tapped block's start hour. Keep
  completed blocks disabled; do not shift the current two-hour block forward.
- [x] Use one 28pt focus offset for programmatic jumps and scroll tracking,
  so the top historical hour cannot turn into the next hour at scrollTop=0.
  Reset the measured list on day changes; the rapid-scrub reproduction exposed
  RN-web retaining position-only layout changes from the previous day. Queued
  layout/data/day callbacks flush the latest pending hour, so an older focus
  cannot replace a newer tap during the reset.
- [x] Pass actual previous events and guard missing actor IDs in both Now
  and past event loops. Add ActivityRow.showDayHeader (default true), false
  only in this hourly feed, to preserve its single date heading.
- [x] Extend isolated browser regressions for current/future heatmap picks,
  top-hour/rapid scrub/manual scroll on past/today/future days, actorless and
  valid-actor taps, and the unchanged Me/player date headings. Check all
  three phone sizes and retain before/after images. No live backend access.
- [x] Update docs/evidence and PR #89; leave the merge and release to Jesse.
