# LocalCheck design QA — canonical MVP candidate

Status: Browser-verified; physical iPhone/TestFlight acceptance pending
Last verified: 2026-07-29, America/Chicago
Review source: open PR [#22](https://github.com/jGPT-Automated/LocalCheck_Expo/pull/22), branch `codex/mvp-consolidation`

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

## Open gates before merge/release

- Jesse visual review at the actual phone viewport.
- Jesse accepts the refreshed Home and Me polish in the visible preview.
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

The browser preview is not native proof. Do not merge PR #22, publish an OTA, trigger
an EAS build, submit to TestFlight, or mutate Supabase without Jesse's explicit
approval after reviewing the candidate.
