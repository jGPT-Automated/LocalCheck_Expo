export interface ActivityLikeIdentity {
  user_id: string;
}

/**
 * The name a court wears everywhere except its own page and drawer: the short
 * slug ("Rancho"), falling back to the full name when it has none.
 */
export function courtDisplayName(
  court: { name?: string | null; short_name?: string | null } | null | undefined,
): string | undefined {
  const short = court?.short_name?.trim();
  if (short) return short;
  const full = court?.name?.trim();
  return full || undefined;
}

export function formatLegacyFeedResult(match: {
  sideA: Array<{ name: string }>;
  sideB: Array<{ name: string }>;
  scoreA: number;
  scoreB: number;
  winnerSide: "a" | "b";
  scoresHidden?: boolean;
}): string {
  const formatSide = (side: Array<{ name: string }>) =>
    side.map((participant) => participant.name.trim()).filter(Boolean).join(" + ") || "SIDE TBD";
  const winner = match.winnerSide === "a" ? match.sideA : match.sideB;
  const loser = match.winnerSide === "a" ? match.sideB : match.sideA;
  const winnerScore = match.winnerSide === "a" ? match.scoreA : match.scoreB;
  const loserScore = match.winnerSide === "a" ? match.scoreB : match.scoreA;
  if (match.scoresHidden) return `${formatSide(winner)} DEF. ${formatSide(loser)}`;
  return `${formatSide(winner)} DEF. ${formatSide(loser)} ${winnerScore}–${loserScore}`;
}

export function summarizeActivityHype(
  likes: ActivityLikeIdentity[] | null | undefined,
  currentUserId?: string | null,
): { hypeCount: number; hypedByCurrentUser: boolean } {
  const visibleLikes = likes ?? [];
  return {
    hypeCount: visibleLikes.length,
    hypedByCurrentUser: Boolean(
      currentUserId && visibleLikes.some((like) => like.user_id === currentUserId),
    ),
  };
}
