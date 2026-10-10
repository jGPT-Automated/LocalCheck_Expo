/**
 * Hide score (D30, revised by D40): any player can hide the score of a game.
 * Once one of them does, everyone sees only W / L, the players included, on
 * every screen (feed, profiles, the game itself). The game still counts.
 *
 * One exception: while the game is still in review, its own players need the
 * numbers to approve or dispute it.
 */
export function scoresHiddenFor(
  participants: Array<{ userId: string; hideScore?: boolean | null }>,
  viewerId: string | null | undefined,
  status: string = "confirmed",
): boolean {
  if (!participants.some((p) => p.hideScore)) return false;
  const inReview = status === "pending" || status === "held" || status === "draft";
  if (inReview && participants.some((p) => p.userId === viewerId)) return false;
  return true;
}
