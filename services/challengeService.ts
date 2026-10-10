import {
  type Challenge,
  type ChallengeStatus,
  challengeErrorMessage,
} from "@/lib/challengeModel";
import { supabase } from "@/lib/supabase";

import { extractRpcMatchId } from "./gameModel";

type ProfileRow = { id: string; display_name: string | null; username: string | null } | null;

type ChallengeRow = {
  id: string;
  challenger_id: string;
  opponent_id: string;
  court_id: string | null;
  play_on: string | null;
  ranked: boolean;
  status: ChallengeStatus;
  match_id: string | null;
  cancelled_by: string | null;
  created_at: string;
  challenger: ProfileRow;
  opponent: ProfileRow;
  courts: { name: string; short_name: string | null; sport_type: string | null } | null;
};

const SELECT =
  "*, challenger:profiles!challenges_challenger_id_fkey(id, display_name, username), opponent:profiles!challenges_opponent_id_fkey(id, display_name, username), courts(name, short_name, sport_type)";

function playerName(row: ProfileRow): string {
  return row?.display_name || row?.username || "Player";
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  return (parts.length > 1 ? parts[0][0] + parts[1][0] : name.slice(0, 2)).toUpperCase();
}

function mapChallenge(row: ChallengeRow): Challenge {
  const challengerName = playerName(row.challenger);
  const opponentName = playerName(row.opponent);
  const sport = (row.courts?.sport_type ?? "").toUpperCase();
  return {
    id: row.id,
    challenger: { id: row.challenger_id, name: challengerName, initials: initials(challengerName) },
    opponent: { id: row.opponent_id, name: opponentName, initials: initials(opponentName) },
    courtId: row.court_id,
    courtName: row.courts ? row.courts.short_name || row.courts.name : null,
    sport: sport === "BASKETBALL" || sport === "PICKLEBALL" ? sport : null,
    playOn: row.play_on,
    ranked: row.ranked,
    status: row.status,
    matchId: row.match_id,
    cancelledBy: row.cancelled_by,
    createdAt: row.created_at,
  };
}

export type ChallengeResult<T> = { ok: true; value: T } | { ok: false; message: string };

export async function fetchChallenge(id: string): Promise<Challenge | null> {
  const { data, error } = await supabase.from("challenges").select(SELECT).eq("id", id).maybeSingle();
  if (error || !data) {
    if (error) console.warn("fetchChallenge failed", error.message);
    return null;
  }
  return mapChallenge(data as unknown as ChallengeRow);
}

/** Open challenges (pending or accepted) the viewer sent or received, newest first. */
export async function fetchOpenChallenges(userId: string): Promise<Challenge[]> {
  if (!userId) return [];
  const { data, error } = await supabase
    .from("challenges")
    .select(SELECT)
    .or(`challenger_id.eq.${userId},opponent_id.eq.${userId}`)
    .in("status", ["pending", "accepted"])
    .order("created_at", { ascending: false })
    .limit(30);
  if (error || !data) {
    // Before the migration lands the table doesn't exist; the inbox simply
    // shows no challenges.
    if (error && error.code !== "42P01" && error.code !== "PGRST205") {
      console.warn("fetchOpenChallenges failed", error.message);
    }
    return [];
  }
  return (data as unknown as ChallengeRow[]).map(mapChallenge);
}

/** The open challenge between two players, if any (one per pair). */
export async function fetchOpenChallengeWith(userId: string, otherId: string): Promise<Challenge | null> {
  const open = await fetchOpenChallenges(userId);
  return (
    open.find(
      (c) =>
        (c.challenger.id === userId && c.opponent.id === otherId) ||
        (c.opponent.id === userId && c.challenger.id === otherId),
    ) ?? null
  );
}

export async function createChallenge(input: {
  opponentId: string;
  courtId: string | null;
  playOn: string | null;
  ranked: boolean;
}): Promise<ChallengeResult<string>> {
  const { data, error } = await supabase.rpc("create_challenge", {
    p_opponent_id: input.opponentId,
    p_court_id: input.courtId,
    p_play_on: input.playOn,
    p_ranked: input.ranked,
  });
  const id = extractRpcMatchId(data);
  if (error || !id) return { ok: false, message: challengeErrorMessage(error) };
  return { ok: true, value: id };
}

export async function respondToChallenge(id: string, accept: boolean): Promise<ChallengeResult<null>> {
  const { error } = await supabase.rpc("respond_to_challenge", { p_challenge_id: id, p_accept: accept });
  return error ? { ok: false, message: challengeErrorMessage(error) } : { ok: true, value: null };
}

/** Close a casual plan after playing (casual challenges have no score). */
export async function finishCasualChallenge(id: string): Promise<ChallengeResult<null>> {
  const { error } = await supabase.rpc("finish_casual_challenge", { p_challenge_id: id });
  return error ? { ok: false, message: challengeErrorMessage(error) } : { ok: true, value: null };
}

export async function cancelChallenge(id: string): Promise<ChallengeResult<null>> {
  const { error } = await supabase.rpc("cancel_challenge", { p_challenge_id: id });
  return error ? { ok: false, message: challengeErrorMessage(error) } : { ok: true, value: null };
}

/** Logs the 1v1 through log_match; returns the new game's id for /match/<id>. */
export async function logChallengeResult(input: {
  challengeId: string;
  myScore: number;
  theirScore: number;
  courtId: string | null;
  playedOn: string | null;
  clientRequestId: string;
}): Promise<ChallengeResult<string>> {
  const { data, error } = await supabase.rpc("log_challenge_result", {
    p_challenge_id: input.challengeId,
    p_my_score: input.myScore,
    p_their_score: input.theirScore,
    p_court_id: input.courtId,
    p_played_on: input.playedOn,
    p_client_request_id: input.clientRequestId,
  });
  const matchId = extractRpcMatchId(data);
  if (error || !matchId) return { ok: false, message: challengeErrorMessage(error) };
  return { ok: true, value: matchId };
}
