/** One-hour schedule axis for the Schedule heat map: 4 AM through 11 PM. */
export const SCHEDULE_START_HOUR = 4;
export const SCHEDULE_END_HOUR = 23;
export const SLOT_HOURS = Array.from(
  { length: SCHEDULE_END_HOUR - SCHEDULE_START_HOUR + 1 },
  (_, index) => SCHEDULE_START_HOUR + index,
);

export function scheduleSlotIndex(hour: number): number {
  return Math.max(0, Math.min(SLOT_HOURS.length - 1, hour - SCHEDULE_START_HOUR));
}

export function scheduleSlotLabel(hour: number): string {
  const twelve = hour % 12 === 0 ? 12 : hour % 12;
  return `${twelve} ${hour < 12 ? "AM" : "PM"}`;
}

/** Rows the heat map shows at once; it snaps between two of these windows. */
export const SCHEDULE_WINDOW_ROWS = 12;
/** Row index each window starts at: 4 AM-3 PM, then 12 PM-11 PM (they overlap 12-3 PM). */
export const SCHEDULE_WINDOW_STARTS = [0, 12 - SCHEDULE_START_HOUR] as const;

/** The window to open on: the afternoon one from 2 PM on. */
export function scheduleWindowForHour(hour: number): 0 | 1 {
  return hour >= 14 ? 1 : 0;
}
