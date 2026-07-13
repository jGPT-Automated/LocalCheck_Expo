import { CourtSport, GameRun, Player } from "@/constants/data";
import { supabase } from "@/lib/supabase";

import { mapProfileToPlayer, SupabaseProfile } from "./profileService";

// ─── Types ──────────────────────────────────────────────────────────────────

interface SupabaseScheduledGame {
  id: string;
  court_id: string;
  organizer_id: string;
  title: string;
  note: string | null;
  start_time: string;
  max_players: number;
  is_open_invite: boolean;
  status: string;
  created_at: string;
  updated_at: string;
  courts?: { name: string; sport_type: string } | null;
  organizer?: SupabaseProfile | null;
  scheduled_game_participants?: Array<{
    user_id: string;
    rsvp_status: string;
    joined_at: string;
    profiles: SupabaseProfile | null;
  }>;
}

function normalizeSport(raw: string | null | undefined): CourtSport {
  const upper = (raw ?? "").toUpperCase();
  const valid: CourtSport[] = ["BASKETBALL", "PICKLEBALL", "TENNIS", "SOCCER", "VOLLEYBALL"];
  return valid.includes(upper as CourtSport) ? (upper as CourtSport) : "BASKETBALL";
}

function formatTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: false });
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const isToday = d.toDateString() === now.toDateString();
  const tomorrow = new Date(now);
  tomorrow.setDate(now.getDate() + 1);
  if (isToday) return "TODAY";
  if (d.toDateString() === tomorrow.toDateString()) return "TOMORROW";
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" }).toUpperCase();
}

export function mapScheduledGameToRun(row: SupabaseScheduledGame): GameRun {
  // Only "going" RSVPs count as participants — the DB has no team assignment.
  const participants: Player[] = [];
  for (const p of row.scheduled_game_participants ?? []) {
    if (p.profiles && p.rsvp_status === "going") participants.push(mapProfileToPlayer(p.profiles));
  }
  const maxPlayers = row.max_players ?? 10;
  return {
    id: row.id,
    courtId: row.court_id,
    courtName: row.courts?.name ?? "Unknown Court",
    sport: normalizeSport(row.courts?.sport_type),
    title: row.title.toUpperCase(),
    time: formatTime(row.start_time),
    date: formatDate(row.start_time),
    startTimeIso: row.start_time,
    maxPlayers,
    participants,
    hostId: row.organizer_id,
    skillLevel: "ALL LEVELS",
  };
}

// ─── Public API ─────────────────────────────────────────────────────────────

export async function fetchScheduledGames(filters?: {
  courtId?: string;
  from?: Date;
  to?: Date;
  status?: string;
}): Promise<GameRun[]> {
  try {
    let q = supabase
      .from("scheduled_games")
      .select(
        "*, courts(name, sport_type), organizer:profiles!scheduled_games_organizer_id_fkey(*), scheduled_game_participants(user_id, rsvp_status, joined_at, profiles(*))"
      )
      .order("start_time", { ascending: true })
      .limit(100);

    if (filters?.courtId) {
      q = q.eq("court_id", filters.courtId);
    }
    if (filters?.from) {
      q = q.gte("start_time", filters.from.toISOString());
    }
    if (filters?.to) {
      q = q.lte("start_time", filters.to.toISOString());
    }
    if (filters?.status) {
      q = q.eq("status", filters.status);
    }

    const { data, error } = await q;
    if (error || !data) {
      console.warn("fetchScheduledGames error:", error?.message);
      return [];
    }
    return (data as unknown as SupabaseScheduledGame[]).map(mapScheduledGameToRun);
  } catch (err) {
    console.warn("fetchScheduledGames exception:", err);
    return [];
  }
}

export async function createScheduledGame(payload: {
  courtId: string;
  organizerId: string;
  title: string;
  startTime: string;
  maxPlayers: number;
  note?: string;
}): Promise<GameRun | null> {
  try {
    const { data, error } = await supabase
      .from("scheduled_games")
      .insert({
        court_id: payload.courtId,
        organizer_id: payload.organizerId,
        title: payload.title,
        start_time: payload.startTime,
        max_players: payload.maxPlayers,
        note: payload.note ?? null,
        // Live enum: scheduled | cancelled | completed
        status: "scheduled",
        is_open_invite: true,
      })
      .select("*, courts(name, sport_type)")
      .single();
    if (error || !data) {
      if (error) console.warn("createScheduledGame failed", error.message);
      return null;
    }
    const row = data as unknown as SupabaseScheduledGame;
    // The host is playing in their own run — insert their RSVP so the run
    // doesn't start at 0 players.
    const joined = await joinScheduledGame(row.id, payload.organizerId);
    if (!joined) console.warn("createScheduledGame: host RSVP insert failed");
    return mapScheduledGameToRun(row);
  } catch {
    return null;
  }
}

/**
 * RSVP the user to a run ("going"). Capacity-checked against max_players;
 * returns true only when the RSVP row was actually written.
 */
export async function joinScheduledGame(gameId: string, userId: string): Promise<boolean> {
  try {
    const { data: game, error: gameError } = await supabase
      .from("scheduled_games")
      .select("max_players, scheduled_game_participants(user_id, rsvp_status)")
      .eq("id", gameId)
      .maybeSingle();
    if (gameError || !game) {
      if (gameError) console.warn("joinScheduledGame failed", gameError.message);
      return false;
    }
    const row = game as unknown as {
      max_players: number | null;
      scheduled_game_participants?: Array<{ user_id: string; rsvp_status: string }>;
    };
    const going = (row.scheduled_game_participants ?? []).filter((p) => p.rsvp_status === "going");
    const alreadyGoing = going.some((p) => p.user_id === userId);
    if (!alreadyGoing && row.max_players != null && going.length >= row.max_players) {
      console.warn("joinScheduledGame: run is full");
      return false;
    }
    const { error } = await supabase.from("scheduled_game_participants").upsert({
      scheduled_game_id: gameId,
      user_id: userId,
      rsvp_status: "going",
      joined_at: new Date().toISOString(),
    });
    if (error) {
      console.warn("joinScheduledGame failed", error.message);
      return false;
    }
    return true;
  } catch {
    return false;
  }
}
