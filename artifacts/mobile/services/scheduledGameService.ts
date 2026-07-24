import { CourtSport, GameRun, Player } from "@/constants/data";
import { supabase } from "@/lib/supabase";

import { mapProfileToPlayer, SupabaseProfile } from "./profileService";

// ─── Types ──────────────────────────────────────────────────────────────────
// Backend: LocalCheckProd `runs` + `run_participants` (status going/waitlist/
// declined), written via the create_run / join_run / leave_run RPCs. (Was
// `scheduled_games`/`scheduled_game_participants` on the old project.)

interface SupabaseRun {
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
  run_participants?: Array<{
    user_id: string;
    status: string;
    joined_at: string;
    profiles: SupabaseProfile | null;
  }>;
}

const RUN_SELECT =
  "*, courts(name, sport_type), organizer:profiles!runs_organizer_id_fkey(*), run_participants(user_id, status, joined_at, profiles(*))";

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

export function mapScheduledGameToRun(row: SupabaseRun): GameRun {
  // Only "going" RSVPs count as participants.
  const participants: Player[] = [];
  for (const p of row.run_participants ?? []) {
    if (p.profiles && p.status === "going") participants.push(mapProfileToPlayer(p.profiles));
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
      .from("runs")
      .select(RUN_SELECT)
      .order("start_time", { ascending: true })
      .limit(100);

    if (filters?.courtId) q = q.eq("court_id", filters.courtId);
    if (filters?.from) q = q.gte("start_time", filters.from.toISOString());
    if (filters?.to) q = q.lte("start_time", filters.to.toISOString());
    if (filters?.status) q = q.eq("status", filters.status);

    const { data, error } = await q;
    if (error || !data) {
      console.warn("fetchScheduledGames error:", error?.message);
      return [];
    }
    return (data as unknown as SupabaseRun[]).map(mapScheduledGameToRun);
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
    // create_run inserts the run AND the organizer's "going" RSVP atomically,
    // deriving the organizer from auth.uid().
    const { data: created, error } = await supabase.rpc("create_run", {
      p_court_id: payload.courtId,
      p_title: payload.title,
      p_start_time: payload.startTime,
      p_max_players: payload.maxPlayers,
      p_note: payload.note ?? null,
      p_is_open_invite: true,
    });
    if (error || !created) {
      if (error) console.warn("createScheduledGame failed", error.message);
      return null;
    }
    const runId = (created as { id: string }).id;
    // Re-read with embeds so the returned GameRun has court name + participants.
    const { data: full } = await supabase
      .from("runs")
      .select(RUN_SELECT)
      .eq("id", runId)
      .maybeSingle();
    if (full) return mapScheduledGameToRun(full as unknown as SupabaseRun);
    // Fallback: minimal mapping from the RPC row if the re-read failed.
    return mapScheduledGameToRun(created as unknown as SupabaseRun);
  } catch {
    return null;
  }
}

/**
 * RSVP the caller to a run ("going") via the join_run RPC, which capacity-checks
 * against max_players server-side. The userId param is kept for call-site
 * compatibility; the RPC uses auth.uid().
 */
export async function joinScheduledGame(gameId: string, _userId: string): Promise<boolean> {
  try {
    const { error } = await supabase.rpc("join_run", { p_run_id: gameId });
    if (error) {
      console.warn("joinScheduledGame failed", error.message);
      return false;
    }
    return true;
  } catch {
    return false;
  }
}
