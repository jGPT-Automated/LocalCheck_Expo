/**
 * Game activity (D47): everything that happened to one game, oldest first,
 * built only from timestamps the database keeps. Person first, then the
 * action: "Jesse approved". Rows without a time (who we're still waiting on)
 * come last.
 */

export type GameActivityKind =
  | "played"
  | "logged"
  | "approved"
  | "disputed"
  | "revised"
  | "final"
  | "voided"
  | "waiting";

export interface GameActivityEvent {
  key: string;
  kind: GameActivityKind;
  /** ISO time, or undefined for a row that hasn't happened yet. */
  at?: string;
  /** Bold lead: a player's name or a fixed word ("Played"). */
  lead: string;
  /** Quiet text after the lead ("approved", "· Rancho"). */
  rest: string;
  /** Second line (the dispute note). */
  detail?: string;
}

export interface GameActivityInput {
  status: "pending" | "held" | "confirmed" | "voided";
  courtName: string;
  playedAt: string;
  createdAt?: string;
  updatedAt?: string;
  confirmedAt?: string;
  confirmationMethod: "manual" | "automatic" | null;
  createdBy: string;
  lastSubmittedBy: string;
  revisionNumber: number;
  disputeNote?: string;
  participants: Array<{
    id: string;
    name: string;
    side?: "a" | "b";
    decision: "pending" | "approved" | "disputed";
    decidedAt?: string;
  }>;
}

export function buildGameActivity(
  game: GameActivityInput,
  viewerId?: string | null,
  displayName: (name: string) => string = (name) => name,
): GameActivityEvent[] {
  const nameOf = (id: string) => {
    const player = game.participants.find((p) => p.id === id);
    return player ? displayName(player.name) : "Player";
  };
  const timed: GameActivityEvent[] = [];

  // played_at is a day (stored as noon UTC), not a time: the row shows the
  // day only and always comes first.
  const played: GameActivityEvent = {
    key: "played",
    kind: "played",
    at: game.playedAt,
    lead: "Played",
    rest: `· ${game.courtName}`,
  };
  if (game.createdAt) {
    timed.push({
      key: "logged",
      kind: "logged",
      at: game.createdAt,
      lead: nameOf(game.createdBy),
      rest: "logged",
    });
  }

  let disputeShown = false;
  for (const player of game.participants) {
    if (!player.decidedAt || player.decision === "pending") continue;
    const disputed = player.decision === "disputed";
    timed.push({
      key: `decision-${player.id}`,
      kind: disputed ? "disputed" : "approved",
      at: player.decidedAt,
      lead: nameOf(player.id),
      rest: disputed ? "disputed" : "approved",
      detail: disputed && !disputeShown ? game.disputeNote : undefined,
    });
    if (disputed) disputeShown = true;
  }

  // A correction made during a hold, by someone who isn't the disputer.
  const reviser = game.participants.find((p) => p.id === game.lastSubmittedBy);
  if (
    game.revisionNumber > 0 &&
    game.updatedAt &&
    reviser &&
    reviser.decision !== "disputed"
  ) {
    timed.push({
      key: "revised",
      kind: "revised",
      at: game.updatedAt,
      lead: nameOf(reviser.id),
      rest: "revised",
      detail: !disputeShown ? game.disputeNote : undefined,
    });
  }

  // A manual approval already reads as the end; only say so when the clock
  // ran out.
  if (game.status === "confirmed" && game.confirmedAt && game.confirmationMethod === "automatic") {
    timed.push({
      key: "final",
      kind: "final",
      at: game.confirmedAt,
      lead: "Auto-approved",
      rest: "",
    });
  }
  if (game.status === "voided" && game.updatedAt) {
    timed.push({ key: "voided", kind: "voided", at: game.updatedAt, lead: "Voided", rest: "" });
  }

  timed.sort((a, b) => Date.parse(a.at ?? "") - Date.parse(b.at ?? ""));

  // Only the other side can approve, so only they are waited on.
  const submitterSide = game.participants.find((p) => p.id === game.lastSubmittedBy)?.side;
  const waiting: GameActivityEvent[] =
    game.status === "pending"
      ? game.participants
          .filter(
            (p) =>
              p.decision === "pending" &&
              p.id !== game.lastSubmittedBy &&
              (!submitterSide || !p.side || p.side !== submitterSide),
          )
          .map((p) => ({
            key: `waiting-${p.id}`,
            kind: "waiting" as const,
            lead: viewerId && p.id === viewerId ? "Waiting on you" : `Waiting on ${displayName(p.name)}`,
            rest: "",
          }))
      : [];

  return [played, ...timed, ...waiting];
}

/**
 * Played is a bare day ("2026-10-16"); read it as local midnight, not UTC
 * (same rule as parseDayOrInstant in lib/activityPresentation.ts; lib files
 * stay import-free so the node tests can load them directly).
 */
function parseDayOrInstant(value: string): Date {
  const day = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  return day ? new Date(Number(day[1]), Number(day[2]) - 1, Number(day[3])) : new Date(value);
}

/** "OCT 8" the first time a day appears in the list, otherwise null. */
export function activityDayLabels(
  events: GameActivityEvent[],
  now: Date = new Date(),
): Array<string | null> {
  let lastDay = "";
  return events.map((event) => {
    if (!event.at) return null;
    const date = parseDayOrInstant(event.at);
    if (Number.isNaN(date.getTime())) return null;
    const day = date.toDateString();
    if (day === lastDay) return null;
    lastDay = day;
    const today = now.toDateString();
    const yesterday = new Date(now.getTime() - 86_400_000).toDateString();
    if (day === today) return "TODAY";
    if (day === yesterday) return "YESTERDAY";
    return date
      .toLocaleDateString("en-US", { month: "short", day: "numeric" })
      .toUpperCase();
  });
}

/** "6:12 PM"; nothing for the Played row (a day, not a time). */
export function activityTime(at?: string, kind?: GameActivityKind): string {
  if (!at || kind === "played") return "";
  const date = new Date(at);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
}
