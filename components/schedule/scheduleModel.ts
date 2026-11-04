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

/** Keep each heatmap target at least 44pt high, with overlapping scroll windows. */
export function scheduleGridLayout(availableHeight: number) {
  const rowPitch = Math.max(48, Math.floor(availableHeight / SCHEDULE_WINDOW_ROWS));
  const visibleRows = Math.max(1, Math.min(SCHEDULE_WINDOW_ROWS, Math.floor(availableHeight / rowPitch)));
  const lastStart = SLOT_HOURS.length - visibleRows;
  const starts = [0];
  const step = Math.max(1, visibleRows - 1);
  while (starts[starts.length - 1] < lastStart)
    starts.push(Math.min(lastStart, starts[starts.length - 1] + step));
  return { rowPitch, visibleRows, viewportHeight: visibleRows * rowPitch, starts };
}

/** Restore the nearest window after resize, or choose a useful initial window. */
export function scheduleGridStart(grid: ReturnType<typeof scheduleGridLayout>, hour: number, previousTop?: number) {
  if (previousTop === undefined && grid.visibleRows === SCHEDULE_WINDOW_ROWS)
    return SCHEDULE_WINDOW_STARTS[scheduleWindowForHour(hour)];
  const desired = previousTop ?? Math.max(0, scheduleSlotIndex(hour) - Math.floor(grid.visibleRows / 2));
  return grid.starts.reduce((best, start) => Math.abs(start - desired) < Math.abs(best - desired) ? start : best, grid.starts[0]);
}
