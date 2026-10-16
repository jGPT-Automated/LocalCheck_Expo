/**
 * How busy a court is through one day, hour by hour (like a maps app's
 * "popular times"): hours already gone count who was actually on court
 * (check-in sessions), hours ahead count who plans to come (planned visits
 * plus players signed up for scheduled games). Pure, so it is tested.
 */
import type { CheckInSpan } from "./courtHours";

export const BUSY_FIRST_HOUR = 6;
export const BUSY_LAST_HOUR = 22;
/** A session nobody checked out of counts for 3 hours (same as court hours). */
const FORGOTTEN_MS = 3 * 3_600_000;

export type BusyKind = "past" | "now" | "planned";

export interface BusyBar {
  hour: number;
  value: number;
  kind: BusyKind;
}

export interface PlannedGame {
  startIso: string;
  going: number;
}

function dayStart(now: number, dayOffset: number): Date {
  const d = new Date(now);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + dayOffset);
  return d;
}

function hourWindow(day: Date, hour: number): [number, number] {
  const start = new Date(day);
  start.setHours(hour, 0, 0, 0);
  return [start.getTime(), start.getTime() + 3_600_000];
}

/** People on court at any point in [from, to). */
function onCourt(spans: CheckInSpan[], from: number, to: number, now: number): number {
  let count = 0;
  for (const span of spans) {
    const start = Date.parse(span.checked_in_at);
    if (Number.isNaN(start)) continue;
    const end = span.checked_out_at ? Date.parse(span.checked_out_at) : Math.min(now, start + FORGOTTEN_MS);
    if (start < to && end > from) count += 1;
  }
  return count;
}

function plannedIn(planned: Date[], games: PlannedGame[], from: number, to: number): number {
  let count = 0;
  for (const time of planned) {
    const t = time.getTime();
    if (t >= from && t < to) count += 1;
  }
  for (const game of games) {
    const t = Date.parse(game.startIso);
    if (t >= from && t < to) count += game.going;
  }
  return count;
}

export function busyDay(input: {
  dayOffset: number;
  now: number;
  spans: CheckInSpan[];
  planned: Date[];
  games: PlannedGame[];
}): BusyBar[] {
  const { dayOffset, now, spans, planned, games } = input;
  const day = dayStart(now, dayOffset);
  const nowHour = new Date(now).getHours();
  const bars: BusyBar[] = [];
  for (let hour = BUSY_FIRST_HOUR; hour <= BUSY_LAST_HOUR; hour += 1) {
    const [from, to] = hourWindow(day, hour);
    const kind: BusyKind =
      dayOffset < 0 || (dayOffset === 0 && hour < nowHour)
        ? "past"
        : dayOffset === 0 && hour === nowHour
          ? "now"
          : "planned";
    const value =
      kind === "planned"
        ? plannedIn(planned, games, from, to)
        : onCourt(spans, from, Math.min(to, now), now);
    bars.push({ hour, value, kind });
  }
  return bars;
}

/** "6A", "12P", "10P". */
export function hourLabel(hour: number): string {
  const h = hour % 12 === 0 ? 12 : hour % 12;
  return `${h}${hour < 12 ? "A" : "P"}`;
}

/** "Today", "Yesterday", "Tomorrow", "Sat, Oct 17". */
export function busyDayLabel(dayOffset: number, now: number): string {
  if (dayOffset === 0) return "Today";
  if (dayOffset === -1) return "Yesterday";
  if (dayOffset === 1) return "Tomorrow";
  return dayStart(now, dayOffset).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
}

/** One line under the chart, honest about what the bars are. */
export function busyCaption(bars: BusyBar[], dayOffset: number): string {
  const busiest = bars.reduce((best, bar) => (bar.value > best.value ? bar : best), bars[0]);
  if (!busiest || busiest.value === 0) {
    return dayOffset < 0 ? "Nobody checked in" : dayOffset > 0 ? "No plans yet" : "Quiet so far";
  }
  const peak = `Busiest around ${hourLabel(busiest.hour)}`;
  if (dayOffset < 0) return `${peak} · check-ins`;
  if (dayOffset > 0) return `${peak} · planned visits and games`;
  return `${peak} · outlined bars are planned`;
}
