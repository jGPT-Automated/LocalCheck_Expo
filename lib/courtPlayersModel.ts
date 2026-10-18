export type PlayersSort = "ranking" | "active" | "newest";

export interface CourtPlayer {
  id: string;
  name: string;
  avatar: string;
  elo: number;
  /** Win-loss in confirmed games at this court. */
  wins: number;
  losses: number;
  /** Most recent check-in here; null if never. */
  lastCheckInAt: string | null;
  /** When they made this their local court; null if unknown. */
  joinedAt: string | null;
  /** Checked in right now. */
  activeNow: boolean;
}

const byName = (a: CourtPlayer, b: CourtPlayer) => a.name.localeCompare(b.name);
const newestFirst = (a: string | null, b: string | null) => (b ?? "").localeCompare(a ?? "");

/** Rank order: rating, then wins here, then name so ties never shuffle. */
function byRank(a: CourtPlayer, b: CourtPlayer): number {
  return b.elo - a.elo || b.wins - a.wins || byName(a, b);
}

/** 1-based rank of every player by rating, whatever the list is sorted by. */
export function rankByElo(players: CourtPlayer[]): Map<string, number> {
  return new Map([...players].sort(byRank).map((player, index) => [player.id, index + 1]));
}

/**
 * The list in the chosen order. Ranking: by rating. Active: checked in now,
 * then latest check-in first, never-checked-in last. Newest: most recently
 * made this their local court first.
 */
export function sortCourtPlayers(players: CourtPlayer[], sort: PlayersSort): CourtPlayer[] {
  const list = [...players];
  if (sort === "ranking") return list.sort(byRank);
  if (sort === "newest") {
    return list.sort((a, b) => newestFirst(a.joinedAt, b.joinedAt) || byName(a, b));
  }
  return list.sort(
    (a, b) =>
      Number(b.activeNow) - Number(a.activeNow) ||
      newestFirst(a.lastCheckInAt, b.lastCheckInAt) ||
      byName(a, b),
  );
}

/** Rating points to climb to the next rank up; null at the top or unranked. */
export function pointsToNextRank(players: CourtPlayer[], id: string): { points: number; rank: number } | null {
  const ranked = [...players].sort(byRank);
  const index = ranked.findIndex((player) => player.id === id);
  if (index <= 0) return null;
  return { points: Math.max(1, ranked[index - 1].elo - ranked[index].elo), rank: index };
}

export function formatRecord(wins: number, losses: number): string {
  return wins + losses === 0 ? "No games here yet" : `${wins}–${losses} at this court`;
}
