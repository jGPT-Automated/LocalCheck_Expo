export interface ActivityLikeIdentity {
  user_id: string;
}

export function formatLegacyFeedResult(match: {
  sideA: Array<{ name: string }>;
  sideB: Array<{ name: string }>;
  scoreA: number;
  scoreB: number;
  winnerSide: "a" | "b";
}): string {
  const formatSide = (side: Array<{ name: string }>) =>
    side.map((participant) => participant.name.trim()).filter(Boolean).join(" + ") || "SIDE TBD";
  const winner = match.winnerSide === "a" ? match.sideA : match.sideB;
  const loser = match.winnerSide === "a" ? match.sideB : match.sideA;
  const winnerScore = match.winnerSide === "a" ? match.scoreA : match.scoreB;
  const loserScore = match.winnerSide === "a" ? match.scoreB : match.scoreA;
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
