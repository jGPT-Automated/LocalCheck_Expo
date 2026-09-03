import { CourtSport, GameRun, Player, TeamAssignmentMode, TeamSide } from "@/constants/data";
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
  team_assignment_mode?: TeamAssignmentMode | null;
  courts?: { name: string; short_name: string; sport_type: string } | null;
  organizer?: SupabaseProfile | null;
  result?: Array<{ id: string; status: string }>;
  run_participants?: Array<{
    user_id: string;
    status: string;
    joined_at: string;
    team_side?: TeamSide | null;
    profiles: SupabaseProfile | null;
  }>;
}

const RUN_SELECT =
  "*, courts(name, short_name, sport_type), organizer:profiles!runs_organizer_id_fkey(*), run_participants(*, profiles(*)), result:matches(id,status)";

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
  const participantSides: Record<string, TeamSide> = {};
  for (const p of row.run_participants ?? []) {
    if (p.profiles && p.status === "going") {
      participants.push(mapProfileToPlayer(p.profiles));
      if (p.team_side) participantSides[p.user_id] = p.team_side;
    }
  }
  const maxPlayers = row.max_players ?? 10;
  return {
    id: row.id,
    courtId: row.court_id,
    courtName: row.courts?.name ?? "Unknown Court",
    courtShortName: row.courts?.short_name ?? row.courts?.name ?? "Court",
    sport: normalizeSport(row.courts?.sport_type),
    title: row.title.toUpperCase(),
    time: formatTime(row.start_time),
    date: formatDate(row.start_time),
    startTimeIso: row.start_time,
    maxPlayers,
    participants,
    participantSides,
    teamAssignmentMode: row.team_assignment_mode ?? "elo_balance",
    hostId: row.organizer_id,
    hostName: row.organizer?.display_name || row.organizer?.username || undefined,
    status: row.status,
    resultMatchId: row.result?.[0]?.id,
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
    // Global 14-day window feeds Schedule/Home; cap high enough that a busy
    // deployment can't push a selected court's later-week run past the limit.
    // If runs ever exceed this, scope the fetch per court instead.
    let q = supabase
      .from("runs")
      .select(RUN_SELECT)
      .order("start_time", { ascending: true })
      .limit(300);

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
  teamAssignmentMode: TeamAssignmentMode;
  note?: string;
}): Promise<GameRun | null> {
  try {
    // create_run inserts the run AND the organizer's "going" RSVP atomically,
    // deriving the organizer from auth.uid().
    const { data: created, error } = await supabase.rpc("create_scheduled_game", {
      p_court_id: payload.courtId,
      p_title: payload.title,
      p_start_time: payload.startTime,
      p_max_players: payload.maxPlayers,
      p_team_assignment_mode: payload.teamAssignmentMode,
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
 * Organizer edits their run before it happens. RLS (runs_update_organizer)
 * restricts this to the caller's own runs; zero returned rows = not allowed.
 */
export async function updateScheduledGame(
  runId: string,
  fields: { title?: string; startTime?: string; maxPlayers?: number; note?: string | null }
): Promise<boolean> {
  try {
    const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (fields.title !== undefined) patch.title = fields.title;
    if (fields.startTime !== undefined) patch.start_time = fields.startTime;
    if (fields.maxPlayers !== undefined) patch.max_players = fields.maxPlayers;
    if (fields.note !== undefined) patch.note = fields.note;
    const { data, error } = await supabase
      .from("runs")
      .update(patch)
      .eq("id", runId)
      .select("id");
    if (error) {
      console.warn("updateScheduledGame failed", error.message);
      return false;
    }
    return (data?.length ?? 0) > 0;
  } catch {
    return false;
  }
}

/**
 * RSVP the caller to a run ("going") via the join_run RPC, which capacity-checks
 * against max_players server-side. The userId param is kept for call-site
 * compatibility; the RPC uses auth.uid().
 */
export async function joinScheduledGame(
  gameId: string,
  _userId: string,
  teamSide?: TeamSide,
): Promise<boolean> {
  try {
    const { error } = await supabase.rpc("join_scheduled_game", {
      p_run_id: gameId,
      p_team_side: teamSide ?? null,
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
