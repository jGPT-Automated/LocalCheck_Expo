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

/**
 * PostgREST can serialize a composite RPC return as either a row or a
 * one-row array. Normalize both so callers never construct `/match/undefined`.
 */
export function extractRpcMatchId(value: unknown): string | undefined {
  const row = Array.isArray(value) ? value[0] : value;
  if (!row || typeof row !== "object") return undefined;
  const id = (row as { id?: unknown }).id;
  return typeof id === "string" && id.length > 0 ? id : undefined;
}
