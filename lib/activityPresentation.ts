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

// ─── Timeline presentation ──────────────────────────────────────────────────
// The activity timeline: a rail with one marker per item, grouped under day
// headers. A game is a small card hanging off the rail; check-ins, check-outs
// and visits stay single quiet lines. These helpers decide the words; the
// ActivityRow component draws them. Pure, so the copy is testable.

export type LineSegment = {
  text: string;
  /** "name" is a person (white, semibold); "time" is the quiet tail. */
  tone: "name" | "text" | "time";
  /** Long text (names) gives way first, so verbs and times are never cut. */
  shrink?: boolean;
  /** Tapping this segment opens the person. */
  actor?: boolean;
};

export type TimelineMarker = "game" | "checkin" | "quiet";

export type GameLine = {
  name: string;
  /** The score, or "W" / "L" when a player hid it. */
  score: string;
  winner: boolean;
};

export type TimelineModel =
  | {
      kind: "line";
      marker: TimelineMarker;
      segments: LineSegment[];
      /** A burst opens to every name when tapped. */
      expandedText?: string;
      accessibilityLabel: string;
    }
  | {
      kind: "game";
      marker: "game";
      /** Winner first, then loser. */
      lines: [GameLine, GameLine];
      /** "2v2 at Rancho · 6:40 PM" */
      caption: string;
      accessibilityLabel: string;
    };

function firstName(name: string): string {
  return name.trim().split(/\s+/)[0] || name;
}

/** "Marcus", "Marcus & Ben", "Marcus, Ben & Eli". */
function joinTeam(names: string[]): string {
  if (names.length <= 1) return names[0] ?? "";
  if (names.length === 2) return `${names[0]} & ${names[1]}`;
  return `${names.slice(0, -1).join(", ")} & ${names[names.length - 1]}`;
}

/** "Today", "Yesterday", "Sep 6" (adds the year when it is not this year). */
export function formatDayLabel(iso: string, now: Date = new Date()): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  const startOfDay = (d: Date) =>
    new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const diffDays = Math.round((startOfDay(now) - startOfDay(date)) / 86_400_000);
  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "Yesterday";
  return date.toLocaleDateString(
    "en-US",
    date.getFullYear() === now.getFullYear()
      ? { month: "short", day: "numeric" }
      : { month: "short", day: "numeric", year: "numeric" },
  );
}

/** "6:40 PM" */
export function formatClock(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
}

/** The item starts a new day group (the first item always does). */
export function startsNewDay(item: FeedItem, previous?: FeedItem): boolean {
  if (!previous) return true;
  const a = new Date(item.occurredAtIso);
  const b = new Date(previous.occurredAtIso);
  return (
    a.getFullYear() !== b.getFullYear() ||
    a.getMonth() !== b.getMonth() ||
    a.getDate() !== b.getDate()
  );
}

function describeGame(item: FeedItem): TimelineModel | null {
  const match = item.match;
  if (!match) return null;
  const winners = match.winnerSide === "a" ? match.sideA : match.sideB;
  const losers = match.winnerSide === "a" ? match.sideB : match.sideA;
  const winScore = match.winnerSide === "a" ? match.scoreA : match.scoreB;
  const loseScore = match.winnerSide === "a" ? match.scoreB : match.scoreA;
  const hidden = Boolean(match.scoresHidden);
  const winnerName = joinTeam(winners.map((p) => firstName(p.name))) || "Winners";
  const loserName = joinTeam(losers.map((p) => firstName(p.name))) || "Opponents";
  const format = `${Math.max(1, match.sideA.length)}v${Math.max(1, match.sideB.length)}`;
  const court = item.courtName?.trim();
  const caption = [
    court ? `${format} at ${court}` : format,
    formatClock(match.playedAt || item.occurredAtIso),
    match.ranked === false ? "Casual" : "",
  ]
    .filter(Boolean)
    .join(" · ");
  return {
    kind: "game",
    marker: "game",
    lines: [
      { name: winnerName, score: hidden ? "W" : String(winScore), winner: true },
      { name: loserName, score: hidden ? "L" : String(loseScore), winner: false },
    ],
    caption,
    accessibilityLabel: `${winnerName} beat ${loserName}${hidden ? "" : `, ${winScore} to ${loseScore}`}, ${caption}`,
  };
}

/**
 * The words and shape of one timeline item. `showActor` is for lists that mix
 * players (the court feed): the person's name leads the line and truncates on
 * its own, so the verb and the time are never cut.
 */
export function describeTimelineItem(
  item: FeedItem,
  options: { showActor?: boolean } = {},
): TimelineModel {
  const { showActor = false } = options;
  const court = item.courtName?.trim();
  const actor = item.playerName.trim() || "Someone";
  const clock = formatClock(item.occurredAtIso);

  if (item.type === "game_result") {
    const game = describeGame(item);
    if (game) return game;
  }

  // "Checked in at Rancho · 6:40 PM" on a profile; "Marcus checked in ·
  // 6:40 PM" where players are mixed.
  const presence = (
    marker: TimelineMarker,
    verb: string,
    preposition: string,
  ): TimelineModel => {
    const text = showActor
      ? verb.toLowerCase()
      : court
        ? `${verb} ${preposition} ${court}`
        : verb;
    const segments: LineSegment[] = showActor
      ? [
          { text: actor, tone: "name", shrink: true, actor: true },
          { text, tone: "text" },
          { text: `· ${clock}`, tone: "time" },
        ]
      : [
          { text, tone: "text", shrink: true },
          { text: `· ${clock}`, tone: "time" },
        ];
    return {
      kind: "line",
      marker,
      segments,
      accessibilityLabel: `${showActor ? `${actor} ${text}` : text}, ${clock}`,
    };
  };

  switch (item.type) {
    case "checkin":
      return presence("checkin", "Checked in", "at");
    case "checkout":
      return presence("quiet", "Checked out", "of");
    case "run_started":
      return presence("quiet", "Scheduled a game", "at");
    case "new_court":
      return presence("quiet", "Added a court", "at");
    case "visit": {
      const duration = formatDurationMinutes(item.visit?.durationMinutes ?? null);
      const text = court ? `${duration} at ${court}` : duration;
      return {
        kind: "line",
        marker: "quiet",
        segments: [{ text, tone: "text", shrink: true }],
        accessibilityLabel: `Visit, ${text}`,
      };
    }
    case "checkin_burst": {
      const names = item.burst?.playerNames ?? [];
      const count = item.burst?.count ?? names.length;
      const preview =
        names.length > 3
          ? `${names.slice(0, 3).join(", ")} +${names.length - 3}`
          : names.join(", ");
      return {
        kind: "line",
        marker: "checkin",
        segments: [
          { text: `${count} people checked in`, tone: "name" },
          { text: preview ? `· ${preview}` : "", tone: "text", shrink: true },
          { text: `· ${clock}`, tone: "time" },
        ],
        expandedText: names.join(", "),
        accessibilityLabel: `${count} people checked in, ${clock}`,
      };
    }
    default: {
      // run_result and anything new: name, then what they did.
      const escaped = actor.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const stripped = item.message
        .trim()
        .replace(new RegExp(`^${escaped}\\s*`, "i"), "")
        .toLowerCase();
      return {
        kind: "line",
        marker: "quiet",
        segments: [
          { text: actor, tone: "name", shrink: true, actor: true },
          { text: stripped || "shared an update", tone: "text" },
          { text: `· ${clock}`, tone: "time" },
        ],
        accessibilityLabel: `${actor} ${stripped}, ${clock}`,
      };
    }
  }
}
