# LocalCheck design QA — current main

Status: Current-main browser assessment complete; production UI foundation and physical iPhone acceptance remain
Last verified: 2026-08-01, America/Chicago
Review source: GitHub `main` at `81ff0a4`; PR [#22](https://github.com/jGPT-Automated/LocalCheck_Expo/pull/22) is merged historical context

## Current assessment

The complete first-time-user walkthrough, production table-stakes scorecard,
component inconsistency inventory, screen-level backlog, delight layer, and nine
reference captures are in
[`assessments/2026-08-01-current-build-assessment.md`](assessments/2026-08-01-current-build-assessment.md).

Current design verdict:

- Preserve the graphite/orange athletic identity, court-first Home, honest
  empty states, familiar five-tab shell, List/Map discovery, and court sheet.
- The visual direction is stronger than the implementation system. Core
  surfaces still free-code buttons, rows, tabs/segments, headers, state
  feedback, spacing, touch targets, and type sizes.
- The production bar is not yet met for user-controlled identity, first-run
  location/privacy, accessibility, complete action states, native acceptance,
  or release/source-of-truth integrity.
- Delight should come from live court energy, personal progress, and meaningful
  milestones after navigation, forms, settings, and basic controls are familiar.

The 2026-08-01 browser baseline lives at
`design-qa/2026-08-01-onboarding-assessment/` and covers Auth, first Home,
Explore, set local, populated Home, Schedule, Compete, Me, and the court sheet.

## Foundation candidate review

The approved hybrid direction is now represented by a local foundation
candidate, with the contract and acceptance gates in
[`DESIGN_FOUNDATION.md`](DESIGN_FOUNDATION.md). A fresh signed-in export at
`http://127.0.0.1:8082/` was visually reviewed after implementation.

Verified in the current candidate:

- Home, Schedule, Compete, Explore, and Me repeat one mark, title baseline,
  gutter, surface band, and divider.
- Me uses the username in the primary header with reachable Notifications and
  Settings actions.
- Me and another-player profiles share one identity/ELO/stat scaffold while
  retaining their existing authoritative data paths and actions.
- Primary tab, scope, mode, visibility, privacy, sport, and court-section
  switches use the same tab/segment grammar with selected semantics.
- Shared buttons and header actions provide at least 44-point targets and
  restrained pressed feedback; generic taps no longer imply success through a
  medium haptic.
- Reduced Motion has a shared hook, live pulse becomes static, and entry motion
  uses a small opacity/scale change instead of a large spring.
- The selected-court sheet has one continuous surface with a top-only outline;
  no side or bottom seam was visible in the resting browser state.

Still required before this checkpoint can be called accepted:

- Physical iPhone and Expo Go review at supported font sizes.
- VoiceOver order, Dynamic Type, Reduce Motion, outdoor contrast, keyboard,
  safe-area, and sheet-drag checks.
- Native Mapbox and the complete release gate.
- Jesse's direct visual approval before delivery.

## Reference targets

- `design system/Profile&Compete-Screeen.png`
- `design system/CourtDetails-screen-idea2.png`
- `design system/Schedule-mock.png`
- `design system/Design.pdf`
- `design system/Logo.png`
- `design system/LOCALCHECK/README.md`
- `/Users/JesseH/Downloads/IMG_4869.jpg` through `IMG_4874.jpg` (selected visual anchors)

## Candidate surfaces

- Shared primary header: `artifacts/mobile/components/ScreenHeader.tsx`
- Shared court card: `artifacts/mobile/components/CourtListItem.tsx`
- Explore list/map: `artifacts/mobile/components/CourtsScreen.tsx`,
  `MapScreen.tsx`, and `MapScreen.web.tsx`
- Profile/Me: `artifacts/mobile/app/(tabs)/elo.tsx`
- Compete: `artifacts/mobile/app/(tabs)/compete.tsx`
- Court Details: `artifacts/mobile/app/court/[id].tsx`
- Court schedule: `artifacts/mobile/components/CourtSchedulePanel.tsx`
- Main Schedule: `artifacts/mobile/app/(tabs)/schedule.tsx`
- Shared task form: `artifacts/mobile/components/sheet/FormSheet.tsx`

## Verified locally

- Fresh signed-in Expo web export loaded Home, Explore List/Map, Schedule,
  Compete, Me, and every Court Details tab.
- Schedule renders 8 AM–11 PM heat buckets, defaults to the current bucket on
  focus, exposes View/Edit states, and opens the shared Host a Run form.
- Explore uses a city-scoped bounded list, a compact sport dropdown, full-width
  List/Map tabs, Mapbox canvas layers, and compact matte court cards.
- Primary-tab titles use the requested 22 px Inter treatment. The Explore sport
  filter sits unboxed before Search; regular court names are lighter, one line,
  and more compact while the local court can still use two lines.
- Court Details keeps one identity card above Feed, Locals, Schedule, and
  Details; the longer feed and tab contents scroll with the screen.
- Ranked avatars use an orange glow; the star means accepted friend.
- The preview server sends no-cache headers and resolves direct Expo Router
  routes, preventing an earlier export bundle from surviving a restart.
- `pnpm --filter @workspace/mobile run check:release` passes TypeScript and all
  five focused Realtime tests. `git diff --check` passes.
- Side-by-side source/implementation evidence and pass history are recorded in
  [`../../design-qa.md`](../../design-qa.md) and `design-qa/2026-07-29/`.
- The selected-court sheet still emits a React 19 `element.ref` deprecation
  message from its dependency on web. It rendered and interacted correctly in
  this pass; track the dependency warning separately from visual acceptance.
- Home now renders its local court as a full-width matte section instead of an
  Explore card. The sport mark and color are quiet, stats are centered, and
  `View all` is part of the roster header. Only the Activity Feed is vertically
  scrollable; the header, court, roster, and Next Run remain fixed.
- The Home check-in action is inset from the section edges and uses restrained
  orange elevation. Me activity copy uses the loaded Inter extra-light face so
  dense feed rows no longer read as uniformly bold. These two changes still
  need Jesse's visible phone-width acceptance in the refreshed preview.
- A fresh Expo web export containing the review fixes is served at
  `http://127.0.0.1:8081/` with no-cache headers. The existing signed-in browser
  tab was reloaded and visually checked at phone width. Home showed the inset,
  elevated check-in action; Me showed the lighter activity copy and reachable
  Friends surface. Court Details → Schedule → Create a Run opened the Host Run
  form with Jaycee Park already selected. No form was submitted and no QA data
  was written.

## Open production UI acceptance gates

- Review and approve the shared production primitives, type ramp, spacing scale,
  control heights, icon rules, and action-state contract before screen-by-screen
  polish branches diverge again.
- Fresh-account first-run identity, sport, market/local-court, and privacy flow;
  profile editing; and long-content resilience.
- VoiceOver, Dynamic Type, reduced-motion, outdoor contrast, and 44-point target
  acceptance across the core journey.
- Physical iPhone verification of safe areas, sheets, keyboard behavior,
  Schedule add/remove persistence, native Mapbox marker/camera behavior, and
  two-way Realtime recovery.
- The Scheduled Runs rail snaps horizontally but is not hard-pinned over the
  heatmap; pinning remains a product decision for short phones.
- Court facility details only render fields that exist. Hours/lighting/coverage
  need a trusted data source before the UI may promise them.
- The account-deletion client, Edge Function source, reproducible foreign-key
  contract, and matching Apple secret names exist locally. The function must be
  deployed and physically tested before the button can be called release-ready.

## Release boundary

The browser preview is not native proof. PR #22 is already merged; this document
does not authorize a merge, OTA, EAS build, TestFlight submission, or Supabase
mutation. Those actions still require Jesse's explicit approval.
