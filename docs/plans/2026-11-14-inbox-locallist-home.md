# Inbox, LocalList and Home status

Approved by Jesse in this conversation, built from PR #91 at `3e12738`.
No #90 changes or migrations are imported. No backend write or release.

## Implementation

1. Keep the compact inbox and cover all incoming and own manual/automatic
   event presentations in the shared row. Verify paging, errors and push-off.
2. Add an account-scoped, in-memory LocalList UI context, seeded from the real
   local court. No localStorage, new RPC or fake production records. Extra
   courts/default choices last only for the current app session in this pass.
3. Compose existing CourtListItem/CourtTitleRow, SearchField and FormSheet:
   court-page plus adds; Explore lists default first; Settings search above
   evenly aligned cards, explicit star selects default. Home/Schedule pickers
   only change the page view. Use the existing LocalPlus entitlement.
4. Home hero becomes a fixed sibling flush with ScreenHeader. Add a title
   dropdown and native horizontal paging with short active-page lines.
   Preserve court-page arrow beside Check in and existing planner order.
5. ScreenHeader remains LOCALCHECK left and information only on the right.
   Orange treatment follows pending/active status. Auto pending: Posts in
   countdown, Cancel/Post in the existing hero action position. Manual posts
   immediately; posted sessions display elapsed time from checked_in_at.
   Do not fabricate a pending-to-posted transition at countdown zero.
6. Extend the existing check-in reader to expose checked_in_at; no new backend
   contract. Early Post is displayed but disabled until the backend has an
   atomic pending-auto confirmation operation; do not misuse manual check-in
   or resume as early posting. Delivery/source remains the backend slice. Cancel uses
   the existing pending-arrival undo operation. Both wait for server success.

## Reuse and inspected references

| Need | Existing owner | Decision |
| --- | --- | --- |
| Court identity and cards | CourtTitleRow, CourtListItem, HomeCourtHero | Compose, do not duplicate |
| Drawer/search | FormSheet, RunFlowSheet, SearchField | Reuse native drawer and keyboard behavior |
| Home reference | LCv5 src/features/home/HomeScreen.tsx | Adopt horizontal pager, title menu, indicators, orange header; retain LOCALCHECK and hero controls per Jesse |
| Gesture API | React Native ScrollView docs via Context7 | pagingEnabled, measured page width, scrollTo, onMomentumScrollEnd |
| Pending copy | Existing AutoCheckInNote, autoCheckInModel | Adapt Posts at to Posts in for remaining duration |
| Branding | LogoMark | Existing bracket mark only; no new animation system |

## Verification

Implemented on `codex/inbox-locallist-home`. The isolated journey passes at
all three sizes: 45 captured states, no page errors or layout failures.
The inbox's existing failure/retry and equal-timestamp cursor journey also
passes at 393px with 43 unique records. Evidence and source trail:
`docs/product/design-qa/2026-11-14-locallist-home/README.md`.

- Model tests: list membership/default/cap/free, pending vs active status,
  expiration awaiting server confirmation, elapsed time and clock boundaries.
- pnpm check; git diff --check; fresh Expo preview.
- Isolated browser routes at 375x667, 393x852, 430x932: inbox all types and
  pagination; add court → Explore → Settings default → Home dropdown/swipe;
  search-first geometry, hero/header flush, pending Cancel/Post, manual and
  auto elapsed status. Intercept all service HTTP and block WebSockets.
- Retain before/after screenshots and measured layout results. No production
  user mutations, push sends, schema changes, native builds or OTA.
