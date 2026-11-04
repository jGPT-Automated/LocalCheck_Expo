# Matched Schedule renders

Before source `19dac69`; after source `ef8f566`. CSS viewports shown.
Legacy case names identify captures; `schedule-mine` is an empty future slot in these fixtures.

| State | Hard before/after | Small text before/after | Low contrast before/after | Small targets before/after |
| --- | --- | --- | --- | --- |
| 375x667/schedule | 0/0 | 15/15 | 0/0 | 89/88 |
| 375x667/schedule-mine | 0/0 | 15/15 | 0/0 | 89/88 |
| 375x667/schedule-slot | 0/0 | 15/15 | 0/0 | 87/87 |
| 393x852/schedule | 0/0 | 15/15 | 0/0 | 89/88 |
| 393x852/schedule-mine | 0/0 | 15/15 | 0/0 | 89/88 |
| 393x852/schedule-slot | 0/0 | 15/15 | 0/0 | 87/87 |
| 430x932/schedule | 0/0 | 15/15 | 0/0 | 89/88 |
| 430x932/schedule-mine | 0/0 | 15/15 | 0/0 | 89/88 |
| 430x932/schedule-slot | 0/0 | 15/15 | 0/0 | 3/3 |

The baseline runner also attempted an unrelated obsolete action selector; its reachability errors are outside this matched three-state set. Existing heatmap touch-target debt remains; no baseline was changed.
