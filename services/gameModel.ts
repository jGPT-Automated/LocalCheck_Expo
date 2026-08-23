export interface MatchSideParticipant {
  user_id: string;
  side: "a" | "b";
}

export function areOpponentsInMatch(
  participants: MatchSideParticipant[] | null | undefined,
  firstUserId: string,
  secondUserId: string,
): boolean {
  const first = participants?.find((participant) => participant.user_id === firstUserId);
  const second = participants?.find((participant) => participant.user_id === secondUserId);
  return Boolean(first && second && first.side !== second.side);
}
