import { CourtSport, MatchResult } from "@/constants/data";
import { supabase } from "@/lib/supabase";

import { SupabaseProfile } from "./profileService";

// ─── Types ──────────────────────────────────────────────────────────────────

interface SupabaseGame {
  id: string;
  court_id: string;
  created_by: string;
  played_at: string;
  score_a: number;
  score_b: number;
  winner_side: "a" | "b" | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  courts?: { name: string; sport_type: string } | null;
  game_participants?: Array<{
    user_id: string;
    team_side: "a" | "b";
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

function mapGameToMatchResult(row: SupabaseGame, currentUserId?: string): MatchResult {
  // Perspective: when we know the viewer, report THEIR side's score first —
  // a side-b player's own score is score_b, not score_a. Without a viewer
  // (court/recent lists), fall back to side a as the reference.
  const viewerSide: "a" | "b" =
    currentUserId != null &&
    row.game_participants?.some((p) => p.user_id === currentUserId && p.team_side === "b")
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

const GAME_SELECT = "*, courts(name, sport_type), game_participants(user_id, team_side, profiles(*))";

/** Fetch the game ids a user participated in, newest-capable ordering left to callers. */
async function fetchParticipantGameIds(userId: string): Promise<string[]> {
  const { data, error } = await supabase
    .from("game_participants")
    .select("game_id")
    .eq("user_id", userId);
  if (error || !data) {
    if (error) console.warn("fetchParticipantGameIds failed", error.message);
    return [];
  }
  return (data as Array<{ game_id: string }>).map((r) => r.game_id);
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
  // The RPC does not validate score/winner consistency, so bad input here
  // would corrupt games, win/loss counts, and Elo. Reject it client-side:
  // scores must be non-negative integers and ties are not loggable.
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
  // The log_game RPC atomically inserts the game + participants, computes the
  // real Elo update for both players, and posts the feed entry. It derives the
  // caller from auth.uid(), so payload.createdBy is not sent.
  const winner: "a" | "b" = myScore > theirScore ? "a" : "b";
  const { error } = await supabase.rpc("log_game", {
    p_court_id: payload.courtId,
    p_opponent_id: payload.opponentId,
    p_my_side: "a",
    p_score_a: myScore,
    p_score_b: theirScore,
    p_winner_side: winner,
    p_notes: payload.note?.trim() ? payload.note.trim() : null,
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
      .from("games")
      .select(GAME_SELECT)
      .eq("court_id", courtId)
      .order("played_at", { ascending: false })
      .limit(50);
    if (error || !data) return [];
    return (data as unknown as SupabaseGame[]).map((g) => mapGameToMatchResult(g));
  } catch {
    return [];
  }
}

export async function fetchGamesByPlayer(userId: string): Promise<MatchResult[]> {
  try {
    const gameIds = await fetchParticipantGameIds(userId);
    if (gameIds.length === 0) return [];
    const { data, error } = await supabase
      .from("games")
      .select(GAME_SELECT)
      .in("id", gameIds)
      .order("played_at", { ascending: false })
      .limit(50);
    if (error || !data) {
      if (error) console.warn("fetchGamesByPlayer failed", error.message);
      return [];
    }
    return (data as unknown as SupabaseGame[]).map((g) => mapGameToMatchResult(g, userId));
  } catch {
    return [];
  }
}

/** Games where both users participated, mapped from currentUserId's perspective. */
export async function fetchHeadToHeadGames(
  currentUserId: string,
  opponentId: string
): Promise<MatchResult[]> {
  try {
    const [myGameIds, theirGameIds] = await Promise.all([
      fetchParticipantGameIds(currentUserId),
      fetchParticipantGameIds(opponentId),
    ]);
    const theirs = new Set(theirGameIds);
    const shared = myGameIds.filter((id) => theirs.has(id));
    if (shared.length === 0) return [];
    const { data, error } = await supabase
      .from("games")
      .select(GAME_SELECT)
      .in("id", shared)
      .order("played_at", { ascending: false })
      .limit(50);
    if (error || !data) {
      if (error) console.warn("fetchHeadToHeadGames failed", error.message);
      return [];
    }
    return (data as unknown as SupabaseGame[]).map((g) => mapGameToMatchResult(g, currentUserId));
  } catch {
    return [];
  }
}

export async function fetchRecentGames(limit = 20): Promise<MatchResult[]> {
  try {
    const { data, error } = await supabase
      .from("games")
      .select(GAME_SELECT)
      .order("played_at", { ascending: false })
      .limit(limit);
    if (error || !data) return [];
    return (data as unknown as SupabaseGame[]).map((g) => mapGameToMatchResult(g));
  } catch {
    return [];
  }
}
