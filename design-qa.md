# LocalCheck visual QA — 2026-07-29

## Comparison target

- Source visual truth:
  - `/Users/JesseH/Downloads/IMG_4869.jpg` — Home (`957 × 1948`)
  - `/Users/JesseH/Downloads/IMG_4870.jpg` — Explore List (`950 × 1980`)
  - `/Users/JesseH/Downloads/IMG_4871.jpg` — Explore Map (`935 × 1932`)
  - `/Users/JesseH/Downloads/IMG_4873.jpg` — Me (`954 × 1951`)
  - `/Users/JesseH/Downloads/IMG_4874.jpg` — Schedule (`888 × 1806`)
- Rendered implementation: signed-in Expo web export at `http://127.0.0.1:8081/`.
- Implementation captures: `docs/product/design-qa/2026-07-29/after-*-pass2.png` (`430 × 932`).
- CSS viewport: `430 × 932`; density: `1`.
- Normalization: each framed source image was scaled to fit and padded to `430 × 932`. The implementation remained at its native capture size. Each pair was joined into an `860 × 932` comparison.
- State: signed-in user with Jaycee Park Pickleball Courts as the local court; real preview data was retained.

## Full-view comparison evidence

- `docs/product/design-qa/2026-07-29/compare-home-pass2.png`
- `docs/product/design-qa/2026-07-29/compare-explore-pass2.png`
- `docs/product/design-qa/2026-07-29/compare-schedule-pass2.png`
- `docs/product/design-qa/2026-07-29/compare-me-pass2.png`

## Focused comparison evidence

- `docs/product/design-qa/2026-07-29/compare-map-selected-pass2.png` compares the selected map-court sheet. The implementation intentionally replaces the mock's player tiles with active, local, and visit metrics, as requested.
- `docs/product/design-qa/2026-07-29/after-court-pass2.png` verifies the shared court card and readable Feed tab at the same viewport.
- Separate detail crops were not needed because the `430 × 932` captures keep the affected header, filter, title, metric, and action text readable.

## Findings

- No actionable P0, P1, or P2 visual defect remains in this scoped pass.
- Header typography: the shared primary-tab header now uses 22 px Inter and a stable logo/title lockup. Compete no longer uses the oversized condensed heading.
- Explore spacing: the sport filter is unboxed and placed before Search. Normal court cards are shorter, use a one-line lighter court name, keep real metrics, and retain the required in-card Check In action.
- Color: orange remains the only primary action/live/ranked color. Sport colors remain restrained metadata and faint court geometry.
- Image quality: the real LocalCheck logo and icon-library sport marks are used. No camo profile texture, emoji, or replacement illustration was added.
- Copy: labels describe real product data. The source mock's fake location tile was not copied.

## Comparison history

### Pass 1

- P2: primary headers moved between tabs and Compete used a 28 px Oswald heading.
- P2: Explore's sport filter looked like a separate boxed control and consumed excess space.
- P2: discovery court cards were too tall and used a heavy two-line title even for short court names.

### Fixes

- Reused `ScreenHeader` with a 22 px Inter title across primary tabs.
- Moved the sport filter into the left side of the search row and removed its box.
- Reduced card padding, emblem size, button height, shadow, and minimum height.
- Changed normal card names to lighter Oswald Medium and one line; the featured local court can still use two lines.

### Pass 2

- The combined Home, Explore, Schedule, Me, and selected-map comparisons show a consistent header line, restrained color, readable hierarchy, and no clipped primary control.
- Deliberate differences are functional: Home keeps four live court metrics and a timeline; Explore cards keep Check In; Schedule keeps the requested 8 AM–11 PM buckets and View/Edit mode; the map sheet uses metrics instead of player tiles.

## Open product choice

- A collapsing Home card and a pinned Schedule heatmap remain optional interaction ideas. They were not treated as required visual fixes because the current screens remain usable and the requested behavior needs a separate motion/scroll decision.

## Verification

- Direct TypeScript check passed.
- Fresh Expo web export passed.
- `git diff --check` passed.
- Browser-rendered Home, Explore List/Map, selected map sheet, Schedule, Compete, Me, and Court Details were inspected at `430 × 932`.
- Console review found no uncaught render or navigation failure in this pass. Opening the third-party bottom sheet emits two React 19 `element.ref` deprecation messages; this did not break the selected-court flow and remains a dependency follow-up.

final result: passed
