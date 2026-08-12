import { CourtSport, getEloTier, Player } from "@/constants/data";
import { supabase } from "@/lib/supabase";
import {
  buildLeaderboardMembershipFilter,
  canLoadLeaderboardScope,
} from "@/services/leaderboardFilter";

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
  preferred_sport: string | null;
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
    username: row.username ?? undefined,
    elo,
    tier: getEloTier(elo),
    avatar: initials,
    wins,
    losses,
    checkIns: 0,
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
    const [{ data, error }, { count, error: countError }] = await Promise.all([
      supabase.from("profiles").select("*").eq("id", userId).single(),
      supabase
        .from("check_ins")
        .select("id", { count: "exact", head: true })
        .eq("user_id", userId),
    ]);
    if (error || !data) return null;
    if (countError) console.warn("fetchProfile check-in count failed:", countError.message);
    return {
      ...mapProfileToPlayer(data as SupabaseProfile),
      checkIns: count ?? 0,
    };
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
  /** Visible check-ins at this court. Kept presentation-only; RLS still owns visibility. */
  checkInCount: number;
}

/**
 * Locals for a court with each player's most recent check-in at that court —
 * powers the court view's LOCALS list ("last seen" gives a feel for how
 * active the court is). One query: PostgREST embed, per-parent order+limit.
 */
export async function fetchLocalsWithLastCheckIn(courtId: string): Promise<LocalWithLastCheckIn[]> {
  try {
    const [{ data: profiles, error: profileError }, { data: checkIns, error: checkInError }] =
      await Promise.all([
        supabase.from("profiles").select("*").eq("local_court_id", courtId),
        supabase
          .from("check_ins")
          .select("user_id,checked_in_at")
          .eq("court_id", courtId)
          .order("checked_in_at", { ascending: false })
          .limit(5000),
      ]);
    if (profileError || checkInError || !profiles) return [];
    const byPlayer = new Map<string, { latest: string; count: number }>();
    for (const row of (checkIns ?? []) as Array<{ user_id: string; checked_in_at: string }>) {
      const current = byPlayer.get(row.user_id);
      byPlayer.set(row.user_id, {
        latest: current?.latest ?? row.checked_in_at,
        count: (current?.count ?? 0) + 1,
      });
    }
    return (profiles as SupabaseProfile[])
      .map((row) => {
        const activity = byPlayer.get(row.id);
        return {
          player: mapProfileToPlayer(row),
          lastCheckInAt: activity?.latest ?? null,
          checkInCount: activity?.count ?? 0,
        };
      })
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

/**
 * Suggested friends prioritize people the viewer has shared a persisted match
 * with, then fill remaining slots with locals from their home court.
 */
export async function fetchSuggestedPlayers(
  userId: string,
  courtId: string | null,
  limit = 5,
): Promise<Player[]> {
  const suggestions = new Map<string, Player>();
  try {
    const { data: memberships } = await supabase
      .from("match_participants")
      .select("match_id")
      .eq("user_id", userId)
      .limit(50);
    const matchIds = (memberships as Array<{ match_id: string }> | null)?.map((row) => row.match_id) ?? [];
    if (matchIds.length > 0) {
      const { data: opponents } = await supabase
        .from("match_participants")
        .select("user_id,profiles(*)")
        .in("match_id", matchIds)
        .neq("user_id", userId)
        .limit(30);
      for (const row of (opponents ?? []) as unknown as Array<{ user_id: string; profiles: SupabaseProfile | null }>) {
        if (row.profiles && !suggestions.has(row.user_id)) suggestions.set(row.user_id, mapProfileToPlayer(row.profiles));
        if (suggestions.size >= limit) break;
      }
    }
    if (courtId && suggestions.size < limit) {
      const locals = await fetchLocals(courtId);
      for (const player of locals) {
        if (player.id !== userId && !suggestions.has(player.id)) suggestions.set(player.id, player);
        if (suggestions.size >= limit) break;
      }
    }
  } catch {
    // Suggestions are an enhancement; the Friends tab remains usable when an
    // older backend or a restrictive policy omits match participant embeds.
  }
  return Array.from(suggestions.values()).slice(0, limit);
}

/**
 * Leaderboard scope stays anchored to the viewer's saved home court. Sport
 * membership uses preferred_sport when set, then falls back to the saved home
 * court's sport. Accounts with neither value are not ranked.
 */
export async function fetchLeaderboard(
  scope: "LOCAL" | "GLOBAL" | "REGIONAL",
  courtId: string | null,
  sport?: CourtSport | null
): Promise<Player[]> {
  try {
    if (!canLoadLeaderboardScope(scope, courtId)) return [];

    let regionalCourtIds: string[] | null = null;
    let fallbackSportCourtIds: string[] = [];

    if (scope === "LOCAL" && courtId && sport) {
      const { data: homeCourt } = await supabase
        .from("courts")
        .select("sport_type")
        .eq("id", courtId)
        .eq("is_archived", false)
        .maybeSingle();
      if ((homeCourt as { sport_type?: string | null } | null)?.sport_type === sport.toLowerCase()) {
        fallbackSportCourtIds = [courtId];
      }
    }

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
        .select("id,sport_type")
        .eq("market", market)
        .eq("is_archived", false)
        .limit(500);
      const regionalCourts = marketCourts as Array<{ id: string; sport_type: string | null }> | null;
      regionalCourtIds = regionalCourts?.map((court) => court.id) ?? [];
      if (regionalCourtIds.length === 0) return [];
      if (sport) {
        fallbackSportCourtIds = regionalCourts
          ?.filter((court) => court.sport_type === sport.toLowerCase())
          .map((court) => court.id) ?? [];
      }
    }

    if (scope === "GLOBAL" && sport) {
      const { data: sportCourts } = await supabase
        .from("courts")
        .select("id")
        .eq("sport_type", sport.toLowerCase())
        .eq("is_archived", false)
        .limit(1000);
      fallbackSportCourtIds = (sportCourts as Array<{ id: string }> | null)
        ?.map((court) => court.id) ?? [];
    }

    const buildQuery = (orderColumn: string) => {
      let query = supabase.from("profiles").select("*");
      if (scope === "LOCAL" && courtId) query = query.eq("local_court_id", courtId);
      if (scope === "REGIONAL" && regionalCourtIds) query = query.in("local_court_id", regionalCourtIds);
      if (sport === "BASKETBALL" || sport === "PICKLEBALL") {
        query = query.or(buildLeaderboardMembershipFilter(sport, fallbackSportCourtIds));
      }
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
