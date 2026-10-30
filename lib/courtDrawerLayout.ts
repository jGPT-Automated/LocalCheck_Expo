/** Court drawer's expanded detent, as a share of the window. */
export const DRAWER_FULL_SHARE = 0.92;
/** Fixed opening height on portrait phones; independent of async court data. */
const DRAWER_PEEK_HEIGHT = 360;

/** Leave a distinct expanded detent on shorter windows. No content measurement
 * changes this value after presentation, so late data cannot re-snap the sheet. */
export function drawerPeekHeight(windowHeight: number): number {
  return Math.min(DRAWER_PEEK_HEIGHT, Math.round(windowHeight * 0.6));
}
