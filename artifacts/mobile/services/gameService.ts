import { CourtSport, GameType, MatchResult } from "@/constants/data";
import { supabase } from "@/lib/supabase";

import { mapProfileToPlayer, SupabaseProfile } from "./profileService";

// ─── Types ──────────────────────────────────────────────────────────────────

interface SupabaseGame {
  id: string;
  court_id: string;
  created_by: string;
  played_at: string;
  score_a: number;
  score_b: number;
  winner_side: "A" | "B" | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  courts?: { name: string; sport_type: string } | null;
  game_participants?: Array<{
    user_id: string;
    team_side: "A" | "B";
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
  const isOnTeamA = row.game_participants?.some((p) => p.user_id === currentUserId && p.team_side === "A");
  const won = row.winner_side === (isOnTeamA ? "A" : "B");
  const sport = normalizeSport(row.courts?.sport_type);
  return {
    id: row.id,
    date: formatDate(row.played_at),
    courtName: row.courts?.name?.toUpperCase() ?? "UNKNOWN",
    sport,
    result: won ? "WIN" : "LOSS",
    eloDelta: won ? 15 : -15,
    teamScore: String(row.score_a ?? 0),
    opposingScore: String(row.score_b ?? 0),
  };
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
  try {
    const winner = payload.myScore > payload.theirScore ? "A" : "B";
    const { data, error } = await supabase
      .from("games")
      .insert({
        court_id: payload.courtId,
        created_by: payload.createdBy,
        played_at: new Date().toISOString(),
        score_a: payload.myScore,
        score_b: payload.theirScore,
        winner_side: winner,
        notes: payload.note ?? null,
      })
      .select("*")
      .single();
    if (error || !data) return;

    const gameId = (data as SupabaseGame).id;
    await supabase.from("game_participants").insert([
      { game_id: gameId, user_id: payload.createdBy, team_side: "A" },
      { game_id: gameId, user_id: payload.opponentId, team_side: "B" },
    ]);
  } catch {
    // Best-effort
  }
}

export async function fetchGamesByCourt(courtId: string): Promise<MatchResult[]> {
  try {
    const { data, error } = await supabase
      .from("games")
      .select("*, courts(name, sport_type), game_participants(user_id, team_side, profiles(*))")
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
    const { data, error } = await supabase
      .from("games")
      .select("*, courts(name, sport_type), game_participants(user_id, team_side, profiles(*))")
      .eq("game_participants.user_id", userId)
      .order("played_at", { ascending: false })
      .limit(50);
    if (error || !data) return [];
    return (data as unknown as SupabaseGame[]).map((g) => mapGameToMatchResult(g, userId));
  } catch {
    return [];
  }
}

export async function fetchRecentGames(limit = 20): Promise<MatchResult[]> {
  try {
    const { data, error } = await supabase
      .from("games")
      .select("*, courts(name, sport_type), game_participants(user_id, team_side, profiles(*))")
      .order("played_at", { ascending: false })
      .limit(limit);
    if (error || !data) return [];
    return (data as unknown as SupabaseGame[]).map((g) => mapGameToMatchResult(g));
  } catch {
    return [];
  }
}
