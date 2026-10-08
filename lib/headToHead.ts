/**
 * Head-to-head between the viewer and another player, built from confirmed
 * games where the two were on opposite sides (1v1 or team games).
 * Pure so it can be tested without Supabase.
 */

export type HeadToHeadParticipant = {
  userId: string;
  side: "a" | "b";
  name: string;
  displayOrder?: number | null;
  eloBefore?: number | null;
  eloAfter?: number | null;
};

export type HeadToHeadSourceGame = {
  id: string;
  playedAtIso: string;
  courtName: string;
  scoreA: number;
  scoreB: number;
  winnerSide: "a" | "b" | null;
  teamSize: number;
  /** Absent on rows logged before casual games existed: those were ranked. */
  ranked?: boolean | null;
  participants: HeadToHeadParticipant[];
};

export type HeadToHeadGame = {
  id: string;
  playedAtIso: string;
  courtName: string;
  teamSize: number;
  ranked: boolean;
  won: boolean;
  myScore: number;
  theirScore: number;
  /** Viewer's ELO change in this game; null when not recorded or casual. */
  myEloDelta: number | null;
  /** Viewer's teammates (not the viewer), first names. */
  teammates: string[];
  /** The other side, first names, in roster order. */
  opponents: string[];
};

export type HeadToHeadSummary = {
  games: number;
  myWins: number;
  theirWins: number;
  leader: "you" | "them" | "even";
  /** Average of (my score - their score); null with no games. */
  avgMargin: number | null;
  /** Sum of the viewer's ELO changes in these games; null when none recorded. */
  eloNet: number | null;
  lastPlayedIso: string | null;
};

export function firstName(name: string): string {
  return name.trim().split(/\s+/)[0] || name;
}

export function toHeadToHeadGame(
  game: HeadToHeadSourceGame,
  viewerId: string,
): HeadToHeadGame | null {
  const me = game.participants.find((p) => p.userId === viewerId);
  if (!me) return null;
  const ordered = [...game.participants].sort(
    (a, b) => (a.displayOrder ?? 0) - (b.displayOrder ?? 0),
  );
  const mine = me.side === "a" ? game.scoreA : game.scoreB;
  const theirs = me.side === "a" ? game.scoreB : game.scoreA;
  const ranked = game.ranked !== false;
  const delta =
    ranked && me.eloBefore != null && me.eloAfter != null
      ? me.eloAfter - me.eloBefore
      : null;
  return {
    id: game.id,
    playedAtIso: game.playedAtIso,
    courtName: game.courtName,
    teamSize: Math.max(1, game.teamSize || 1),
    ranked,
    won: game.winnerSide === me.side,
    myScore: mine,
    theirScore: theirs,
    myEloDelta: delta,
    teammates: ordered
      .filter((p) => p.side === me.side && p.userId !== viewerId)
      .map((p) => firstName(p.name)),
    opponents: ordered.filter((p) => p.side !== me.side).map((p) => firstName(p.name)),
  };
}

export function summarizeHeadToHead(games: HeadToHeadGame[]): HeadToHeadSummary {
  const myWins = games.filter((g) => g.won).length;
  const theirWins = games.length - myWins;
  const margins = games.map((g) => g.myScore - g.theirScore);
  const deltas = games
    .map((g) => g.myEloDelta)
    .filter((d): d is number => d != null);
  const latest = games.reduce<string | null>(
    (acc, g) => (acc == null || g.playedAtIso > acc ? g.playedAtIso : acc),
    null,
  );
  return {
    games: games.length,
    myWins,
    theirWins,
    leader: myWins > theirWins ? "you" : theirWins > myWins ? "them" : "even",
    avgMargin:
      margins.length > 0
        ? Math.round((margins.reduce((a, b) => a + b, 0) / margins.length) * 10) / 10
        : null,
    eloNet: deltas.length > 0 ? deltas.reduce((a, b) => a + b, 0) : null,
    lastPlayedIso: latest,
  };
}

/** "SERIES / YOU LEAD", "SERIES / JESSE LEADS", "SERIES / TIED". */
export function seriesHeadline(summary: HeadToHeadSummary, opponentName: string): string {
  if (summary.games === 0) return "FIRST GAME";
  if (summary.leader === "you") return "YOU LEAD";
  if (summary.leader === "them") return `${firstName(opponentName).toUpperCase()} LEADS`;
  return "TIED";
}

/** Signed number with one decimal at most: +3.7, -2, 0. */
export function signed(value: number): string {
  const rounded = Math.round(value * 10) / 10;
  const text = Number.isInteger(rounded) ? String(Math.abs(rounded)) : Math.abs(rounded).toFixed(1);
  if (rounded > 0) return `+${text}`;
  if (rounded < 0) return `-${text}`;
  return "0";
}

/** "1v1 · Ranked", "3v3 · Casual". */
export function gameFormatLabel(game: Pick<HeadToHeadGame, "teamSize" | "ranked">): string {
  return `${game.teamSize}v${game.teamSize} · ${game.ranked ? "Ranked" : "Casual"}`;
}

/** "Just you two" or "You, Marcus, Avery vs Jesse, RC2, Ben". */
export function teamsLine(game: Pick<HeadToHeadGame, "teammates" | "opponents" | "teamSize">): string {
  if (game.teamSize <= 1 && game.teammates.length === 0) return "Just you two";
  return `${["You", ...game.teammates].join(", ")} vs ${game.opponents.join(", ")}`;
}
