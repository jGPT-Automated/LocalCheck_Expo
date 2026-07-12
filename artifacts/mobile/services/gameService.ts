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
  const isOnTeamA = row.game_participants?.some((p) => p.user_id === currentUserId && p.team_side === "a");
  const won = row.winner_side === (isOnTeamA ? "a" : "b");
  const sport = normalizeSport(row.courts?.sport_type);
  return {
    id: row.id,
    date: formatDate(row.played_at),
    courtName: row.courts?.name?.toUpperCase() ?? "UNKNOWN",
    sport,
    result: won ? "WIN" : "LOSS",
    teamScore: String(row.score_a ?? 0),
    opposingScore: String(row.score_b ?? 0),
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
}): Promise<void> {
  // The log_game RPC atomically inserts the game + participants, computes the
  // real Elo update for both players, and posts the feed entry. It derives the
  // caller from auth.uid(), so payload.createdBy is not sent.
  const winner: "a" | "b" = payload.myScore > payload.theirScore ? "a" : "b";
  const { error } = await supabase.rpc("log_game", {
    p_court_id: payload.courtId,
    p_opponent_id: payload.opponentId,
    p_my_side: "a",
    p_score_a: payload.myScore,
    p_score_b: payload.theirScore,
    p_winner_side: winner,
    p_notes: payload.note?.trim() ? payload.note.trim() : null,
  });
  if (error) {
    console.warn("logGame failed", error.message);
    return;
  }
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
