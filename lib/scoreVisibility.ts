/**
 * Hide score (D30, revised by D40, then D47): any player in a game can hide
 * its score. Once one of them does:
 *  - everywhere else (feeds, profiles, the game drawer) everyone sees only
 *    W / L, the players included;
 *  - on the game's own page, the players in it still see the numbers, with
 *    the card marked HIDDEN; everyone else sees W / L there too.
 * While the game is still in review its players always see the numbers, since
 * they need them to approve or dispute. The game still counts.
 */
export function scoresHiddenFor(
  participants: Array<{ userId: string; hideScore?: boolean | null }>,
  viewerId: string | null | undefined,
  status: string = "confirmed",
  place: "list" | "gamePage" = "list",
): boolean {
  if (!participants.some((p) => p.hideScore)) return false;
  const isPlayer = participants.some((p) => p.userId === viewerId);
  if (!isPlayer) return true;
  if (place === "gamePage") return false;
  const inReview = status === "pending" || status === "held" || status === "draft";
  return !inReview;
}

/** Who hid it, for the HIDDEN banner on the game page. */
export function hiddenByIds(
  participants: Array<{ userId: string; hideScore?: boolean | null }>,
): string[] {
  return participants.filter((p) => p.hideScore).map((p) => p.userId);
}
