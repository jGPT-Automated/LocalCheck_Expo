# LocalCheck design QA — canonical MVP candidate

Status: Browser-verified; physical iPhone/TestFlight acceptance pending
Last verified: 2026-07-28, America/Chicago

## Reference targets

- `design system/Profile&Compete-Screeen.png`
- `design system/CourtDetails-screen-idea2.png`
- `design system/Schedule-mock.png`
- `design system/Design.pdf`
- `design system/Logo.png`
- `design system/LOCALCHECK/README.md`

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
- Court Details keeps one identity card above Feed, Locals, Schedule, and
  Details; the longer feed and tab contents scroll with the screen.
- Ranked avatars use an orange glow; the star means accepted friend.
- The preview server sends no-cache headers and resolves direct Expo Router
  routes, preventing an earlier export bundle from surviving a restart.
- `pnpm --filter @workspace/mobile run check:release` passes TypeScript and all
  five focused Realtime tests. `git diff --check` passes.

## Open gates before merge/release

- Jesse visual review at the actual phone viewport.
- Physical iPhone verification of safe areas, sheets, keyboard behavior,
  Schedule add/remove persistence, native Mapbox marker/camera behavior, and
  two-way Realtime recovery.
- The Scheduled Runs rail snaps horizontally but is not hard-pinned over the
  heatmap; pinning remains a product decision for short phones.
- Court facility details only render fields that exist. Hours/lighting/coverage
  need a trusted data source before the UI may promise them.
- The account-deletion client and Edge Function source exist locally, but the
  function and Apple revocation secrets must be deployed and tested before the
  button can be called release-ready.

## Release boundary

The browser preview is not native proof. Do not merge, publish an OTA, trigger
an EAS build, submit to TestFlight, or mutate Supabase without Jesse's explicit
approval after reviewing the candidate.
