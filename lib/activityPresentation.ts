import type { FeedItem } from "@/constants/data";

/**
 * A court and a person's own profile need different weight on the same raw
 * events: a court cares that someone checked in and later checked out (two
 * live moments); a person's own history only cares that they visited — one
 * thing, with a duration. These two pure transforms turn the same
 * chronological (newest-first) FeedItem[] into the right shape for each
 * context. Neither mutates its input or reorders unrelated items.
 */

/**
 * Profile context: collapse a checkin+checkout pair for the same player at
 * the same court into one "visit" item. A checkin with no matching checkout
 * in the fetched window (still checked in, or it fell outside the page) is
 * left as a plain "checkin" rather than fabricating an open-ended visit.
 */
export function pairVisits(items: FeedItem[]): FeedItem[] {
  const chronological = [...items].reverse(); // oldest first, to track opens in order
  const openByKey = new Map<string, FeedItem>();
  const visitByCheckoutId = new Map<string, FeedItem>();
  const consumedCheckinIds = new Set<string>();

  for (const item of chronological) {
    const key = `${item.playerId}:${item.courtId ?? item.courtName ?? ""}`;
    if (item.type === "checkin") {
      openByKey.set(key, item);
      continue;
    }
    if (item.type !== "checkout") continue;
    const checkin = openByKey.get(key);
    if (!checkin) continue;
    openByKey.delete(key);
    consumedCheckinIds.add(checkin.id);

    const checkInMs = new Date(checkin.occurredAtIso).getTime();
    const checkOutMs = new Date(item.occurredAtIso).getTime();
    const durationMinutes =
      Number.isFinite(checkInMs) && Number.isFinite(checkOutMs)
        ? Math.max(0, Math.round((checkOutMs - checkInMs) / 60_000))
        : null;

    visitByCheckoutId.set(item.id, {
      ...item,
      id: `visit-${checkin.id}-${item.id}`,
      type: "visit",
      message: `Visited ${item.courtName ?? "a court"}`,
      visit: {
        checkInIso: checkin.occurredAtIso,
        checkOutIso: item.occurredAtIso,
        durationMinutes,
      },
    });
  }

  return items
    .filter((item) => !consumedCheckinIds.has(item.id))
    .map((item) => visitByCheckoutId.get(item.id) ?? item);
}

/**
 * Court context: 1-2 check-ins read fine individually, but a busy court can
 * produce a wall of them. Runs of `minCount` or more check-ins where each is
 * within `windowMinutes` of the previous one collapse into one grouped item;
 * anything else (checkouts, games, isolated check-ins) passes through
 * untouched and in place.
 */
export function groupCheckinBursts(
  items: FeedItem[],
  windowMinutes = 15,
  minCount = 3,
): FeedItem[] {
  const result: FeedItem[] = [];
  let run: FeedItem[] = [];

  const flushRun = () => {
    if (run.length === 0) return;
    if (run.length < minCount) {
      result.push(...run);
    } else {
      const newest = run[0];
      const oldest = run[run.length - 1];
      result.push({
        ...newest,
        id: `burst-${oldest.id}-${newest.id}`,
        type: "checkin_burst",
        message: `${run.length} people checked in`,
        burst: {
          count: run.length,
          playerNames: run.map((entry) => entry.playerName),
          startIso: oldest.occurredAtIso,
          endIso: newest.occurredAtIso,
        },
      });
    }
    run = [];
  };

  for (const item of items) {
    if (item.type !== "checkin") {
      flushRun();
      result.push(item);
      continue;
    }
    const previous = run[run.length - 1];
    const withinWindow =
      !previous ||
      Math.abs(
        new Date(previous.occurredAtIso).getTime() -
          new Date(item.occurredAtIso).getTime(),
      ) <=
        windowMinutes * 60_000;
    if (withinWindow) {
      run.push(item);
    } else {
      flushRun();
      run.push(item);
    }
  }
  flushRun();
  return result;
}

/** "1h 24m" / "42m" — for a visit's duration, or a burst's time span. */
export function formatDurationMinutes(minutes: number | null): string {
  if (minutes == null || !Number.isFinite(minutes) || minutes < 0) return "—";
  if (minutes < 1) return "<1m";
  const hours = Math.floor(minutes / 60);
  const remaining = minutes % 60;
  if (hours === 0) return `${remaining}m`;
  return remaining === 0 ? `${hours}h` : `${hours}h ${remaining}m`;
}

/** "TODAY" / "YESTERDAY" / "SEP 2" — for a visit or game's day label. */
export function formatRelativeDay(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  const startOfDay = (d: Date) =>
    new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const diffDays = Math.round(
    (startOfDay(new Date()) - startOfDay(date)) / 86_400_000,
  );
  if (diffDays === 0) return "TODAY";
  if (diffDays === 1) return "YESTERDAY";
  return date
    .toLocaleDateString("en-US", { month: "short", day: "numeric" })
    .toUpperCase();
}
