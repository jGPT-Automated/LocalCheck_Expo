import { CourtSport, PlannedVisit } from "@/constants/data";
import { supabase } from "@/lib/supabase";

import { mapProfileToPlayer, SupabaseProfile } from "./profileService";

// ─── Types ──────────────────────────────────────────────────────────────────

interface SupabasePlannedVisit {
  id: string;
  user_id: string;
  court_id: string;
  planned_at: string;
  note: string | null;
  profiles: SupabaseProfile | null;
  courts: { name: string; sport_type: string } | null;
}

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
  const tomorrow = new Date(now);
  tomorrow.setDate(now.getDate() + 1);
  if (d.toDateString() === now.toDateString()) return "TODAY";
  if (d.toDateString() === tomorrow.toDateString()) return "TOMORROW";
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" }).toUpperCase();
}

function mapVisit(row: SupabasePlannedVisit): PlannedVisit | null {
  if (!row.profiles) return null;
  return {
    id: row.id,
    userId: row.user_id,
    player: mapProfileToPlayer(row.profiles),
    courtId: row.court_id,
    courtName: row.courts?.name ?? "Unknown Court",
    sport: normalizeSport(row.courts?.sport_type),
    plannedAtIso: row.planned_at,
    time: formatTime(row.planned_at),
    date: formatDate(row.planned_at),
    note: row.note ?? undefined,
  };
}

const VISIT_SELECT = "id, user_id, court_id, planned_at, note, profiles(*), courts(name, sport_type)";

// ─── Public API ─────────────────────────────────────────────────────────────

/** Planned visits in a time window, optionally scoped to one court, soonest first. */
export async function fetchPlannedVisits(filters: {
  from: Date;
  to: Date;
  courtId?: string;
}): Promise<PlannedVisit[]> {
  try {
    let q = supabase
      .from("planned_visits")
      .select(VISIT_SELECT)
      .gte("planned_at", filters.from.toISOString())
      .lte("planned_at", filters.to.toISOString())
      .order("planned_at", { ascending: true })
      .limit(200);
    if (filters.courtId) q = q.eq("court_id", filters.courtId);

    const { data, error } = await q;
    if (error || !data) {
      if (error) console.warn("fetchPlannedVisits failed", error.message);
      return [];
    }
    return (data as unknown as SupabasePlannedVisit[])
      .map(mapVisit)
      .filter((v): v is PlannedVisit => v !== null);
  } catch {
    return [];
  }
}

/** Post a planned visit. Returns true only when the row was written. */
export async function createPlannedVisit(
  userId: string,
  courtId: string,
  plannedAtIso: string,
  note?: string
): Promise<boolean> {
  try {
    const { error } = await supabase.from("planned_visits").upsert(
      {
        user_id: userId,
        court_id: courtId,
        planned_at: plannedAtIso,
        note: note?.trim() ? note.trim() : null,
      },
      { onConflict: "user_id,court_id,planned_at" }
    );
    if (error) {
      console.warn("createPlannedVisit failed", error.message);
      return false;
    }
    return true;
  } catch {
    return false;
  }
}

/** Remove one of the caller's planned visits (RLS restricts to own rows). */
export async function deletePlannedVisit(id: string): Promise<boolean> {
  try {
    const { error } = await supabase.from("planned_visits").delete().eq("id", id);
    if (error) {
      console.warn("deletePlannedVisit failed", error.message);
      return false;
    }
    return true;
  } catch {
    return false;
  }
}
