export type LeaderboardScope = "LOCAL" | "REGIONAL" | "GLOBAL";
export type LeaderboardSport = "BASKETBALL" | "PICKLEBALL";

export const LEADERBOARD_COURT_PAGE_SIZE = 500;
export const LEADERBOARD_ID_CHUNK_SIZE = 100;

export function canLoadLeaderboardScope(
  scope: LeaderboardScope,
  homeCourtId: string | null,
): boolean {
  return scope === "GLOBAL" || Boolean(homeCourtId);
}

/**
 * A saved preferred sport is authoritative. Players who have not chosen one
 * inherit the sport of their saved home court. Players with neither value are
 * intentionally absent from sport rankings.
 */
export function buildLeaderboardMembershipFilter(
  sport: LeaderboardSport,
  fallbackCourtIds: string[],
): string {
  const selectedSport = sport.toLowerCase();
  const clauses = [`preferred_sport.eq.${selectedSport}`];

  if (fallbackCourtIds.length > 0) {
    clauses.push(
      `and(preferred_sport.is.null,local_court_id.in.(${fallbackCourtIds.join(",")}))`,
    );
  }

  return clauses.join(",");
}

export function chunkLeaderboardIds(
  ids: string[],
  size = LEADERBOARD_ID_CHUNK_SIZE,
): string[][] {
  if (size < 1) throw new Error("Leaderboard chunk size must be positive");
  const chunks: string[][] = [];
  for (let index = 0; index < ids.length; index += size) {
    chunks.push(ids.slice(index, index + size));
  }
  return chunks;
}
