# Design QA

Use the supplied images/PDF under `design system/` and relevant prior captures
under `design-qa/` as review references. They communicate intent; they are not
executable mock apps or exact data contracts.

## Surfaces

- Shared header: `components/ScreenHeader.tsx`
- Shared court identity: `components/CourtListItem.tsx`
- Explore list/map: `components/CourtsScreen.tsx`, `components/MapScreen.tsx`,
  and `components/MapScreen.web.tsx`
- Home: `components/HomeScreen.tsx`
- Profile and Compete: `app/(tabs)/elo.tsx`, `app/(tabs)/compete.tsx`
- Court and Schedule: `app/court/[id].tsx`,
  `components/CourtSchedulePanel.tsx`, `app/(tabs)/schedule.tsx`
- Forms and sheets: `components/sheet/`

## Acceptance checklist

- Browser and iPhone show the same content hierarchy and state meaning.
- Safe areas, keyboard, sheet dismissal, scrolling, and long content work.
- Empty, loading, failure, populated, private, and offline-return states are
  distinguishable and honest.
- Touch targets are at least 44x44, controls have accessible names, and color
  is never the only state signal.
- Icon-only header controls may look smaller than their hit region: use the
  shared header action so the visible glyph remains restrained while the
  pressable area stays at least 44x44.
- Me and public-player identity surfaces use the same compact `ProfileHero`,
  ELO placement, stat rhythm, semantic colors, and QR-from-avatar behavior.
- Player lists use `PlayerSummaryRow`; names, court metadata, and right-aligned
  ELO must not vary by row or by which collection produced the player.
- A shared-component visual review includes every sibling screen that consumes
  the owner, not only the route where the change was requested.
- Reduced motion preserves understanding and navigation.
- Court attributes and counts render only when confirmed by a trusted source.
- Native Mapbox markers remain geographically anchored; selection and camera
  behavior are stable.
- Multi-user Realtime updates converge without tab switches or duplicate rows.

## Evidence

For visual pull requests, attach a browser screenshot and iPhone screenshot of
the same meaningful state, plus the build/browser used. Run `pnpm check` and
`pnpm export:web`; browser verification is not proof of native behavior.
