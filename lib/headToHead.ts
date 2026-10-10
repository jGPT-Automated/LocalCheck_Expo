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
  hideScore?: boolean | null;
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
  /** A player hid this game's score (D40): show W / L, never the numbers. */
  scoresHidden: boolean;
};

export type HeadToHeadSummary = {
  games: number;
  myWins: number;
  theirWins: number;
  leader: "you" | "them" | "even";
  /** Average of (my score - their score) over games whose score is shown;
   *  null when there are none. */
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
    scoresHidden: game.participants.some((p) => p.hideScore),
  };
}

export function summarizeHeadToHead(games: HeadToHeadGame[]): HeadToHeadSummary {
  const myWins = games.filter((g) => g.won).length;
  const theirWins = games.length - myWins;
  // Hidden scores stay hidden in the average too.
  const margins = games.filter((g) => !g.scoresHidden).map((g) => g.myScore - g.theirScore);
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

/**
 * The series status above the records, split so a long opponent name can
 * truncate on its own: { name: "MARCUS", text: "LEADS 3–1" }, { text: "YOU LEAD
 * 3–1" }, { text: "TIED 2–2" }, { text: "FIRST GAME" }. The leader's record
 * comes first.
 */
export function seriesStatus(
  summary: HeadToHeadSummary,
  opponentName: string,
): { name?: string; text: string } {
  if (summary.games === 0) return { text: "FIRST GAME" };
  if (summary.leader === "you") {
    return { text: `YOU LEAD ${summary.myWins}–${summary.theirWins}` };
  }
  if (summary.leader === "them") {
    return {
      name: firstName(opponentName).toUpperCase(),
      text: `LEADS ${summary.theirWins}–${summary.myWins}`,
    };
  }
  return { text: `TIED ${summary.myWins}–${summary.theirWins}` };
}

/** "YOU LEAD 3–1", "JESSE LEADS 3–1", "TIED 2–2", "FIRST GAME". */
export function seriesHeadline(summary: HeadToHeadSummary, opponentName: string): string {
  const { name, text } = seriesStatus(summary, opponentName);
  return name ? `${name} ${text}` : text;
}

/** Signed number with one decimal at most: +3.7, -2, 0. */
export function signed(value: number): string {
  const rounded = Math.round(value * 10) / 10;
  const text = Number.isInteger(rounded) ? String(Math.abs(rounded)) : Math.abs(rounded).toFixed(1);
  if (rounded > 0) return `+${text}`;
  if (rounded < 0) return `-${text}`;
  return "0";
}

/** "1v1", "3v3". Ranked is the default, so it is never spelled out. */
export function teamFormat(teamSize: number): string {
  const size = Math.max(1, teamSize);
  return `${size}v${size}`;
}

/** "1v1", or "3v3 · Casual" when the game did not count. */
export function gameFormatLabel(game: Pick<HeadToHeadGame, "teamSize" | "ranked">): string {
  return game.ranked ? teamFormat(game.teamSize) : `${teamFormat(game.teamSize)} · Casual`;
}

/** "2v2 at Rancho": the row title. */
export function gameTitle(game: Pick<HeadToHeadGame, "teamSize" | "courtName">): string {
  const court = game.courtName.trim();
  return court ? `${teamFormat(game.teamSize)} at ${court}` : teamFormat(game.teamSize);
}

/** "vs Jesse" or "with Marcus · vs Jesse, Ben". */
export function teamsLine(game: Pick<HeadToHeadGame, "teammates" | "opponents">): string {
  const against = `vs ${game.opponents.join(", ")}`;
  return game.teammates.length > 0 ? `with ${game.teammates.join(", ")} · ${against}` : against;
}
