# Court Sheet QA — 2026-08-02

This checkpoint validates the shared court-detail bottom sheet at the compact and expanded detents.

## Contract under review

- One continuous surface from handle through scroll content
- Compact and expanded detents remain available
- Sheet never expands through the iOS top safe area
- Bottom content owns the device bottom inset
- Backdrop tap and downward pan dismiss the sheet
- Court data, check-in, local-court, realtime, and navigation behavior remain unchanged

## Evidence

- `01-before-compact.jpg` — original compact sheet
- `02-before-expanded.jpg` — original expanded sheet
- `03-after-compact.jpg` — updated compact sheet
- `04-after-expanded.jpg` — updated expanded sheet

The after images are added only after the rebuilt preview and gesture verification pass.

## Result

Passed in the rebuilt 393 × 852 in-app preview: compact detent, expanded detent,
upward drag, and swipe-down dismissal. The first rebuild exposed a visible web
scroll indicator; it was corrected before the final after captures. Native iOS
safe-area, VoiceOver, Reduce Motion, and physical drag feel remain part of the
Expo Go checkpoint.
