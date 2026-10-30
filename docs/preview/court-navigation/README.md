# Court navigation — first reference implementation slice

Actual app screenshots with isolated authenticated fixtures, at 375×667,
393×852 and 430×932. The new Home dashboard and reference styling are pending.
These captures do not claim that the broader redesign is complete.

Feed / Schedule / Players / Info are shared by the court and drawer shortcuts.
Schedule has one scroller containing the heat map, selected slot and upcoming
games. `schedule-games` shows the same scroller farther down; the tabs remain
anchored. Existing Live links open Feed; Games and Week links open Schedule.

The browser journey exercised every tab, cell selection, scrolling to the game
list, drawer → Schedule and the three old link forms at every size, with no
application page errors. It found zero nested vertical scrollers inside Schedule.
All backend HTTP traffic was fulfilled by fixtures and WebSockets were blocked.
No native game balancing, notifications, timing or production data is demonstrated.

Before images are preserved in `../localplus-courts/`; the older screen states
are also in the preceding PR commit. Inspect the app alongside the selected
Claude artifact for the remaining visual work.

The 13-state × 3-size sweep found no clipped/overlapping layout. Its older
accessibility baselines still report small text and targets; merging the grid
into the old Games destination exposes more of those existing controls in that
capture. No baseline was raised. This partial draft is not a completed visual
or accessibility redesign.
