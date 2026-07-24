import { CourtSport, MatchResult } from "@/constants/data";
import { supabase } from "@/lib/supabase";

import { SupabaseProfile } from "./profileService";

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
  notes: string | null;
  created_at: string;
  updated_at: string;
  courts?: { name: string; sport_type: string } | null;
  match_participants?: Array<{
    user_id: string;
    side: "a" | "b";
    profiles: SupabaseProfile | null;
  }>;
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
}): Promise<boolean> {
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
    return false;
  }
  // log_match atomically inserts the match + both participants, computes the
  // Elo update, and posts the match_result activity_event. Caller derived from
  // auth.uid(); winner is computed server-side from the scores.
  const { error } = await supabase.rpc("log_match", {
    p_court_id: payload.courtId,
    p_opponent_id: payload.opponentId,
    p_my_score: myScore,
    p_opponent_score: theirScore,
    p_notes: payload.note?.trim() ? payload.note.trim() : null,
    p_visibility: "public",
  });
  if (error) {
    console.warn("logGame failed", error.message);
    return false;
  }
  return true;
}

export async function fetchGamesByCourt(courtId: string): Promise<MatchResult[]> {
  try {
    const { data, error } = await supabase
      .from("matches")
      .select(MATCH_SELECT)
      .eq("court_id", courtId)
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
      .order("played_at", { ascending: false })
      .limit(50);
    if (error || !data) {
      if (error) console.warn("fetchHeadToHeadGames failed", error.message);
      return [];
    }
    return (data as unknown as SupabaseMatch[]).map((g) => mapMatchToResult(g, currentUserId));
  } catch {
    return [];
  }
}

export async function fetchRecentGames(limit = 20): Promise<MatchResult[]> {
  try {
    const { data, error } = await supabase
      .from("matches")
      .select(MATCH_SELECT)
      .order("played_at", { ascending: false })
      .limit(limit);
    if (error || !data) return [];
    return (data as unknown as SupabaseMatch[]).map((g) => mapMatchToResult(g));
  } catch {
    return [];
  }
}
