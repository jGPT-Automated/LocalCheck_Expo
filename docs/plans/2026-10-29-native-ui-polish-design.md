# Native UI polish — proposed design

Status: screenshots shown in chat; proceeding under Jesse's explicit request
to implement polish and open a PR for preview. The visual direction is the
agent's call for review, not a separately approved design. The requested PR
includes previously approved scroll fixes (commit `98e88e8`) plus this polish.

## Intent and evidence

Polish Explore's court cards and Home's court header using Jesse's supplied
references. Preserve the dark LocalCheck palette, orange action, Oswald/Inter
type, real data and the approved navigation/scroll behavior. No new wording,
dependency, SDK upgrade, backend work or production release.

Read both PanelUI pages fully:
- https://panelui.dev/docs/native
- https://panelui.dev/docs/customization/colors

Native rendering has platform-owned metrics and behavior; themes do not reach
those controls. PanelUI's native path requires Expo SDK 56+, so this SDK 54
Expo Go preview reuses existing components. Apply semantic surface/text tokens
and familiar native interaction rather than adding an incompatible package.

Read the collection page and visually inspected the 29 returned shot images:
https://dribbble.com/GenJess/collections/7947902-Jesse-Taste

Observed recurring traits: clear type hierarchy, restrained accents, softened
surfaces and legible grouped data. The collection includes light and dark work;
its hosting site's pink branding is not a statement of Jesse's palette.
Relevant dark examples include Personal Dashboard, Zenith, Step App and the
GeoSales/Haulix dashboards. Mobile task/health apps inform surface hierarchy.

## Approaches and proposed choice

1. Recommended: focused polish of the existing court components. Remove the
   decorative quarter-circle and court-line art from Explore and Home; use a
   quieter rounded card, one navigation chevron, readable metadata/stat labels
   and a left-aligned Home identity. Keeps the app recognizable and compatible.
2. Full component/theme migration: substantially larger runtime and styling
   change; native PanelUI's SDK requirement conflicts with the current preview.
3. Copy a complete light/pastel reference theme: changes the established brand
   rather than solving these two surfaces. Not proposed.

## Concrete proposal

- `CourtListItem`: use existing surface/border/radius tokens; remove CourtArt
  and LocalMark from these cards. MY LOCAL COURT already identifies the local
  card. Keep whole-card navigation; add the installed Feather chevron as a
  noninteractive cue. Refine title/place spacing and maintain large tap target.
- `HomeCourtHero`: remove decorative art and redundant local marker. Align
  title/place to the screen gutter. Keep the name/stat region sticky and the
  existing check-in, court action, feed and bottom-floor behavior.
- `SportLabel` / `MetricStrip`: reuse the shared typography, with metadata and
  stat captions readable at 11pt and sufficient contrast. Keep numeric values
  primary, preserve units and prevent caption clipping at 375px.
- Preserve LocalMark's functional set-local action on court details/drawers
  unless Jesse explicitly expands the removal to those surfaces.

Mockups are browser-only modifications of the connected app, not implemented
product changes: `/workspace/shared/ui-polish-proposal/*-proposed.png`.
Original captures are saved beside them as `*-before.png`.

## Acceptance and delivery

Check real connected Home top/scrolled, Explore local/nonlocal cards and drawer
navigation at 375×667, 393×852, 430×932; include long court names and populated
counts in automated fixtures. Verify shared labels on court details/drawer.
Run check:release, diff checks and full visual QA; compare existing main's
known accessibility debt without raising its limits. Log any remaining debt.
Show before/after screenshots and open the requested PR against main, then
verify the Expo/Vercel preview jobs and provide the actual preview link/QR.
