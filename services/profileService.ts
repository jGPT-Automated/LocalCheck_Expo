import { CourtSport, getEloTier, Player } from "@/constants/data";
import { supabase } from "@/lib/supabase";

// ─── Types ──────────────────────────────────────────────────────────────────

export interface SupabaseProfile {
  id: string;
  email: string | null;
  display_name: string;
  username: string;
  avatar_url: string | null;
  elo_rating: number;
  wins: number;
  losses: number;
  elo_basketball: number;
  elo_pickleball: number;
  basketball_wins: number;
  basketball_losses: number;
  pickleball_wins: number;
  pickleball_losses: number;
  total_court_time_minutes: number;
  local_court_id: string | null;
  created_at: string;
  updated_at: string;
}

export function mapProfileToPlayer(row: Partial<SupabaseProfile>, sport?: CourtSport | null): Player {
  const name = row.display_name || row.username || "Player";
  const initials = name
    .split(" ")
    .filter(Boolean)
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
  const elo = sport === "BASKETBALL"
    ? row.elo_basketball ?? row.elo_rating ?? 1200
    : sport === "PICKLEBALL"
    ? row.elo_pickleball ?? row.elo_rating ?? 1200
    : row.elo_rating ?? 1200;
  const wins = sport === "BASKETBALL"
    ? row.basketball_wins ?? row.wins ?? 0
    : sport === "PICKLEBALL"
    ? row.pickleball_wins ?? row.wins ?? 0
    : row.wins ?? 0;
  const losses = sport === "BASKETBALL"
    ? row.basketball_losses ?? row.losses ?? 0
    : sport === "PICKLEBALL"
    ? row.pickleball_losses ?? row.losses ?? 0
    : row.losses ?? 0;
  return {
    id: row.id ?? "",
    name,
    elo,
    tier: getEloTier(elo),
    avatar: initials,
    wins,
    losses,
    checkIns: row.total_court_time_minutes ?? 0,
    memberSince: row.created_at ?? new Date().toISOString(),
    courtId: row.local_court_id ?? undefined,
    sport: sport ?? undefined,
    visibility: "public",
    isLocalPlus: false,
    friendIds: [],
  };
}

// ─── Public API ─────────────────────────────────────────────────────────────

/** Fetch a single profile by user id. */
export async function fetchProfile(userId: string): Promise<Player | null> {
  try {
    const { data, error } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", userId)
      .single();
    if (error || !data) return null;
    return mapProfileToPlayer(data as SupabaseProfile);
  } catch {
    return null;
  }
}

/** Fetch all players who have selected this court as their local court. */
export async function fetchLocals(courtId: string): Promise<Player[]> {
  try {
    const { data, error } = await supabase
      .from("profiles")
      .select("*")
      .eq("local_court_id", courtId);
    if (error || !data) return [];
    return (data as SupabaseProfile[]).map((row) => mapProfileToPlayer(row));
  } catch {
    return [];
  }
}

export interface LocalWithLastCheckIn {
  player: Player;
  /** ISO timestamp of this player's most recent check-in at THIS court; null if never. */
  lastCheckInAt: string | null;
}

/**
 * Locals for a court with each player's most recent check-in at that court —
 * powers the court view's LOCALS list ("last seen" gives a feel for how
 * active the court is). One query: PostgREST embed, per-parent order+limit.
 */
export async function fetchLocalsWithLastCheckIn(courtId: string): Promise<LocalWithLastCheckIn[]> {
  try {
    const { data, error } = await supabase
      .from("profiles")
      .select("*, check_ins!user_id(checked_in_at)")
      .eq("local_court_id", courtId)
      .eq("check_ins.court_id", courtId)
      .order("checked_in_at", { referencedTable: "check_ins", ascending: false })
      .limit(1, { referencedTable: "check_ins" });
    if (error || !data) return [];
    return (data as (SupabaseProfile & { check_ins?: { checked_in_at: string }[] })[])
      .map((row) => ({
        player: mapProfileToPlayer(row),
        lastCheckInAt: row.check_ins?.[0]?.checked_in_at ?? null,
      }))
      // Most recently active first; never-checked-in at the end.
      .sort((a, b) => (b.lastCheckInAt ?? "").localeCompare(a.lastCheckInAt ?? ""));
  } catch {
    return [];
  }
}

/** Count locals at a court. */
export async function fetchLocalCount(courtId: string): Promise<number> {
  try {
    const { count, error } = await supabase
      .from("profiles")
      .select("*", { count: "exact", head: true })
      .eq("local_court_id", courtId);
    if (error || count == null) return 0;
    return count;
  } catch {
    return 0;
  }
}

/**
 * Update the signed-in user's local court in Supabase. Returns true only when
 * the row came back with the requested value — callers must roll back their
 * optimistic state on false, or the selection silently reverts on relaunch.
 */
export async function updateLocalCourtId(userId: string, courtId: string | null): Promise<boolean> {
  return updateProfileFields(userId, { local_court_id: courtId });
}

/**
 * Persist profile preference fields to Supabase. Returns whether the write
 * verifiably persisted: Supabase reports failures in the resolved `error`
 * object (not by throwing), and an RLS-filtered update "succeeds" with zero
 * rows — so we select the row back and check it exists.
 * Deliberately excludes `is_pro`: it is derived by a DB trigger from the
 * subscriptions table and must never be written from the client.
 */
export async function updateProfileFields(
  userId: string,
  fields: Partial<{
    local_court_id: string | null;
    preferred_sport: string | null;
  }>
): Promise<boolean> {
  try {
    const { data, error } = await supabase
      .from("profiles")
      .update({ ...fields, updated_at: new Date().toISOString() })
      .eq("id", userId)
      .select("id");
    if (error) {
      console.warn("updateProfileFields failed:", error.message);
      return false;
    }
    return (data?.length ?? 0) > 0;
  } catch (err) {
    console.warn("updateProfileFields exception:", err);
    return false;
  }
}

/** Search players by display name or username. */
export async function searchPlayers(query: string): Promise<Player[]> {
  const trimmed = query.trim().toLowerCase();
  if (trimmed.length < 2) return [];
  try {
    const { data, error } = await supabase
      .from("profiles")
      .select("*")
      .or(`display_name.ilike.%${trimmed}%,username.ilike.%${trimmed}%`)
      .limit(20);
    if (error || !data) return [];
    return (data as SupabaseProfile[]).map((row) => mapProfileToPlayer(row));
  } catch {
    return [];
  }
}

/** Leaderboard: LOCAL = profiles with same local_court_id, GLOBAL = all profiles. */
export async function fetchLeaderboard(
  scope: "LOCAL" | "GLOBAL" | "REGIONAL",
  courtId: string | null,
  sport?: CourtSport | null
): Promise<Player[]> {
  try {
    let regionalCourtIds: string[] | null = null;

    if (scope === "REGIONAL" && courtId) {
      const { data: anchor } = await supabase
        .from("courts")
        .select("market")
        .eq("id", courtId)
        .maybeSingle();
      const market = (anchor as { market?: string | null } | null)?.market;
      if (!market) return [];
      const { data: marketCourts } = await supabase
        .from("courts")
        .select("id")
        .eq("market", market)
        .eq("is_archived", false)
        .limit(500);
      regionalCourtIds = (marketCourts as Array<{ id: string }> | null)?.map((court) => court.id) ?? [];
      if (regionalCourtIds.length === 0) return [];
    }

    const buildQuery = (orderColumn: string) => {
      let query = supabase.from("profiles").select("*");
      if (scope === "LOCAL" && courtId) query = query.eq("local_court_id", courtId);
      if (scope === "REGIONAL" && regionalCourtIds) query = query.in("local_court_id", regionalCourtIds);
      return query.order(orderColumn, { ascending: false }).limit(100);
    };

    const ratingColumn = sport === "PICKLEBALL" ? "elo_pickleball" : "elo_basketball";
    let result = await buildQuery(ratingColumn);
    // Rollout safety: an older backend can still show its combined rating
    // until the additive sport-rating migration is applied.
    if (result.error?.code === "42703") result = await buildQuery("elo_rating");
    if (result.error || !result.data) return [];
    return (result.data as SupabaseProfile[]).map((row) => mapProfileToPlayer(row, sport));
  } catch {
    return [];
  }
}
