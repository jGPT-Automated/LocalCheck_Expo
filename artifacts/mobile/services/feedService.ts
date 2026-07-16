import { CourtSport, FeedItem } from "@/constants/data";
import { supabase } from "@/lib/supabase";

import { mapProfileToPlayer, SupabaseProfile } from "./profileService";

// ─── Types ──────────────────────────────────────────────────────────────────

interface SupabaseCheckIn {
  id: string;
  user_id: string;
  court_id: string;
  note: string | null;
  checked_in_at: string;
  checked_out_at: string | null;
  visibility: string | null;
  profiles: SupabaseProfile | null;
  courts: { id: string; name: string; sport_type: string } | null;
}

interface SupabaseGame {
  id: string;
  court_id: string;
  created_by: string;
  played_at: string;
  score_a: number;
  score_b: number;
  winner_side: "a" | "b" | null;
  notes: string | null;
  courts: { id: string; name: string; sport_type: string } | null;
  game_participants: Array<{
    user_id: string;
    team_side: "a" | "b";
    profiles: SupabaseProfile | null;
  }>;
}

interface SupabaseScheduledGame {
  id: string;
  court_id: string;
  organizer_id: string;
  title: string;
  start_time: string;
  courts: { id: string; name: string; sport_type: string } | null;
  organizer: SupabaseProfile | null;
}

function normalizeSport(raw: string | null | undefined): CourtSport | undefined {
  const upper = (raw ?? "").toUpperCase();
  const valid: CourtSport[] = ["BASKETBALL", "PICKLEBALL", "TENNIS", "SOCCER", "VOLLEYBALL"];
  return valid.includes(upper as CourtSport) ? (upper as CourtSport) : undefined;
}

function formatTimestamp(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return "JUST NOW";
  if (diffMin < 60) return `${diffMin} MIN${diffMin === 1 ? "" : "S"} AGO`;
  const diffHrs = Math.floor(diffMin / 60);
  if (diffHrs < 24) return `${diffHrs} HR${diffHrs === 1 ? "" : "S"} AGO`;
  const diffDays = Math.floor(diffHrs / 24);
  if (diffDays < 7) return `${diffDays} DAY${diffDays === 1 ? "" : "S"} AGO`;
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" }).toUpperCase();
}

function toFeedItem(
  id: string,
  type: FeedItem["type"],
  player: SupabaseProfile | null,
  court: { id: string; name: string; sport_type: string } | null,
  message: string,
  timestamp: string,
  sport?: CourtSport
): FeedItem {
  const playerName = player?.display_name?.toUpperCase() ?? "SOMEONE";
  return {
    id,
    type,
    playerId: player?.id ?? "",
    playerName,
    courtName: court?.name?.toUpperCase(),
    courtId: court?.id,
    sport: sport ?? normalizeSport(court?.sport_type),
    message,
    timestamp: formatTimestamp(timestamp),
    hypeCount: 0,
  };
}

// ─── Public API ─────────────────────────────────────────────────────────────

export async function fetchFeed(courtId?: string): Promise<FeedItem[]> {
  try {
    const limit = 50;
    const now = new Date().toISOString();

    // Check-ins
    let checkInQ = supabase
      .from("check_ins")
      .select("id, user_id, court_id, checked_in_at, visibility, profiles(*), courts(id, name, sport_type)")
      .order("checked_in_at", { ascending: false })
      .limit(limit);
    if (courtId) checkInQ = checkInQ.eq("court_id", courtId);

    const { data: checkIns, error: checkInError } = await checkInQ;
    if (checkInError) console.warn("feed check_ins error:", checkInError.message);

    // Checkouts (check_ins rows that have been closed out)
    let checkOutQ = supabase
      .from("check_ins")
      .select("id, user_id, court_id, checked_in_at, checked_out_at, visibility, profiles(*), courts(id, name, sport_type)")
      .not("checked_out_at", "is", null)
      .order("checked_out_at", { ascending: false })
      .limit(limit);
    if (courtId) checkOutQ = checkOutQ.eq("court_id", courtId);

    const { data: checkOuts, error: checkOutError } = await checkOutQ;
    if (checkOutError) console.warn("feed checkouts error:", checkOutError.message);

    // Games (results)
    let gamesQ = supabase
      .from("games")
      .select("id, court_id, played_at, score_a, score_b, winner_side, courts(id, name, sport_type), game_participants(user_id, team_side, profiles(*))")
      .order("played_at", { ascending: false })
      .limit(limit);
    if (courtId) gamesQ = gamesQ.eq("court_id", courtId);

    const { data: games, error: gamesError } = await gamesQ;
    if (gamesError) console.warn("feed games error:", gamesError.message);

    // Scheduled games (runs started)
    let runsQ = supabase
      .from("scheduled_games")
      .select("id, court_id, organizer_id, title, start_time, courts(id, name, sport_type), organizer:profiles!scheduled_games_organizer_id_fkey(*)")
      .gte("start_time", now)
      .order("start_time", { ascending: true })
      .limit(limit);
    if (courtId) runsQ = runsQ.eq("court_id", courtId);

    const { data: runs, error: runsError } = await runsQ;
    if (runsError) console.warn("feed runs error:", runsError.message);

    // Keep the raw ISO timestamp alongside each item so the merged list can be
    // sorted properly (FeedItem.timestamp is a display string like "3 MINS AGO").
    const items: Array<{ item: FeedItem; at: string }> = [];

    for (const row of (checkIns as unknown as SupabaseCheckIn[]) ?? []) {
      if (!row.profiles) continue;
      const player = mapProfileToPlayer(row.profiles);
      items.push({
        at: row.checked_in_at,
        item: toFeedItem(
          `checkin-${row.id}`,
          "checkin",
          row.profiles,
          row.courts,
          `${player.name.toUpperCase()} CHECKED INTO ${row.courts?.name?.toUpperCase() ?? "A COURT"}`,
          row.checked_in_at,
          normalizeSport(row.courts?.sport_type)
        ),
      });
    }

    for (const row of (checkOuts as unknown as SupabaseCheckIn[]) ?? []) {
      if (!row.profiles || !row.checked_out_at) continue;
      const player = mapProfileToPlayer(row.profiles);
      items.push({
        at: row.checked_out_at,
        item: toFeedItem(
          `checkout-${row.id}`,
          "checkout",
          row.profiles,
          row.courts,
          `${player.name.toUpperCase()} CHECKED OUT OF ${row.courts?.name?.toUpperCase() ?? "A COURT"}`,
          row.checked_out_at,
          normalizeSport(row.courts?.sport_type)
        ),
      });
    }

    for (const row of (games as unknown as SupabaseGame[]) ?? []) {
      if (!row.winner_side) continue;
      const winner = row.game_participants?.find((p) => p.team_side === row.winner_side);
      const loser = row.game_participants?.find((p) => p.team_side !== row.winner_side);
      if (!winner?.profiles) continue;
      const winnerPlayer = mapProfileToPlayer(winner.profiles);
      const winnerName = winnerPlayer.name.toUpperCase();
      const loserName = loser?.profiles
        ? mapProfileToPlayer(loser.profiles).name.toUpperCase()
        : "OPPONENT";
      const winnerScore = row.winner_side === "b" ? row.score_b : row.score_a;
      const loserScore = row.winner_side === "b" ? row.score_a : row.score_b;
      const gameItem = toFeedItem(
        `game-${row.id}`,
        "game_result",
        winner.profiles,
        row.courts,
        `${winnerName} DEF. ${loserName} ${winnerScore}–${loserScore}`,
        row.played_at,
        normalizeSport(row.courts?.sport_type)
      );
      gameItem.winnerName = winnerName;
      items.push({ at: row.played_at, item: gameItem });
    }

    for (const row of (runs as unknown as SupabaseScheduledGame[]) ?? []) {
      if (!row.organizer) continue;
      const player = mapProfileToPlayer(row.organizer);
      items.push({
        at: row.start_time,
        item: toFeedItem(
          `run-${row.id}`,
          "run_started",
          row.organizer,
          row.courts,
          `${player.name.toUpperCase()} STARTED A RUN AT ${row.courts?.name?.toUpperCase() ?? "A COURT"}`,
          row.start_time,
          normalizeSport(row.courts?.sport_type)
        ),
      });
    }

    return items
      .sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime())
      .slice(0, limit)
      .map((entry) => entry.item);
  } catch (err) {
    console.warn("fetchFeed exception:", err);
    return [];
  }
}

export async function hypePost(postId: string, userId: string): Promise<void> {
  try {
    await supabase.from("feed_post_likes").insert({ post_id: postId, user_id: userId });
  } catch {
    // Best-effort; UI already optimistically updates
  }
}
