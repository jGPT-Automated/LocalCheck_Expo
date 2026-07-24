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

/** Get the court the user is currently checked in to, if any. */
export async function fetchCheckedInCourtId(userId: string): Promise<string | null> {
  try {
    const { data, error } = await supabase
      .from("check_ins")
      .select("court_id")
      .eq("user_id", userId)
      .is("checked_out_at", null)
      .gte("checked_in_at", freshCutoffIso())
      .order("checked_in_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error || !data) return null;
    return (data as { court_id: string }).court_id ?? null;
  } catch {
    return null;
  }
}
