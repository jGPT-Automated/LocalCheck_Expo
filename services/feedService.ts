import { CourtSport, FeedItem } from "@/constants/data";
import { supabase } from "@/lib/supabase";

import { mapProfileToPlayer, SupabaseProfile } from "./profileService";
import { formatLegacyFeedResult, summarizeActivityHype } from "./feedModel";

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
  activity_event_likes: Array<{ user_id: string }> | null;
  actor: SupabaseProfile | null;
  courts: { id: string; name: string; sport_type: string } | null;
  matches: {
    id: string;
    played_at: string;
    score_a: number;
    score_b: number;
    winner_side: "a" | "b" | null;
    status: "pending" | "held" | "confirmed" | "voided" | "rejected";
    match_participants: Array<{
      user_id: string;
      side: "a" | "b";
      display_order: number;
      profiles: SupabaseProfile | null;
    }>;
  } | null;
}

const EVENT_SELECT =
  "id, event_type, occurred_at, court_id, visibility, payload," +
  " activity_event_likes(user_id)," +
  " actor:profiles!activity_events_actor_id_fkey(*)," +
  " courts(id, name, sport_type)," +
  " matches(id, played_at, score_a, score_b, winner_side, status," +
  " match_participants(user_id, side, display_order, profiles(*)))";

function normalizeSport(
  raw: string | null | undefined,
): CourtSport | undefined {
  const upper = (raw ?? "").toUpperCase();
  const valid: CourtSport[] = [
    "BASKETBALL",
    "PICKLEBALL",
    "TENNIS",
    "SOCCER",
    "VOLLEYBALL",
  ];
  return valid.includes(upper as CourtSport)
    ? (upper as CourtSport)
    : undefined;
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
  return d
    .toLocaleDateString("en-US", { month: "short", day: "numeric" })
    .toUpperCase();
}

/** Map one activity_event → FeedItem. Returns null for event types the feed UI doesn't render. */
function mapEvent(
  row: SupabaseActivityEvent,
  currentUserId?: string | null,
): FeedItem | null {
  const actorName = row.actor?.display_name ?? "Someone";
  const courtName = row.courts?.name ?? "a court";
  const sport = normalizeSport(row.courts?.sport_type);
  const base = {
    id: `ae-${row.id}`,
    playerId: row.actor?.id ?? "",
    playerName: actorName,
    courtName: row.courts?.name,
    courtId: row.courts?.id,
    sport,
    timestamp: formatTimestamp(row.occurred_at),
    ...summarizeActivityHype(row.activity_event_likes, currentUserId),
  };

  switch (row.event_type) {
    case "check_in":
      return {
        ...base,
        type: "checkin",
        message: `${actorName} CHECKED INTO ${courtName}`,
      };
    case "check_out":
      return {
        ...base,
        type: "checkout",
        message: `${actorName} CHECKED OUT OF ${courtName}`,
      };
    case "run_created":
      return {
        ...base,
        type: "run_started",
        message: `${actorName} SCHEDULED A GAME AT ${courtName}`,
      };
    case "match_result": {
      const m = row.matches;
      if (!m || !m.winner_side || m.status !== "confirmed") return null;
      const participants = (m.match_participants ?? [])
        .map((participant) => ({
          playerId: participant.user_id,
          name: participant.profiles
            ? mapProfileToPlayer(participant.profiles).name
            : "Player",
          side: participant.side,
          displayOrder: participant.display_order,
        }))
        .sort((a, b) => a.displayOrder - b.displayOrder);
      const sideA = participants.filter((participant) => participant.side === "a");
      const sideB = participants.filter((participant) => participant.side === "b");
      const winnerName = (m.winner_side === "a" ? sideA : sideB)
        .map((participant) => participant.name)
        .join(" + ");
      return {
        ...base,
        type: "game_result",
        message: formatLegacyFeedResult({
          sideA,
          sideB,
          scoreA: m.score_a,
          scoreB: m.score_b,
          winnerSide: m.winner_side,
        }),
        winnerName,
        match: {
          id: m.id,
          playedAt: m.played_at,
          scoreA: m.score_a,
          scoreB: m.score_b,
          winnerSide: m.winner_side,
          status: "confirmed",
          sideA,
          sideB,
        },
      };
    }
    default:
      // run_joined / run_left / planned_visit_created — not surfaced in the feed UI yet.
      return null;
  }
}

// ─── Public API ─────────────────────────────────────────────────────────────

export async function fetchFeed(
  courtId?: string,
  currentUserId?: string | null,
): Promise<FeedItem[]> {
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
      .map((row) => mapEvent(row, currentUserId))
      .filter((i): i is FeedItem => i !== null);
  } catch (err) {
    console.warn("fetchFeed exception:", err);
    return [];
  }
}

/** Persist one hype per user. Duplicate taps converge to the existing row. */
export async function hypePost(postId: string, userId: string): Promise<boolean> {
  const eventId = Number(postId.replace(/^ae-/, ""));
  if (!Number.isFinite(eventId)) return false;
  try {
    const { error } = await supabase
      .from("activity_event_likes")
      .insert({ activity_event_id: eventId, user_id: userId });
    if (error && error.code !== "23505") {
      console.warn("hypePost failed:", error.message);
      return false;
    }
    return true;
  } catch {
    return false;
  }
}
