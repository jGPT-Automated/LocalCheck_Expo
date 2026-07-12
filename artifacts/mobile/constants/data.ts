// ─── Types ────────────────────────────────────────────────────────────────────
// BACKEND NOTE: All types below mirror the REST API response shapes.
// Endpoints are documented inline where relevant.

export type CourtSport = "BASKETBALL" | "PICKLEBALL" | "TENNIS" | "SOCCER" | "VOLLEYBALL";

export const SPORT_ICONS: Record<CourtSport, string> = {
  BASKETBALL: "🏀",
  PICKLEBALL: "🏓",
  TENNIS: "🎾",
  SOCCER: "⚽",
  VOLLEYBALL: "🏐",
};

export interface Player {
  id: string;
  name: string;
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

// BACKEND NOTE: GET /api/v1/courts/:id
export interface Court {
  id: string;
  name: string;
  sport: CourtSport;
  neighborhood: string;
  city: string;
  address: string;
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
  status: CourtStatus;
  localCount?: number;
  addedBy?: string;
  verificationPhoto?: string;
  // Physical court details
  courtCount?: number;      // number of courts / playing surfaces
  hoopCount?: number;       // hoops (basketball/pickleball specific)
  netType?: NetType;        // net material
  rimType?: RimType;        // rim type (basketball)
  waterFountain?: boolean;  // water fountain on site
  addedDate?: string;       // display string e.g. "JAN 2024"
}

// BACKEND NOTE: GET /api/v1/runs/:id
export interface GameRun {
  id: string;
  courtId: string;
  courtName: string;
  sport: CourtSport;
  title: string;
  time: string;
  date: string;
  maxPlayers: number;
  teamA: (Player | null)[];
  teamB: (Player | null)[];
  hostId: string;
  autoBalance: boolean;
  skillLevel: "ALL LEVELS" | "BEGINNER" | "INTERMEDIATE" | "ADVANCED";
}

// BACKEND NOTE: GET /api/v1/feed  |  GET /api/v1/courts/:id/feed
export interface FeedItem {
  id: string;
  type: "checkin" | "run_result" | "new_court" | "run_started";
  playerId: string;
  playerName: string;
  courtName?: string;
  courtId?: string;
  runId?: string;
  sport?: CourtSport;
  message: string;
  timestamp: string;
  hypeCount: number;
  imageUri?: string;
  huped?: boolean;
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

// BACKEND NOTE: GET /api/v1/players/me/matches
export interface MatchResult {
  id: string;
  date: string;
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
    case "PLATINUM": return "#E8E8FF";
    case "GOLD": return "#FFD53D";
    case "SILVER": return "#C8C8D0";
    case "BRONZE": return "#CF8558";
    default: return "#555566";
  }
}

export function getSportColor(sport: CourtSport): string {
  switch (sport) {
    case "BASKETBALL": return "#FF6B35";
    case "PICKLEBALL": return "#00E87A";
    case "TENNIS": return "#FFE135";
    case "SOCCER": return "#4ECDC4";
    case "VOLLEYBALL": return "#A855F7";
  }
}
