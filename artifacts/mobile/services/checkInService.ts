import { Player } from "@/constants/data";
import { supabase } from "@/lib/supabase";

import { mapProfileToPlayer, SupabaseProfile } from "./profileService";

// ─── Public API ─────────────────────────────────────────────────────────────

/**
 * Check the current user in via the switch_active_checkin RPC, which atomically
 * closes any prior open check-in in the same transaction — a user can never be
 * checked in at two courts at once. Uses auth.uid() server-side.
 */
export async function checkInToCourt(
  courtId: string,
  note?: string,
  visibility: string = "public"
): Promise<boolean> {
  const { error } = await supabase.rpc("switch_active_checkin", {
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

/** Mark any open check-in for this user as checked out. */
export async function checkOutOfCourt(userId: string): Promise<boolean> {
  const { error } = await supabase
    .from("check_ins")
    .update({ checked_out_at: new Date().toISOString() })
    .eq("user_id", userId)
    .is("checked_out_at", null);
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
      .is("checked_out_at", null);
    if (error || count == null) return 0;
    return count;
  } catch {
    return 0;
  }
}

/** Get the court the user is currently checked in to, if any. */
export async function fetchCheckedInCourtId(userId: string): Promise<string | null> {
  try {
    const { data, error } = await supabase
      .from("check_ins")
      .select("court_id")
      .eq("user_id", userId)
      .is("checked_out_at", null)
      .order("checked_in_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error || !data) return null;
    return (data as { court_id: string }).court_id ?? null;
  } catch {
    return null;
  }
}
