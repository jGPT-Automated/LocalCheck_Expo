export type LeaderboardScope = "LOCAL" | "REGIONAL" | "GLOBAL";
export type LeaderboardSport = "BASKETBALL" | "PICKLEBALL";

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
