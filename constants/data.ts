import { Colors } from "@/constants/colors";

// Shared UI/domain types. Supabase mapping stays in services/ so components do
// not depend on database row shapes.

export type CourtSport =
  | "BASKETBALL"
  | "PICKLEBALL"
  | "TENNIS"
  | "SOCCER"
  | "VOLLEYBALL";

export interface Player {
  id: string;
  name: string;
  username?: string;
  elo: number;
  tier: EloTier;
  avatar: string;
  wins: number;
  losses: number;
  checkIns: number;
  sport?: CourtSport;
  courtId?: string;
  memberSince: string; // ISO date
  visibility?: "public" | "friends" | "private";
  isLocalPlus?: boolean;
  friendIds?: string[];
}

export type EloTier = "PLATINUM" | "GOLD" | "SILVER" | "BRONZE" | "UNRANKED";

export type CourtStatus = "pending" | "confirmed" | "community";

export type NetType = "CHAIN" | "NYLON" | "METAL";
export type RimType = "SINGLE" | "DOUBLE";

export interface Court {
  id: string;
  name: string;
  shortName?: string;
  sport: CourtSport;
  neighborhood: string;
  city: string;
  address: string;
  /** Canonical Supabase market name (for example, "Houston"). */
  market?: string;
  latitude: number;
  longitude: number;
  activeCount: number;
  // Attribute fields below are optional: the live courts table does not store
  // them. Only render them when a real value exists — never invent defaults.
  maxCapacity?: number;
  rating?: number;
  ratingCount?: number;
  surface?: string;
  lights?: boolean;
  covered?: boolean;
  imageUri?: string;
  // Set by fetchNearbyCourts from device GPS at fetch time; absent on search
  // results and direct fetches. Render nothing when absent.
  distanceKm?: number;
  // Not stored in the live courts table — only set for user-added courts that
  // went through the in-app verification flow. Render nothing when absent.
  status?: CourtStatus;
  localCount?: number;
  addedBy?: string;
  verificationPhoto?: string;
  // Physical court details
  courtCount?: number; // number of courts / playing surfaces
  hoopCount?: number; // hoops (basketball/pickleball specific)
  netType?: NetType; // net material
  rimType?: RimType; // rim type (basketball)
  waterFountain?: boolean; // water fountain on site
  addedDate?: string; // display string e.g. "JAN 2024"
}

// The DB models RSVP only (going/waitlist/declined) — there is no persisted
// team assignment, so runs expose a single participant list. Do not present
// client-side team splits as authoritative.
export interface GameRun {
  id: string;
  courtId: string;
  courtName: string;
  sport: CourtSport;
  title: string;
  time: string;
  date: string;
  startTimeIso: string;
  maxPlayers: number;
  participants: Player[];
  hostId: string;
  hostName?: string;
  status: string;
  resultMatchId?: string;
  skillLevel: "ALL LEVELS" | "BEGINNER" | "INTERMEDIATE" | "ADVANCED";
}

export interface FeedItem {
  id: string;
  type:
    | "checkin"
    | "checkout"
    | "game_result"
    | "run_result"
    | "new_court"
    | "run_started";
  playerId: string;
  playerName: string;
  courtName?: string;
  courtId?: string;
  runId?: string;
  sport?: CourtSport;
  message: string;
  /** Winner display name for game_result items — used to tint the name with Colors.win. */
  winnerName?: string;
  /** Structured, authoritative result data for confirmed match events. */
  match?: FeedMatchSummary;
  timestamp: string;
  hypeCount: number;
  hypedByCurrentUser?: boolean;
  imageUri?: string;
}

export interface FeedMatchParticipant {
  playerId: string;
  name: string;
  side: "a" | "b";
  displayOrder: number;
}

export interface FeedMatchSummary {
  id: string;
  playedAt: string;
  scoreA: number;
  scoreB: number;
  winnerSide: "a" | "b";
  status: "confirmed";
  sideA: FeedMatchParticipant[];
  sideB: FeedMatchParticipant[];
}

// BACKEND NOTE: public.planned_visits — planned presence ("pulling up").
// A user posts times they plan to be at a court; everyone can see who's
// coming before they head over. Not a run: no title/capacity/RSVP.
export interface PlannedVisit {
  id: string;
  userId: string;
  player: Player;
  courtId: string;
  courtName: string;
  sport: CourtSport;
  plannedAtIso: string;
  time: string; // formatted HH:MM
  date: string; // formatted TODAY / TOMORROW / JUL 15
  note?: string;
}

export type GameType = "1v1" | "2v2" | "3v3" | "4v4" | "5v5" | "TwentyOne";

export const GAME_TYPE_LABELS: Record<GameType, string> = {
  "1v1": "1v1",
  "2v2": "2v2",
  "3v3": "3v3",
  "4v4": "4v4",
  "5v5": "5v5",
  TwentyOne: "TwentyOne",
};

export interface MatchResult {
  id: string;
  date: string;
  /** Authoritative timestamp used whenever a full date must be rendered. */
  playedAtIso: string;
  courtName: string;
  sport: CourtSport;
  gameType?: GameType;
  result: "WIN" | "LOSS";
  // Per-game Elo change. The live DB does not store this per game (log_game
  // applies it to profiles only), so it is usually absent — render "—" then.
  eloDelta?: number;
  teamScore: string;
  opposingScore: string;
}

// ─── Utilities ────────────────────────────────────────────────────────────────

export function getEloTier(elo: number): EloTier {
  if (elo >= 1900) return "PLATINUM";
  if (elo >= 1700) return "GOLD";
  if (elo >= 1500) return "SILVER";
  if (elo > 0) return "BRONZE";
  return "UNRANKED";
}

export function getTierColor(tier: EloTier | string): string {
  switch (tier) {
    case "PLATINUM":
      return Colors.tier.platinum;
    case "GOLD":
      return Colors.tier.gold;
    case "SILVER":
      return Colors.tier.silver;
    case "BRONZE":
      return Colors.tier.bronze;
    default:
      return Colors.mutedDark;
  }
}

export function getSportColor(sport: CourtSport): string {
  switch (sport) {
    case "BASKETBALL":
      return Colors.basketballMeta;
    case "PICKLEBALL":
      return Colors.pickleballMeta;
    case "TENNIS":
      return "#FFE135";
    case "SOCCER":
      return "#4ECDC4";
    case "VOLLEYBALL":
      return "#A855F7";
  }
}

/**
 * Court identity art uses a quieter blue/green system while orange remains
 * reserved for live state and primary actions.
 */
export function getCourtIdentityColor(sport: CourtSport): string {
  switch (sport) {
    case "BASKETBALL":
      return Colors.basketballMeta;
    case "PICKLEBALL":
      return Colors.pickleballMeta;
    case "TENNIS":
      return "#D4C75A";
    case "SOCCER":
      return "#57B8B2";
    case "VOLLEYBALL":
      return "#A477D3";
  }
}
