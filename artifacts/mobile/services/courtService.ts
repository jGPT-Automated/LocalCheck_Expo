import { Court, CourtSport } from "@/constants/data";
import { supabase } from "@/lib/supabase";

// ─── Types ──────────────────────────────────────────────────────────────────

interface SupabaseCourtRow {
  id: string;
  name: string;
  address: string;
  latitude: number;
  longitude: number;
  sport_type: string;
  image_url?: string | null;
  is_archived?: boolean | null;
  location?: string | null;
  state?: string | null;
  added_by?: string | null;
  created_at?: string | null;
  // courts_with_stats extras
  active_check_in_count?: number | null;
  total_check_ins?: number | null;
}

const BASE_COLS = "id,name,address,latitude,longitude,sport_type,image_url,is_archived,location,state,added_by,created_at";
const STATS_COLS = BASE_COLS + ",active_check_in_count,total_check_ins";

// ─── Helpers ────────────────────────────────────────────────────────────────

function normalizeSport(raw: string | null | undefined): CourtSport {
  const upper = (raw ?? "").toUpperCase();
  const valid: CourtSport[] = ["BASKETBALL", "PICKLEBALL", "TENNIS", "SOCCER", "VOLLEYBALL"];
  return valid.includes(upper as CourtSport) ? (upper as CourtSport) : "BASKETBALL";
}

function mapRow(row: SupabaseCourtRow): Court {
  return {
    id: String(row.id),
    name: row.name ?? "Unknown Court",
    sport: normalizeSport(row.sport_type),
    neighborhood: row.location ?? "",
    city: row.state ?? "",
    address: row.address ?? "",
    latitude: Number(row.latitude),
    longitude: Number(row.longitude),
    activeCount: row.active_check_in_count ?? 0,
    maxCapacity: 10,
    rating: 4.0,
    ratingCount: row.total_check_ins ?? 0,
    surface: "ASPHALT",
    lights: false,
    covered: false,
    imageUri: row.image_url ?? undefined,
    status: "community",
    localCount: 0,
    addedBy: row.added_by ?? undefined,
    addedDate: row.created_at ? row.created_at.slice(0, 10) : undefined,
  };
}

function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// ─── Public API ─────────────────────────────────────────────────────────────

/** Fetch a single court by UUID. Returns null on any error. */
export async function fetchCourtById(id: string): Promise<Court | null> {
  try {
    const { data, error } = await supabase
      .from("courts")
      .select(BASE_COLS)
      .eq("id", id)
      .single();
    if (error || !data) return null;
    return mapRow(data as SupabaseCourtRow);
  } catch {
    return null;
  }
}

/**
 * Fetch up to `limit` courts nearest to the given coordinates.
 * Loads a batch of 300 non-archived courts, sorts by haversine distance,
 * returns the closest `limit`.
 */
export async function fetchNearbyCourts(
  lat: number,
  lng: number,
  sport?: CourtSport | "ALL" | null,
  limit = 20
): Promise<Court[]> {
  try {
    let q = supabase
      .from("courts_with_stats")
      .select(STATS_COLS)
      .eq("is_archived", false)
      .limit(300);

    if (sport && sport !== "ALL") {
      q = q.eq("sport_type", sport.toLowerCase());
    }

    const { data, error } = await q;
    if (error || !data) {
      // fallback to base table
      let q2 = supabase
        .from("courts")
        .select(BASE_COLS)
        .eq("is_archived", false)
        .limit(300);
      if (sport && sport !== "ALL") {
        q2 = q2.eq("sport_type", sport.toLowerCase());
      }
      const { data: data2, error: error2 } = await q2;
      if (error2 || !data2) return [];
      return (data2 as SupabaseCourtRow[])
        .map(mapRow)
        .sort((a, b) => haversineKm(lat, lng, a.latitude, a.longitude) - haversineKm(lat, lng, b.latitude, b.longitude))
        .slice(0, limit);
    }

    return ((data as unknown) as SupabaseCourtRow[])
      .map(mapRow)
      .sort((a, b) => haversineKm(lat, lng, a.latitude, a.longitude) - haversineKm(lat, lng, b.latitude, b.longitude))
      .slice(0, limit);
  } catch {
    return [];
  }
}

/**
 * Typeahead search — queries Supabase for courts whose name contains `query`.
 * Returns up to `limit` results. Returns [] on any error or empty query.
 */
export async function searchCourts(
  query: string,
  sport?: CourtSport | "ALL" | null,
  limit = 15
): Promise<Court[]> {
  const trimmed = query.trim();
  if (trimmed.length < 2) return [];
  try {
    let q = supabase
      .from("courts")
      .select(BASE_COLS)
      .eq("is_archived", false)
      .ilike("name", `%${trimmed}%`)
      .limit(limit);

    if (sport && sport !== "ALL") {
      q = q.eq("sport_type", sport.toLowerCase());
    }

    const { data, error } = await q;
    if (error || !data) return [];
    return (data as SupabaseCourtRow[]).map(mapRow);
  } catch {
    return [];
  }
}
