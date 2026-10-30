import type { Court } from "@/constants/data";
import { supabase } from "@/lib/supabase";
import { mapCourtRow, type SupabaseCourtRow } from "@/services/courtService";

export type SavedCourt = { courtId: string; court: Court | null; autoCheckInEnabled: boolean | null };
export type AvailableSavedCourt = SavedCourt & { court: Court };

export async function fetchSavedCourts(userId: string): Promise<{ entries: SavedCourt[]; primaryCourtId: string | null }> {
  // Embedded court is null only when the row is inaccessible under court RLS.
  // HTTP/read errors throw; never turn an uncertain read into an empty list.
  const { data, error } = await supabase.from("saved_courts")
    .select("court_id,auto_check_in_enabled,courts(*),profiles(local_court_id)").eq("user_id", userId).order("created_at").order("court_id");
  if (error) throw new Error("Couldn't load your courts. Check your connection and try again.");
  const profile = data?.[0]?.profiles as unknown as { local_court_id: string | null } | null;
  if (data?.length && !profile) throw new Error("Couldn't load your courts. Check your connection and try again.");
  const entries = (data ?? []).map((row) => ({
    courtId: row.court_id,
    court: row.courts ? mapCourtRow(row.courts as unknown as SupabaseCourtRow) : null,
    autoCheckInEnabled: row.auto_check_in_enabled,
  }));
  return { entries, primaryCourtId: profile?.local_court_id ?? null };
}

export async function resolveSavedCourtAutoCheckIn(courtId: string, enabled: boolean): Promise<boolean> {
  const { data, error } = await supabase.rpc("resolve_saved_court_auto_check_in", { p_court_id: courtId, p_enabled: enabled });
  if (error || typeof data !== "boolean") throw new Error("Couldn't save your court. Check your connection and try again.");
  return data;
}

export async function changeSavedCourt(action: "save" | "remove" | "auto", courtId: string, enabled?: boolean): Promise<void> {
  const name = { save: "save_court", remove: "remove_saved_court", auto: "set_saved_court_auto_check_in" }[action];
  const { data, error } = await supabase.rpc(name, {
    p_court_id: courtId,
    ...(action === "auto" ? { p_enabled: enabled } : {}),
  });
  if (error?.code === "23514") throw new Error("LocalPlus: up to 5 courts");
  if (error || data !== true) throw new Error("Couldn't save your court. Check your connection and try again.");
}
