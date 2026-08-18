import { Player } from "@/constants/data";
import { supabase } from "@/lib/supabase";

import { mapProfileToPlayer, SupabaseProfile } from "./profileService";

// Players are auto-checked-out after 45 minutes. A pg_cron job closes stale
// rows server-side every 5 minutes; reads ALSO filter to the last 45 minutes
// so presence is exact between cron runs. Keep in sync with the
// auto_checkout_stale_checkins migration.
export const AUTO_CHECKOUT_MINUTES = 45;

function freshCutoffIso(): string {
  return new Date(Date.now() - AUTO_CHECKOUT_MINUTES * 60_000).toISOString();
}

// ─── Public API ─────────────────────────────────────────────────────────────

/**
 * Check the current user in via the check_in RPC, which atomically closes any
 * prior open check-in in the same transaction — a user can never be checked in
 * at two courts at once — and is idempotent on double-taps. Uses auth.uid()
 * server-side and emits the check_in activity_event.
 */
export async function checkInToCourt(
  courtId: string,
  note?: string,
  visibility: string = "public"
): Promise<boolean> {
  const { error } = await supabase.rpc("check_in", {
    p_court_id: courtId,
    p_visibility: visibility,
    p_note: note ?? null,
  });
  if (error) {
    console.warn("checkInToCourt failed:", error.message);
    return false;
  }
  return true;
}

/**
 * Change an active check-in's visibility through the idempotent check_in RPC.
 * Read the existing note first so a privacy change cannot erase it.
 */
export async function updateActiveCheckInVisibility(
  userId: string,
  courtId: string,
  visibility: string,
): Promise<boolean> {
  const { data, error } = await supabase
    .from("check_ins")
    .select("note")
    .eq("user_id", userId)
    .eq("court_id", courtId)
    .is("checked_out_at", null)
    .maybeSingle();
  if (error || !data) {
    if (error) console.warn("active check-in lookup failed:", error.message);
    return false;
  }
  return checkInToCourt(courtId, data.note ?? undefined, visibility);
}

/**
 * Check the current user out via the check_out RPC (closes their open check-in
 * server-side by auth.uid() and emits the check_out activity_event). The
 * userId param is kept for call-site compatibility but the RPC derives the
 * user from the session.
 */
export async function checkOutOfCourt(_userId: string): Promise<boolean> {
  const { error } = await supabase.rpc("check_out");
  if (error) {
    console.warn("checkOutOfCourt failed:", error.message);
    return false;
  }
  return true;
}

/** Fetch all players currently checked in to a court (checked_out_at IS NULL). */
export async function fetchActiveCheckIns(courtId: string): Promise<Player[]> {
  try {
    const { data, error } = await supabase
      .from("check_ins")
      .select("user_id, profiles(*)")
      .eq("court_id", courtId)
      .is("checked_out_at", null)
      .gte("checked_in_at", freshCutoffIso())
      .order("checked_in_at", { ascending: false });

    if (error || !data) return [];

    const players: Player[] = [];
    for (const row of data as unknown as Array<{ user_id: string; profiles: SupabaseProfile | null }>) {
      if (!row.profiles) continue;
      players.push(mapProfileToPlayer(row.profiles));
    }
    return players;
  } catch {
    return [];
  }
}

/** Count active check-ins at a court. */
export async function fetchActiveCheckInCount(courtId: string): Promise<number> {
  try {
    const { count, error } = await supabase
      .from("check_ins")
      .select("*", { count: "exact", head: true })
      .eq("court_id", courtId)
      .is("checked_out_at", null)
      .gte("checked_in_at", freshCutoffIso());
    if (error || count == null) return 0;
    return count;
  } catch {
    return 0;
  }
}

/** Lifetime check-in count for the signed-in player's Profile stat. */
export async function fetchUserCheckInCount(userId: string): Promise<number | null> {
  try {
    const { count, error } = await supabase
      .from("check_ins")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId);
    if (error || count == null) return null;
    return count;
  } catch {
    return null;
  }
}

/** Visible trailing-90-day check-ins grouped Monday through Sunday. */
export async function fetchPlayerActivityByWeekday(userId: string): Promise<number[]> {
  try {
    const since = new Date(Date.now() - 90 * 24 * 60 * 60_000).toISOString();
    const { data, error } = await supabase
      .from("check_ins")
      .select("checked_in_at")
      .eq("user_id", userId)
      .gte("checked_in_at", since)
      .order("checked_in_at", { ascending: true });
    if (error || !data) return Array(7).fill(0);
    const counts = Array(7).fill(0) as number[];
    for (const row of data as Array<{ checked_in_at: string }>) {
      const day = new Date(row.checked_in_at).getDay();
      counts[(day + 6) % 7] += 1;
    }
    return counts;
  } catch {
    return Array(7).fill(0);
  }
}

/**
 * Distinct players who checked in at a court in the trailing 7 days — the
 * "ACTIVE THIS WK" stat on the home hero. One indexed read; distinct is
 * folded client-side (PostgREST has no count-distinct).
 */
export async function fetchWeeklyActiveCount(courtId: string): Promise<number> {
  try {
    const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60_000).toISOString();
    const { data, error } = await supabase
      .from("check_ins")
      .select("user_id")
      .eq("court_id", courtId)
      .gte("checked_in_at", weekAgo)
      .limit(1000);
    if (error || !data) return 0;
    return new Set((data as { user_id: string }[]).map((r) => r.user_id)).size;
  } catch {
    return 0;
  }
}

export interface ActiveCheckInState {
  courtId: string;
  visibility: "public" | "friends" | "private";
}

/** Get the user's fresh active check-in and its persisted privacy mode. */
export async function fetchActiveCheckInState(
  userId: string,
): Promise<ActiveCheckInState | null> {
  try {
    const { data, error } = await supabase
      .from("check_ins")
      .select("court_id,visibility")
      .eq("user_id", userId)
      .is("checked_out_at", null)
      .gte("checked_in_at", freshCutoffIso())
      .order("checked_in_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error || !data) return null;
    const row = data as { court_id: string; visibility: ActiveCheckInState["visibility"] };
    return { courtId: row.court_id, visibility: row.visibility };
  } catch {
    return null;
  }
}

/** Get only the active court id for callers that do not need privacy state. */
export async function fetchCheckedInCourtId(userId: string): Promise<string | null> {
  return (await fetchActiveCheckInState(userId))?.courtId ?? null;
}
