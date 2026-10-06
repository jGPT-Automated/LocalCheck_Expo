/** Expanded court drawer detent, as a share of the screen (CourtSheetHost). */
export const DRAWER_FULL_SHARE = 0.92;
/** The court drawer's compact drag-handle row above the content. */
export const DRAWER_HANDLE_HEIGHT = 12;
/** VIEW ALL row under the detail area. */
export const DRAWER_VIEW_ALL_HEIGHT = 44;
/** Used until the peek layer has been measured once. */
export const DRAWER_PEEK_FALLBACK = 330;
/** Never shrink the detail area below this (the paywall panel needs it). */
export const DRAWER_DETAIL_MIN = 240;
/** Most locals the drawer lists; VIEW ALL opens the rest. */
export const DRAWER_LOCALS_MAX = 4;

/**
 * Space under the last row of the drawer. The home indicator sits in the
 * bottom few points of the safe area, so the row can tuck most of the way in
 * and still stay clear of it.
 */
export function drawerFooterGap(bottomInset: number): number {
  return Math.max(bottomInset - 14, 8);
}

/**
 * Height of the drawer's detail area so the expanded sheet shows everything
 * without scrolling, on every court: the same number for a court with 1 local
 * and a court with 40.
 */
export function drawerDetailHeight(input: {
  windowHeight: number;
  peekHeight: number;
  bottomInset: number;
  showViewAll: boolean;
}): number {
  const sheet = input.windowHeight * DRAWER_FULL_SHARE;
  const peek = input.peekHeight > 0 ? input.peekHeight : DRAWER_PEEK_FALLBACK;
  const footer =
    (input.showViewAll ? DRAWER_VIEW_ALL_HEIGHT : 0) + drawerFooterGap(input.bottomInset);
  const available = sheet - DRAWER_HANDLE_HEIGHT - peek - footer;
  return Math.max(DRAWER_DETAIL_MIN, Math.floor(available));
}

/**
 * How many local rows fit whole in the space left for them, so the drawer
 * never shows a row cut in half. At least 1 (when there is anyone), at most
 * DRAWER_LOCALS_MAX.
 */
export function drawerLocalsThatFit(input: {
  available: number;
  rowHeight: number;
  total: number;
}): number {
  if (input.total <= 0) return 0;
  const fit = input.rowHeight > 0 ? Math.floor(input.available / input.rowHeight) : DRAWER_LOCALS_MAX;
  return Math.min(input.total, DRAWER_LOCALS_MAX, Math.max(1, fit));
}
