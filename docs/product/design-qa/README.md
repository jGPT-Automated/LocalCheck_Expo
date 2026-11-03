# Frontend visual history

Chronological index of retained, rendered before/after evidence for frontend
pull requests. Each entry keeps its screenshots and the journey or audit that
explains what they prove. Use the [PR visual evidence standard](../../GITHUB.md#frontend-pr-visual-evidence)
and the [PR template](../../../.github/pull_request_template.md) for new work.

Pairs should identify the baseline and PR-head commit, route, state, viewport,
and actual app render. Record fixture/backend isolation and any untested
behavior. Keep existing evidence in place; later screenshots extend the
history rather than replacing an earlier state.

## 2026-10-31 — PR #88, court title row and Schedule

[Evidence folder](2026-10-31-explore-title-row/). Retained composites are
labelled **BEFORE · live main** and **AFTER · PR #88**. Their captured states
include Explore list, collapsed drawer, expanded drawer, court page, Home,
Schedule windows and Schedule one-view.

| Route / state | 375 viewport pair | 393 viewport pair |
| --- | --- | --- |
| Explore list | [375-1](2026-10-31-explore-title-row/375-1-explore.png) | [393-1](2026-10-31-explore-title-row/393-1-explore.png) |
| Drawer, collapsed | [375-2](2026-10-31-explore-title-row/375-2-drawer.png) | [393-2](2026-10-31-explore-title-row/393-2-drawer.png) |
| Drawer, expanded | [375-3](2026-10-31-explore-title-row/375-3-drawer-expanded.png) | [393-3](2026-10-31-explore-title-row/393-3-drawer-expanded.png) |
| Court page | [375-4](2026-10-31-explore-title-row/375-4-court-page.png) | [393-4](2026-10-31-explore-title-row/393-4-court-page.png) |
| Home | [375-5](2026-10-31-explore-title-row/375-5-home.png) | [393-5](2026-10-31-explore-title-row/393-5-home.png) |
| Schedule windows | [375-6](2026-10-31-explore-title-row/375-6-schedule-windows.png) | — |
| Schedule one-view | [375-7](2026-10-31-explore-title-row/375-7-schedule-one-view.png) | — |

The saved folder does not record either capture's commit SHA, a reproducible
journey, or 430-wide captures. `a606de3` is the PR #88 merge commit, not a
recorded screenshot head. The baseline is identified in the image labels as
live main; its SHA is also unrecorded. The folder contains no backend-isolation
or device claim. These are historical captures; new entries use the complete
standard above.

## 2026-11-03 — PR #89, court activity feed and linked chart

[Main evidence and journey results](2026-11-03-court-activity/README.md).
The original after captures came from PR head `dcad46b`; `19dac69` is the
merged-main commit, not the screenshot head. The baseline was current main
`a606de3`. Actual rendered app screenshots pair the same route/state at
375×667, 393×852, and 430×932. The evidence
includes Court Feed, Home, drawer, and Schedule; the folder retains the full
before/after states, including scrubbed hour, Going, empty/private/error
states, and Schedule scroll. The documented journey uses isolated fixture
responses, blocks WebSockets, records results, and states its production and
native-device limits.

The follow-up logic correction has its own [paired captures and regression
evidence](2026-11-03-court-activity/review-fix/README.md): before capture at
`dcad46b`, corrected after capture at `375b08a`; `19dac69` remains the merged
main commit. It covers 375×667, 393×852, and 430×932. The entry records the
reproducible heatmap/hour and actor-navigation journey, fixture-only writes,
blocked backend traffic, and remaining native/RLS/realtime limits. Original
PR #89 captures remain intact.
