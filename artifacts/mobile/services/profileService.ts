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

/** Update the signed-in user's local court in Supabase. */
export async function updateLocalCourtId(userId: string, courtId: string | null): Promise<void> {
  await updateProfileFields(userId, { local_court_id: courtId });
}

/**
 * Persist profile preference fields to Supabase.
 * Deliberately excludes `is_pro`: it is derived by a DB trigger from the
 * subscriptions table and must never be written from the client.
 */
export async function updateProfileFields(
  userId: string,
  fields: Partial<{
    local_court_id: string | null;
    preferred_sport: string | null;
  }>
): Promise<void> {
  try {
    await supabase
      .from("profiles")
      .update({ ...fields, updated_at: new Date().toISOString() })
      .eq("id", userId);
  } catch {
    // Non-fatal: local state stays authoritative for this session.
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
