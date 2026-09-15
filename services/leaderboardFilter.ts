export type LeaderboardScope = "FRIENDS" | "LOCAL" | "REGIONAL" | "GLOBAL";
export type LeaderboardSport = "BASKETBALL" | "PICKLEBALL";

export const LEADERBOARD_COURT_PAGE_SIZE = 500;
export const LEADERBOARD_ID_CHUNK_SIZE = 100;

// LOCAL has nothing to scope to without a home court. REGIONAL no longer
// needs one either — with no anchor it falls back to the unscoped
// (GLOBAL-equivalent) board rather than returning nothing, so it's loadable
// the same as FRIENDS/GLOBAL.
export function canLoadLeaderboardScope(
  scope: LeaderboardScope,
  homeCourtId: string | null,
): boolean {
  return scope !== "LOCAL" || Boolean(homeCourtId);
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
