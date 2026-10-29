/** Court drawer's expanded detent, as a share of the window. */
export const DRAWER_FULL_SHARE = 0.92;
/** The peek's own content (D63): grabber, court header and the Check in row. */
const DRAWER_PEEK_CONTENT = 178;
/** The pinned chips footer above its bottom padding: 10pt top + 30pt chips. */
const DRAWER_FOOTER_BODY = 40;

/** The footer's bottom padding, the same rule as `useSheetBottomPadding`. */
function footerPadding(bottomInset: number): number {
  return Math.max(bottomInset, 12) + 8;
}

/** Fixed opening height: the peek content plus the pinned footer, so the
 * chips sit right under Check in. Known before presentation (no content
 * measurement), so late data cannot re-snap the sheet; short windows keep a
 * distinct expanded detent. */
export function drawerPeekHeight(windowHeight: number, bottomInset = 0): number {
  const height = DRAWER_PEEK_CONTENT + DRAWER_FOOTER_BODY + footerPadding(bottomInset);
  return Math.min(height, Math.round(windowHeight * 0.6));
}
