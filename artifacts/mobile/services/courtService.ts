import { Court, CourtSport } from "@/constants/data";
import { supabase } from "@/lib/supabase";

// Columns that actually exist in the `courts` table
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
  // courts_with_stats may add these
  active_check_in_count?: number | null;
  total_check_ins?: number | null;
}

function normalizeSport(raw: string | null | undefined): CourtSport {
  const upper = (raw ?? "").toUpperCase();
  const valid: CourtSport[] = ["BASKETBALL", "PICKLEBALL", "TENNIS", "SOCCER", "VOLLEYBALL"];
  return valid.includes(upper as CourtSport) ? (upper as CourtSport) : "BASKETBALL";
}

const COURT_COLUMNS =
  "id,name,address,latitude,longitude,sport_type,image_url,is_archived,location,state,added_by,created_at";

const STATS_COLUMNS =
  "id,name,address,latitude,longitude,sport_type,image_url,is_archived,location,state,added_by,created_at,active_check_in_count,total_check_ins";

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
    addedDate: row.created_at ?? undefined,
  };
}

/**
 * Fetch courts from Supabase.
 * Tries `courts_with_stats` view first (has live player counts), falls back to `courts` table.
 * Excludes archived courts. Returns null only on a hard error so the caller can decide.
 */
export async function fetchCourtsFromSupabase(): Promise<Court[] | null> {
  try {
    // Try the enriched view first
    const { data: viewData, error: viewError } = await supabase
      .from("courts_with_stats")
      .select(STATS_COLUMNS)
      .eq("is_archived", false)
      .limit(500);

    if (!viewError && viewData && viewData.length > 0) {
      return (viewData as SupabaseCourtRow[]).map(mapRow);
    }

    // Fall back to base courts table
    const { data, error } = await supabase
      .from("courts")
      .select(COURT_COLUMNS)
      .eq("is_archived", false)
      .limit(500);

    if (error || !data || data.length === 0) return null;
    return (data as SupabaseCourtRow[]).map(mapRow);
  } catch {
    return null;
  }
}
