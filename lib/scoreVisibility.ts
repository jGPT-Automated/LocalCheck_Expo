/**
 * Hide score (decision D30): each player can hide the score for their side.
 * If any player in the game hid it, people outside the game see only who won.
 * The players themselves always see the numbers.
 */
export function scoresHiddenFor(
  participants: Array<{ userId: string; hideScore?: boolean | null }>,
  viewerId: string | null | undefined,
): boolean {
  if (!participants.some((p) => p.hideScore)) return false;
  return !participants.some((p) => p.userId === viewerId);
}
