import { supabase } from "@/lib/supabase";
import { fetchCourtById } from "@/services/courtService";
import type { Court } from "@/constants/data";

export async function fetchSavedCourts(): Promise<Court[]> {
  const { data, error } = await supabase.rpc("my_saved_courts");
  if (error) throw error;
  const ids = (data ?? []) as { court_id: string }[];
  const courts = await Promise.all(ids.map(({ court_id }) => fetchCourtById(court_id)));
  if (courts.some(court => !court)) throw new Error("Couldn't load courts. Try again.");
  return courts as Court[];
}

export async function setCourtSaved(courtId: string, saved: boolean): Promise<void> {
  const { error } = await supabase.rpc("set_court_saved", { p_court_id: courtId, p_saved: saved });
  if (error) throw error;
}
