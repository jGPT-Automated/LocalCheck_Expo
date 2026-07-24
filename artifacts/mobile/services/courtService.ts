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
  local_player_count?: number | null;
  is_confirmed?: boolean | null;
}

const BASE_COLS = "id,name,address,latitude,longitude,sport_type,image_url,is_archived,location,state,added_by,created_at";
const STATS_COLS = BASE_COLS + ",active_check_in_count,total_check_ins,local_player_count,is_confirmed";

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
    // The live courts table has no capacity/rating/surface/lights columns —
    // leave those Court fields unset instead of inventing values. Stats-view
    // rows DO carry real locals + confirmation state; map them when present.
    ratingCount: row.total_check_ins ?? 0,
    localCount: row.local_player_count ?? undefined,
    status: row.is_confirmed == null ? undefined : row.is_confirmed ? "confirmed" : "community",
    imageUri: row.image_url ?? undefined,
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

/**
 * Fetch a single court by UUID. Reads the stats view first so real
 * check-in counts hydrate detail screens; falls back to the base table.
 * Returns null on any error.
 */
export async function fetchCourtById(id: string): Promise<Court | null> {
  try {
    const { data, error } = await supabase
      .from("courts_with_stats")
      .select(STATS_COLS)
      .eq("id", id)
      .maybeSingle();
    if (!error && data) return mapRow(data as unknown as SupabaseCourtRow);

    const { data: base, error: baseError } = await supabase
      .from("courts")
      .select(BASE_COLS)
      .eq("id", id)
      .maybeSingle();
    if (baseError || !base) return null;
    return mapRow(base as SupabaseCourtRow);
  } catch {
    return null;
  }
}

/**
 * Fetch every non-archived court inside a lat/lng bounding box — the map's
 * data source. Plain range filters on (latitude, longitude); no PostGIS
 * needed. Reads the stats view first (live counts), falls back to the base
 * table.
 */
export async function fetchCourtsInBounds(
  swLat: number,
  swLng: number,
  neLat: number,
  neLng: number,
  sport?: CourtSport | "ALL" | null,
  limit = 250
): Promise<Court[]> {
  const applyFilters = <T extends ReturnType<typeof supabase.from>>(q: any) => {
    q = q
      .gte("latitude", swLat)
      .lte("latitude", neLat)
      .gte("longitude", swLng)
      .lte("longitude", neLng)
      .eq("is_archived", false)
      .limit(limit);
    if (sport && sport !== "ALL") q = q.eq("sport_type", sport.toLowerCase());
    return q;
  };
  try {
    const { data, error } = await applyFilters(
      supabase.from("courts_with_stats").select(STATS_COLS)
    );
    if (!error && data) return (data as unknown as SupabaseCourtRow[]).map(mapRow);

    const { data: base, error: baseError } = await applyFilters(
      supabase.from("courts").select(BASE_COLS)
    );
    if (baseError || !base) return [];
    return (base as SupabaseCourtRow[]).map(mapRow);
  } catch {
    return [];
  }
}

/**
 * Fetch up to `limit` courts nearest to the given coordinates.
 *
 * Uses an expanding bounding-box prefilter (±0.5° ≈ 55 km, then ±2.5°) so
 * "nearby" is actually geographic — the old version pulled an arbitrary 300
 * rows of the 5,700-court table and distance-sorted those, which showed
 * Phoenix courts to a Texas user.
 */
export async function fetchNearbyCourts(
  lat: number,
  lng: number,
  sport?: CourtSport | "ALL" | null,
  limit = 20
): Promise<Court[]> {
  try {
    for (const radiusDeg of [0.5, 2.5]) {
      const courts = await fetchCourtsInBounds(
        lat - radiusDeg,
        lng - radiusDeg / Math.max(0.2, Math.cos((lat * Math.PI) / 180)),
        lat + radiusDeg,
        lng + radiusDeg / Math.max(0.2, Math.cos((lat * Math.PI) / 180)),
        sport,
        400
      );
      if (courts.length >= Math.min(limit, 5) || radiusDeg === 2.5) {
        return courts
          .map((c) => ({ ...c, distanceKm: haversineKm(lat, lng, c.latitude, c.longitude) }))
          .sort((a, b) => (a.distanceKm ?? 0) - (b.distanceKm ?? 0))
          .slice(0, limit);
      }
    }
    return [];
  } catch {
    return [];
  }
}

/**
 * Insert a new user-added court into Supabase and return the created Court.
 * Returns null on error (e.g. RLS rejection).
 */
export async function createCourt(
  input: {
    name: string;
    address?: string;
    latitude: number;
    longitude: number;
    sport: CourtSport;
    imageUrl?: string | null;
  },
  userId: string
): Promise<Court | null> {
  try {
    const { data, error } = await supabase
      .from("courts")
      .insert({
        name: input.name,
        address: input.address ?? "",
        latitude: input.latitude,
        longitude: input.longitude,
        sport_type: input.sport.toLowerCase(),
        added_by: userId,
        image_url: input.imageUrl ?? null,
      })
      .select(BASE_COLS)
      .single();
    if (error || !data) return null;
    return mapRow(data as SupabaseCourtRow);
  } catch {
    return null;
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
    // Search the stats view, not the base table: base-table rows carry no
    // count columns, so results would render "EMPTY"/0 locals even for courts
    // with live players (verified against prod 2026-07-16).
    let q = supabase
      .from("courts_with_stats")
      .select(STATS_COLS)
      .eq("is_archived", false)
      .ilike("name", `%${trimmed}%`)
      .limit(limit);

    if (sport && sport !== "ALL") {
      q = q.eq("sport_type", sport.toLowerCase());
    }

    const { data, error } = await q;
    if (!error && data) return ((data as unknown) as SupabaseCourtRow[]).map(mapRow);

    // Fallback to the base table only if the view read failed.
    let q2 = supabase
      .from("courts")
      .select(BASE_COLS)
      .eq("is_archived", false)
      .ilike("name", `%${trimmed}%`)
      .limit(limit);
    if (sport && sport !== "ALL") {
      q2 = q2.eq("sport_type", sport.toLowerCase());
    }
    const { data: base, error: baseError } = await q2;
    if (baseError || !base) return [];
    return (base as SupabaseCourtRow[]).map(mapRow);
  } catch {
    return [];
  }
}
