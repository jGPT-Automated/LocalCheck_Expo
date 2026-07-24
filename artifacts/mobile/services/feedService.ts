import { CourtSport, FeedItem } from "@/constants/data";
import { supabase } from "@/lib/supabase";

import { mapProfileToPlayer, SupabaseProfile } from "./profileService";

// ─── Backend ──────────────────────────────────────────────────────────────
// Reads LocalCheckProd's `activity_events` table in ONE query. This replaces
// the old 4-query reconstruction (check_ins ×2 + games + scheduled_games) that
// ran on every poll and was a primary contributor to the 2026-07-19 load
// incident. Each event already carries its type + actor + court; match_result
// embeds the match for the score line.

interface SupabaseActivityEvent {
  id: number;
  event_type: string;
  occurred_at: string;
  court_id: string | null;
  visibility: string | null;
  payload: Record<string, unknown> | null;
  actor: SupabaseProfile | null;
  courts: { id: string; name: string; sport_type: string } | null;
  matches: {
    score_a: number;
    score_b: number;
    winner_side: "a" | "b" | null;
    match_participants: Array<{ user_id: string; side: "a" | "b"; profiles: SupabaseProfile | null }>;
  } | null;
}

const EVENT_SELECT =
  "id, event_type, occurred_at, court_id, visibility, payload," +
  " actor:profiles!activity_events_actor_id_fkey(*)," +
  " courts(id, name, sport_type)," +
  " matches(score_a, score_b, winner_side, match_participants(user_id, side, profiles(*)))";

function normalizeSport(raw: string | null | undefined): CourtSport | undefined {
  const upper = (raw ?? "").toUpperCase();
  const valid: CourtSport[] = ["BASKETBALL", "PICKLEBALL", "TENNIS", "SOCCER", "VOLLEYBALL"];
  return valid.includes(upper as CourtSport) ? (upper as CourtSport) : undefined;
}

function formatTimestamp(iso: string): string {
  const d = new Date(iso);
  const diffMin = Math.floor((Date.now() - d.getTime()) / 60000);
  if (diffMin < 1) return "JUST NOW";
  if (diffMin < 60) return `${diffMin} MIN${diffMin === 1 ? "" : "S"} AGO`;
  const diffHrs = Math.floor(diffMin / 60);
  if (diffHrs < 24) return `${diffHrs} HR${diffHrs === 1 ? "" : "S"} AGO`;
  const diffDays = Math.floor(diffHrs / 24);
  if (diffDays < 7) return `${diffDays} DAY${diffDays === 1 ? "" : "S"} AGO`;
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" }).toUpperCase();
}

/** Map one activity_event → FeedItem. Returns null for event types the feed UI doesn't render. */
function mapEvent(row: SupabaseActivityEvent): FeedItem | null {
  const actorName = row.actor?.display_name?.toUpperCase() ?? "SOMEONE";
  const courtName = row.courts?.name?.toUpperCase() ?? "A COURT";
  const sport = normalizeSport(row.courts?.sport_type);
  const base = {
    id: `ae-${row.id}`,
    playerId: row.actor?.id ?? "",
    playerName: actorName,
    courtName: row.courts?.name?.toUpperCase(),
    courtId: row.courts?.id,
    sport,
    timestamp: formatTimestamp(row.occurred_at),
    hypeCount: 0,
  };

  switch (row.event_type) {
    case "check_in":
      return { ...base, type: "checkin", message: `${actorName} CHECKED INTO ${courtName}` };
    case "check_out":
      return { ...base, type: "checkout", message: `${actorName} CHECKED OUT OF ${courtName}` };
    case "run_created":
      return { ...base, type: "run_started", message: `${actorName} STARTED A RUN AT ${courtName}` };
    case "match_result": {
      const m = row.matches;
      if (!m || !m.winner_side) return null;
      const winner = m.match_participants?.find((p) => p.side === m.winner_side);
      const loser = m.match_participants?.find((p) => p.side !== m.winner_side);
      const winnerName = winner?.profiles
        ? mapProfileToPlayer(winner.profiles).name.toUpperCase()
        : actorName;
      const loserName = loser?.profiles
        ? mapProfileToPlayer(loser.profiles).name.toUpperCase()
        : "OPPONENT";
      const winnerScore = m.winner_side === "b" ? m.score_b : m.score_a;
      const loserScore = m.winner_side === "b" ? m.score_a : m.score_b;
      return {
        ...base,
        type: "game_result",
        message: `${winnerName} DEF. ${loserName} ${winnerScore}–${loserScore}`,
        winnerName,
      };
    }
    default:
      // run_joined / run_left / planned_visit_created — not surfaced in the feed UI yet.
      return null;
  }
}

// ─── Public API ─────────────────────────────────────────────────────────────

export async function fetchFeed(courtId?: string): Promise<FeedItem[]> {
  try {
    let q = supabase
      .from("activity_events")
      .select(EVENT_SELECT)
      .order("occurred_at", { ascending: false })
      .limit(50);
    if (courtId) q = q.eq("court_id", courtId);

    const { data, error } = await q;
    if (error || !data) {
      if (error) console.warn("fetchFeed error:", error.message);
      return [];
    }
    return (data as unknown as SupabaseActivityEvent[])
      .map(mapEvent)
      .filter((i): i is FeedItem => i !== null);
  } catch (err) {
    console.warn("fetchFeed exception:", err);
    return [];
  }
}

/** Like an activity event (best-effort; UI updates optimistically). */
export async function hypePost(postId: string, userId: string): Promise<void> {
  const eventId = Number(postId.replace(/^ae-/, ""));
  if (!Number.isFinite(eventId)) return;
  try {
    await supabase
      .from("activity_event_likes")
      .insert({ activity_event_id: eventId, user_id: userId });
  } catch {
    // Best-effort; UI already optimistically updates
  }
}
