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
  total_court_time_minutes: number;
  local_court_id: string | null;
  created_at: string;
  updated_at: string;
}

export function mapProfileToPlayer(row: Partial<SupabaseProfile>): Player {
  const name = row.display_name || row.username || "Player";
  const initials = name
    .split(" ")
    .filter(Boolean)
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
  const elo = row.elo_rating ?? 1200;
  return {
    id: row.id ?? "",
    name,
    elo,
    tier: getEloTier(elo),
    avatar: initials,
    wins: row.wins ?? 0,
    losses: row.losses ?? 0,
    checkIns: row.total_court_time_minutes ?? 0,
    memberSince: row.created_at ?? new Date().toISOString(),
    courtId: row.local_court_id ?? undefined,
    sport: undefined,
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
    return (data as SupabaseProfile[]).map(mapProfileToPlayer);
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
    return (data as SupabaseProfile[]).map(mapProfileToPlayer);
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
    let q = supabase.from("profiles").select("*");

    if (scope === "LOCAL" && courtId) {
      q = q.eq("local_court_id", courtId);
    }

    // Profiles don't have a sport column, so we can't filter by sport reliably.
    // If the user's local court has a sport and scope is LOCAL, the leaderboard
    // naturally reflects that sport. For GLOBAL, we return all players.
    void sport;

    const { data, error } = await q.order("elo_rating", { ascending: false }).limit(100);
    if (error || !data) return [];
    return (data as SupabaseProfile[]).map(mapProfileToPlayer);
  } catch {
    return [];
  }
}
