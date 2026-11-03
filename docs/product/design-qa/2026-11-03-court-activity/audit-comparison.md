# Rendered audit comparison

Current main a606de3 vs activity branch, same fixture clock and phone sizes. No baseline was raised.

Both runs have zero hard clipping, overlap or sideways-page-scroll failures.

The committed baseline predates current main: main itself records 14 over-baseline entries. The branch records 20. These are the inherited small typography/targets exposed in changed layouts, including the existing heatmap now reached by the Games alias. This is not a clean accessibility sign-off.

| Screen | Metric | Current main | Activity branch |
| --- | --- | ---: | ---: |
| 375x667/home-scrolled | smallText | 14 | 18 |
| 375x667/home-scrolled | smallTarget | 0 | 1 |
| 375x667/court-live | smallText | 18 | 6 |
| 375x667/court-live | smallTarget | 4 | 1 |
| 375x667/court-games | smallText | 25 | 6 |
| 375x667/court-games | smallTarget | 3 | 57 |
| 375x667/court-week | smallText | 7 | 6 |
| 375x667/court-week-today-card | smallText | 11 | 28 |
| 375x667/court-week-today-card | smallTarget | 49 | 9 |
| 375x667/explore-drawer-expanded | smallText | 17 | 13 |
| 375x667/explore-drawer-expanded | smallTarget | 6 | 2 |
| 393x852/home-feed | smallText | 0 | 18 |
| 393x852/home-feed | smallTarget | 0 | 1 |
| 393x852/home-scrolled | smallText | 17 | 18 |
| 393x852/home-scrolled | smallTarget | 0 | 1 |
| 393x852/court-live | smallText | 21 | 8 |
| 393x852/court-live | smallTarget | 4 | 1 |
| 393x852/court-games | smallText | 25 | 15 |
| 393x852/court-games | smallTarget | 3 | 63 |
| 393x852/court-week | smallText | 12 | 15 |
| 393x852/court-week-today-card | smallText | 12 | 29 |
| 393x852/court-week-today-card | smallTarget | 63 | 23 |
| 393x852/court-info | smallText | 16 | 15 |
| 393x852/explore-drawer-expanded | smallText | 18 | 13 |
| 393x852/explore-drawer-expanded | smallTarget | 7 | 2 |
| 430x932/home-feed | smallTarget | 6 | 1 |
| 430x932/home-scrolled | smallTarget | 0 | 1 |
| 430x932/court-live | smallText | 22 | 8 |
| 430x932/court-live | smallTarget | 4 | 1 |
| 430x932/court-games | smallText | 25 | 21 |
| 430x932/court-games | smallTarget | 3 | 64 |
| 430x932/court-week | smallText | 12 | 21 |
| 430x932/court-week | smallTarget | 63 | 64 |
| 430x932/court-week-today-card | smallText | 12 | 29 |
| 430x932/court-week-today-card | smallTarget | 63 | 37 |
| 430x932/court-info | smallText | 16 | 15 |
| 430x932/explore-drawer-expanded | smallText | 20 | 13 |
| 430x932/explore-drawer-expanded | smallTarget | 7 | 2 |
