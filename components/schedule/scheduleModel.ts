/** Shared one-hour schedule axis used by Home and Schedule. */
export const SCHEDULE_START_HOUR = 8;
export const SCHEDULE_END_HOUR = 22;
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
