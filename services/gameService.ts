import { CourtSport, MatchResult } from "@/constants/data";
import { supabase } from "@/lib/supabase";

import { SupabaseProfile } from "./profileService";
import { areOpponentsInMatch } from "./gameModel";

// ─── Types ──────────────────────────────────────────────────────────────────
// Backend: LocalCheckProd `matches` + `match_participants` (side a/b), written
// via the log_match RPC. (Was `games`/`game_participants`/log_game on the old
// project — renamed here as part of the 2026-07-22 shared-backend swap.)

interface SupabaseMatch {
  id: string;
  court_id: string;
  created_by: string;
  opponent_id: string;
  played_at: string;
  score_a: number;
  score_b: number;
  winner_side: "a" | "b" | null;
  sport: "basketball" | "pickleball";
  status: "pending" | "confirmed" | "rejected";
  run_id?: string | null;
  confirmation_method: "manual" | "automatic" | null;
  review_due_at: string;
  confirmed_at: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  courts?: { name: string; sport_type: string } | null;
  match_participants?: Array<{
    user_id: string;
    side: "a" | "b";
    display_order?: number;
    elo_before?: number | null;
    elo_after?: number | null;
    profiles: SupabaseProfile | null;
  }>;
  match_participant_reviews?: Array<{
    user_id: string;
    decision: "pending" | "approved" | "disputed";
  }>;
}

export interface MatchReviewParticipant {
  id: string;
  name: string;
  side: "a" | "b";
  decision: "pending" | "approved" | "disputed";
  eloBefore?: number;
  eloAfter?: number;
}

export interface MatchReview {
  id: string;
  courtId: string;
  courtName: string;
  createdBy: string;
  opponentId: string;
  creatorName: string;
  opponentName: string;
  sport: CourtSport;
  status: "pending" | "confirmed" | "rejected";
  confirmationMethod: "manual" | "automatic" | null;
  playedAt: string;
  reviewDueAt: string;
  scoreA: number;
  scoreB: number;
  runId?: string;
  participants: MatchReviewParticipant[];
}

function normalizeSport(raw: string | null | undefined): CourtSport {
  const upper = (raw ?? "").toUpperCase();
  const valid: CourtSport[] = ["BASKETBALL", "PICKLEBALL", "TENNIS", "SOCCER", "VOLLEYBALL"];
  return valid.includes(upper as CourtSport) ? (upper as CourtSport) : "BASKETBALL";
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" }).toUpperCase();
}

function mapMatchToResult(row: SupabaseMatch, currentUserId?: string): MatchResult {
  // Perspective: when we know the viewer, report THEIR side's score first —
  // a side-b player's own score is score_b, not score_a. Without a viewer
  // (court/recent lists), fall back to side a as the reference.
  const viewerSide: "a" | "b" =
    currentUserId != null &&
    row.match_participants?.some((p) => p.user_id === currentUserId && p.side === "b")
      ? "b"
      : "a";
  const won = row.winner_side === viewerSide;
  const sport = normalizeSport(row.courts?.sport_type);
  const myScore = viewerSide === "a" ? row.score_a : row.score_b;
  const theirScore = viewerSide === "a" ? row.score_b : row.score_a;
  return {
    id: row.id,
    date: formatDate(row.played_at),
    playedAtIso: row.played_at,
    courtName: row.courts?.name?.toUpperCase() ?? "UNKNOWN",
    sport,
    result: won ? "WIN" : "LOSS",
    teamScore: String(myScore ?? 0),
    opposingScore: String(theirScore ?? 0),
  };
}

const MATCH_SELECT = "*, courts(name, sport_type), match_participants(user_id, side, profiles(*))";

/** Fetch the match ids a user participated in. */
async function fetchParticipantMatchIds(userId: string): Promise<string[]> {
  const { data, error } = await supabase
    .from("match_participants")
    .select("match_id")
    .eq("user_id", userId);
  if (error || !data) {
    if (error) console.warn("fetchParticipantMatchIds failed", error.message);
    return [];
  }
  return (data as Array<{ match_id: string }>).map((r) => r.match_id);
}

// ─── Public API ─────────────────────────────────────────────────────────────

export async function logGame(payload: {
  courtId: string;
  createdBy: string;
  myScore: number;
  theirScore: number;
  opponentId: string;
  sport: CourtSport;
  note?: string;
  clientRequestId?: string;
}): Promise<{ ok: boolean; matchId?: string }> {
  // log_match validates scores/ties server-side, but reject obviously bad
  // input client-side too for a fast, clear failure.
  const { myScore, theirScore } = payload;
  if (
    !Number.isInteger(myScore) ||
    !Number.isInteger(theirScore) ||
    myScore < 0 ||
    theirScore < 0 ||
    myScore === theirScore
  ) {
    console.warn("logGame rejected invalid scores", myScore, theirScore);
    return { ok: false };
  }
  // log_match atomically inserts the pending score and both participants.
  // Elo changes only after the named opponent confirms the score.
  const { data, error } = await supabase.rpc("log_match", {
    p_court_id: payload.courtId,
    p_opponent_id: payload.opponentId,
    p_my_score: myScore,
    p_opponent_score: theirScore,
    p_notes: payload.note?.trim() ? payload.note.trim() : null,
    p_visibility: "public",
    p_client_request_id: payload.clientRequestId ?? null,
  });
  if (error) {
    console.warn("logGame failed", error.message);
    return { ok: false };
  }
  return { ok: true, matchId: (data as { id?: string } | null)?.id };
}

export async function logScheduledGameResult(payload: {
  runId: string;
  teamAIds: string[];
  teamBIds: string[];
  scoreA: number;
  scoreB: number;
}): Promise<{ ok: boolean; matchId?: string; error?: string }> {
  if (
    payload.teamAIds.length === 0 ||
    payload.teamAIds.length !== payload.teamBIds.length ||
    !Number.isInteger(payload.scoreA) ||
    !Number.isInteger(payload.scoreB) ||
    payload.scoreA < 0 ||
    payload.scoreB < 0 ||
    payload.scoreA === payload.scoreB
  ) {
    return { ok: false, error: "Complete both teams and enter a non-tied score." };
  }

  const { data, error } = await supabase.rpc("log_run_match", {
    p_run_id: payload.runId,
    p_team_a_ids: payload.teamAIds,
    p_team_b_ids: payload.teamBIds,
    p_score_a: payload.scoreA,
    p_score_b: payload.scoreB,
  });
  if (error) {
    console.warn("logScheduledGameResult failed", error.message);
    return { ok: false, error: "The scheduled-result backend is not available yet." };
  }
  return { ok: true, matchId: (data as { id?: string } | null)?.id };
}

export async function fetchGamesByCourt(courtId: string): Promise<MatchResult[]> {
  try {
    const { data, error } = await supabase
      .from("matches")
      .select(MATCH_SELECT)
      .eq("court_id", courtId)
      .eq("status", "confirmed")
      .order("played_at", { ascending: false })
      .limit(50);
    if (error || !data) return [];
    return (data as unknown as SupabaseMatch[]).map((g) => mapMatchToResult(g));
  } catch {
    return [];
  }
}

export async function fetchGamesByPlayer(userId: string): Promise<MatchResult[]> {
  try {
    const matchIds = await fetchParticipantMatchIds(userId);
    if (matchIds.length === 0) return [];
    const { data, error } = await supabase
      .from("matches")
      .select(MATCH_SELECT)
      .in("id", matchIds)
      .eq("status", "confirmed")
      .order("played_at", { ascending: false })
      .limit(50);
    if (error || !data) {
      if (error) console.warn("fetchGamesByPlayer failed", error.message);
      return [];
    }
    return (data as unknown as SupabaseMatch[]).map((g) => mapMatchToResult(g, userId));
  } catch {
    return [];
  }
}

/** Matches where both users participated, mapped from currentUserId's perspective. */
export async function fetchHeadToHeadGames(
  currentUserId: string,
  opponentId: string
): Promise<MatchResult[]> {
  try {
    const [myIds, theirIds] = await Promise.all([
      fetchParticipantMatchIds(currentUserId),
      fetchParticipantMatchIds(opponentId),
    ]);
    const theirs = new Set(theirIds);
    const shared = myIds.filter((id) => theirs.has(id));
    if (shared.length === 0) return [];
    const { data, error } = await supabase
      .from("matches")
      .select(MATCH_SELECT)
      .in("id", shared)
      .eq("status", "confirmed")
      .order("played_at", { ascending: false })
      .limit(50);
    if (error || !data) {
      if (error) console.warn("fetchHeadToHeadGames failed", error.message);
      return [];
    }
    return (data as unknown as SupabaseMatch[])
      .filter((game) => areOpponentsInMatch(game.match_participants, currentUserId, opponentId))
      .map((game) => mapMatchToResult(game, currentUserId));
  } catch {
    return [];
  }
}

export async function fetchRecentGames(limit = 20): Promise<MatchResult[]> {
  try {
    const { data, error } = await supabase
      .from("matches")
      .select(MATCH_SELECT)
      .eq("status", "confirmed")
      .order("played_at", { ascending: false })
      .limit(limit);
    if (error || !data) return [];
    return (data as unknown as SupabaseMatch[]).map((g) => mapMatchToResult(g));
  } catch {
    return [];
  }
}

export async function fetchMatchReview(matchId: string): Promise<MatchReview | null> {
  const enhanced = await supabase
    .from("matches")
    .select("*, courts(name,sport_type), creator:profiles!matches_created_by_fkey(display_name,username), opponent:profiles!matches_opponent_id_fkey(display_name,username), match_participants(user_id,side,display_order,elo_before,elo_after,profiles(*)), match_participant_reviews(user_id,decision)")
    .eq("id", matchId)
    .maybeSingle();
  const fallback = enhanced.error
    ? await supabase
        .from("matches")
        .select("*, courts(name,sport_type), creator:profiles!matches_created_by_fkey(display_name,username), opponent:profiles!matches_opponent_id_fkey(display_name,username), match_participants(user_id,side,profiles(*))")
        .eq("id", matchId)
        .maybeSingle()
    : null;
  const data = enhanced.data ?? fallback?.data;
  const error = enhanced.data ? null : fallback?.error ?? enhanced.error;
  if (error || !data) {
    if (error) console.warn("fetchMatchReview failed", error.message);
    return null;
  }
  const row = data as unknown as SupabaseMatch & {
    creator?: { display_name: string | null; username: string | null } | null;
    opponent?: { display_name: string | null; username: string | null } | null;
  };
  const decisions = new Map(
    (row.match_participant_reviews ?? []).map((review) => [review.user_id, review.decision]),
  );
  const participants = (row.match_participants ?? [])
    .slice()
    .sort((a, b) => (a.side === b.side ? (a.display_order ?? 0) - (b.display_order ?? 0) : a.side.localeCompare(b.side)))
    .map((participant) => ({
      id: participant.user_id,
      name: participant.profiles?.display_name || participant.profiles?.username || "Player",
      side: participant.side,
      decision: decisions.get(participant.user_id) ?? "pending",
      eloBefore: participant.elo_before ?? undefined,
      eloAfter: participant.elo_after ?? undefined,
    }));
  return {
    id: row.id,
    courtId: row.court_id,
    courtName: row.courts?.name ?? "Unknown Court",
    createdBy: row.created_by,
    opponentId: row.opponent_id,
    creatorName: row.creator?.display_name || row.creator?.username || "Player",
    opponentName: row.opponent?.display_name || row.opponent?.username || "Player",
    sport: normalizeSport(row.sport ?? row.courts?.sport_type),
    status: row.status,
    confirmationMethod: row.confirmation_method,
    playedAt: row.played_at,
    reviewDueAt: row.review_due_at,
    scoreA: row.score_a,
    scoreB: row.score_b,
    runId: row.run_id ?? undefined,
    participants,
  };
}

export async function reviewScheduledMatch(
  matchId: string,
  decision: "pending" | "approved" | "disputed",
): Promise<boolean> {
  const { error } = await supabase.rpc("review_run_match", {
    p_match_id: matchId,
    p_decision: decision,
  });
  if (error) {
    console.warn("reviewScheduledMatch failed", error.message);
    return false;
  }
  return true;
}

export async function confirmMatch(matchId: string): Promise<boolean> {
  const { error } = await supabase.rpc("confirm_match", { p_match_id: matchId });
  if (error) {
    console.warn("confirmMatch failed", error.message);
    return false;
  }
  return true;
}

export async function rejectMatch(matchId: string): Promise<boolean> {
  const { error } = await supabase.rpc("reject_match", { p_match_id: matchId });
  if (error) {
    console.warn("rejectMatch failed", error.message);
    return false;
  }
  return true;
}
