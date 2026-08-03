# Changelog

All notable LocalCheck brand-system changes are recorded here.

## Unreleased sheet-system checkpoint - 2026-08-02

- Rebuilt the contextual court sheet around one animated background and one
  continuous custom handle/content surface.
- Added top safe-area ownership while preserving the existing compact/full
  detents, backdrop dismissal, downward-pan dismissal, and court logic.
- Added the canonical `SCREEN_SYSTEM.md` route-to-shell map covering every
  current primary, detail, task, overlay, and hidden legacy route.
- Saved compact/expanded before-and-after gesture evidence under
  `design-qa/2026-08-02-court-sheet/`.

## Unreleased profile typography correction - 2026-08-02

- Added a semantic mobile type scale benchmarked against the official Material
  3 title, body, supporting, label, and metric ladder.
- Reduced the Me header handle, shared profile name, avatar, ELO, and stat row
  from oversized display treatment to compact product roles.
- Raised undersized profile labels onto an 11/16 minimum role and replaced the
  activity feed's extra-light type with normal body text.
- Saved same-viewport before/after evidence under
  `design-qa/2026-08-02-profile-type-scale/`.

## Unreleased header identity update - 2026-08-02

- Restored the actual `LOCALCHECK` wordmark to Home while keeping the shared
  lockup grammar across Schedule, Compete, Explore, and Me.
- Replaced the scaled in-app raster mark with the approved native SVG geometry
  for crisp rendering at header and boot sizes.
- Added one shared 23-point Oswald 500 wordmark role with 1.5-point tracking and
  reduced the primary mark to 26 points.
- Replaced the unrelated boxed detail chevron with a 44-point branded back
  control that resolves from the mark over 220ms and respects Reduce Motion.

## Unreleased product update — 2026-07-27

- Added the local-first Explore structure: full-width `List` / `Map`, featured local court, market-scoped bounded discovery, and `View All`.
- Refined Explore cards around the premium Home grammar: smoky court geometry, restrained single-color sport emblems, open active/local stats, and an in-card Check In action; removed the colored edge and detached action row.
- Replaced web DOM markers with a Mapbox GeoJSON source, canvas style layers, built-in clustering, cluster expansion, and market-scoped viewport reads. Native retains the equivalent `ShapeSource`/layer implementation.
- Matched Explore's `List / Map` control to Compete's segmented-control grammar and removed secondary subtitles/profile affordances from primary tab headers.
- Implemented Schedule `View / Edit` mode with multi-cell pending selection, visibility for new times, cancel, one bounded save action, and retry-safe failure state.
- Removed the misleading `All / BB / PB` leaderboard control while only overall Elo exists, and moved the hidden-user placeholder inline without duplicating the public row.
- Recorded that persistent app-wide profile privacy still needs a backend contract and is not solved by the local presentation change.

## Unreleased operating update — 2026-07-26

- Added the confirmed shared primary-tab header grammar: mark plus wordmark-styled page title, with no redundant profile avatar.
- Added the confirmed Schedule interaction: default shared heatmap, multi-select `Edit My Times` mode, and one batch save via `Done`.
- Added the Schedule structure baseline: fixed safe-area-aware header, intentional content-only scrolling, shared type roles, gutters, and spacing rhythm.
- Recorded the JAWS Brand Asset Sheet as the current provisional visual base, the unresolved bracketed-check construction, and the preference for a lighter premium geometric/technical display face.
- Saved the full browser reference set, including Jesse's curated mobile and logo inspiration, and recorded the shared quality signals before browser cleanup.
- Added `LAUNCH_CONTROL.md` as the evidence-backed cross-project current-state, burn-down, release-gate, and delegation document.
- Corrected the working authority map for the actual Expo, web PR, JAWS, Brand, and agent folders.
- Recorded the proposed one-contract rule for web/mobile planning and the verified-release boundary for the next TestFlight build.
- Reordered launch work around Jesse's actual outcomes: current-main TestFlight build, native map acceptance, two-phone Realtime acceptance, then the cohesive web/mobile UI and brand pass.
- Archived the stale dirty Expo checkout intact and restored the canonical local Expo path to clean GitHub `main` at `7a6862e`.
- Recorded the first current-main EAS release attempt and its single blocking failure: Mapbox SDK download returned HTTP 403 before the iOS build.

## Unreleased draft — 2026-07-23

- Drafted `/Users/JesseH/Projects/LocalCheck_Brand` as a proposed brand-governance and decision-history location.
- Defined the shared court-passport identity model.
- Proposed LocalCheck orange as the single identity accent.
- Removed sport-color theming and decorative sport side stripes from the current direction.
- Defined coordinated web and mobile expressions.
- Added cross-platform motion, accessibility, imagery, and honest-data rules.
