/**
 * Hide score (D30, revised by D40, D47, then D49): any player in a game can
 * turn on Hide score. The score is hidden once half or more of the game's
 * players have it on: one player in a 1v1, two in a 2v2, three in a 3v3.
 * One player can't hide a team game from everyone on their own.
 *
 * Once hidden:
 *  - everywhere else (feeds, profiles, the game drawer) everyone sees only
 *    W / L, the players included;
 *  - on the game's own page, the players in it still see the numbers, with
 *    the card marked HIDDEN; everyone else sees W / L there too.
 * While the game is still in review its players always see the numbers, since
 * they need them to approve or dispute it. The game still counts.
 */
type HideRow = { userId: string; hideScore?: boolean | null };

/** Half or more of the players turned Hide score on. */
export function isScoreHidden(participants: Array<{ hideScore?: boolean | null }>): boolean {
  if (participants.length === 0) return false;
  const hiders = participants.filter((p) => p.hideScore).length;
  return hiders > 0 && hiders * 2 >= participants.length;
}

/** How many players must turn it on before the score is hidden. */
export function hidersNeeded(playerCount: number): number {
  return Math.max(1, Math.ceil(playerCount / 2));
}

export function scoresHiddenFor(
  participants: HideRow[],
  viewerId: string | null | undefined,
  status: string = "confirmed",
  place: "list" | "gamePage" = "list",
): boolean {
  if (!isScoreHidden(participants)) return false;
  const isPlayer = participants.some((p) => p.userId === viewerId);
  if (!isPlayer) return true;
  if (place === "gamePage") return false;
  const inReview = status === "pending" || status === "held" || status === "draft";
  return !inReview;
}

/** Who hid it, for the HIDDEN banner on the game page. */
export function hiddenByIds(participants: HideRow[]): string[] {
  return participants.filter((p) => p.hideScore).map((p) => p.userId);
}
