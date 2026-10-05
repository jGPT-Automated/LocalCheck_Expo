/** Expanded court drawer detent, as a share of the screen (CourtSheetHost). */
export const DRAWER_FULL_SHARE = 0.92;
/** The sheet's drag-handle row above the content. */
export const DRAWER_HANDLE_HEIGHT = 24;
/** VIEW ALL row under the detail area. */
export const DRAWER_VIEW_ALL_HEIGHT = 44;
/** Used until the peek layer has been measured once. */
export const DRAWER_PEEK_FALLBACK = 330;
/** Never shrink the detail area below this (the paywall panel needs it). */
export const DRAWER_DETAIL_MIN = 240;

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
  const footer = (input.showViewAll ? DRAWER_VIEW_ALL_HEIGHT : 0) + input.bottomInset + 8;
  const available = sheet - DRAWER_HANDLE_HEIGHT - peek - footer;
  return Math.max(DRAWER_DETAIL_MIN, Math.floor(available));
}
