/**
 * Court hours: how much time people spent on a court in the last 7 days.
 * From the court-flow handoff (HANDOFF.md › Metrics): add up each session
 * (check-out minus check-in), cap each one at 4 hours, and close a session
 * that never checked out at 3 hours. Five regulars playing 2 hours a day
 * (70h) correctly beat twenty 1-hour visits (20h).
 */
export interface CheckInSpan {
  checked_in_at: string;
  checked_out_at: string | null;
}

export interface CourtHours {
  hours: number;
  sessions: number;
}

const HOUR = 3_600_000;
const SESSION_CAP = 4 * HOUR;
const FORGOTTEN_CAP = 3 * HOUR;

export function courtHours(spans: CheckInSpan[], now: number = Date.now()): CourtHours {
  let total = 0;
  let sessions = 0;
  for (const span of spans) {
    const start = Date.parse(span.checked_in_at);
    if (Number.isNaN(start) || start > now) continue;
    const end = span.checked_out_at
      ? Date.parse(span.checked_out_at)
      : Math.min(now, start + FORGOTTEN_CAP);
    if (Number.isNaN(end) || end <= start) continue;
    total += Math.min(end - start, SESSION_CAP);
    sessions += 1;
  }
  return { hours: total / HOUR, sessions };
}

/** "70h" — whole hours, as the design shows them. */
export function formatCourtHours(hours: number): string {
  return `${Math.round(hours)}h`;
}

/** Average session, "1h 20m" or "45m"; a dash when there's no session yet. */
export function formatAverageSession({ hours, sessions }: CourtHours): string {
  if (sessions === 0) return "—";
  const minutes = Math.round((hours * 60) / sessions);
  if (minutes < 60) return `${minutes}m`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m === 0 ? `${h}h` : `${h}h ${m}m`;
}

/** Time on court so far: "Now", "38m", "1h 10m". */
export function formatTimeOnCourt(checkedInAtIso: string | undefined, now: number = Date.now()): string | null {
  if (!checkedInAtIso) return null;
  const start = Date.parse(checkedInAtIso);
  if (Number.isNaN(start)) return null;
  const minutes = Math.max(0, Math.floor((now - start) / 60_000));
  if (minutes < 1) return "Now";
  if (minutes < 60) return `${minutes}m`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m === 0 ? `${h}h` : `${h}h ${m}m`;
}

/** Next game time in the strip: "6:30P", or a dash when nothing is scheduled. */
export function formatNextGame(iso: string | null | undefined): string {
  if (!iso) return "—";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "—";
  const hours = date.getHours();
  const minutes = date.getMinutes();
  const suffix = hours >= 12 ? "P" : "A";
  const h12 = hours % 12 === 0 ? 12 : hours % 12;
  return minutes === 0 ? `${h12}${suffix}` : `${h12}:${String(minutes).padStart(2, "0")}${suffix}`;
}
