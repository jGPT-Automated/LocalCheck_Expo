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
  maxCapacity: number;
  rating: number;
  ratingCount: number;
  surface: string;
  lights: boolean;
  covered: boolean;
  imageUri?: string;
  status: CourtStatus;
  localCount: number;
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

// BACKEND NOTE: GET /api/v1/players/me/matches
export interface MatchResult {
  id: string;
  date: string;
  courtName: string;
  sport: CourtSport;
  result: "WIN" | "LOSS";
  eloDelta: number;
  teamScore: string;
  opposingScore: string;
}

// ─── Sample Data ──────────────────────────────────────────────────────────────

export const SAMPLE_PLAYERS: Player[] = [
  { id: "p1", name: "Marcus J.", elo: 1652, tier: "SILVER", avatar: "MJ", wins: 42, losses: 18, checkIns: 87, sport: "BASKETBALL", courtId: "c1", memberSince: "2024-01-15", visibility: "public", isLocalPlus: true },
  { id: "p2", name: "Dre K.", elo: 1820, tier: "GOLD", avatar: "DK", wins: 61, losses: 22, checkIns: 134, sport: "BASKETBALL", courtId: "c3", memberSince: "2023-08-22", visibility: "public", isLocalPlus: true },
  { id: "p3", name: "Zara M.", elo: 1445, tier: "BRONZE", avatar: "ZM", wins: 28, losses: 31, checkIns: 55, sport: "PICKLEBALL", courtId: "c4", memberSince: "2025-02-10", visibility: "public", isLocalPlus: false },
  { id: "p4", name: "Tyler B.", elo: 1550, tier: "SILVER", avatar: "TB", wins: 35, losses: 25, checkIns: 62, sport: "BASKETBALL", courtId: "c1", memberSince: "2024-06-01", visibility: "public", isLocalPlus: false },
  { id: "p5", name: "Keisha P.", elo: 1930, tier: "PLATINUM", avatar: "KP", wins: 78, losses: 14, checkIns: 201, sport: "PICKLEBALL", courtId: "c4", memberSince: "2023-03-15", visibility: "public", isLocalPlus: true },
  { id: "p6", name: "Jay R.", elo: 1380, tier: "BRONZE", avatar: "JR", wins: 19, losses: 29, checkIns: 44, sport: "BASKETBALL", courtId: "c3", memberSince: "2025-01-05", visibility: "friends", isLocalPlus: false },
  { id: "p7", name: "Sam T.", elo: 1710, tier: "GOLD", avatar: "ST", wins: 53, losses: 19, checkIns: 110, sport: "PICKLEBALL", courtId: "c6", memberSince: "2024-04-20", visibility: "public", isLocalPlus: true },
  { id: "p8", name: "Nadia V.", elo: 1490, tier: "BRONZE", avatar: "NV", wins: 22, losses: 26, checkIns: 39, sport: "BASKETBALL", courtId: "c2", memberSince: "2025-03-01", visibility: "private", isLocalPlus: false },
];

export const SAMPLE_COURTS: Court[] = [
  {
    id: "c1",
    name: "Rucker Park",
    sport: "BASKETBALL",
    neighborhood: "Harlem",
    city: "New York",
    address: "W 155th & 8th Ave, Harlem, NY",
    latitude: 40.8304,
    longitude: -73.9318,
    activeCount: 12,
    maxCapacity: 20,
    rating: 4.9,
    ratingCount: 847,
    surface: "ASPHALT",
    lights: true,
    covered: false,
    status: "community",
    localCount: 24,
    courtCount: 2,
    hoopCount: 4,
    netType: "CHAIN",
    rimType: "DOUBLE",
    waterFountain: true,
    addedDate: "MAR 2023",
  },
  {
    id: "c2",
    name: "Venice Beach Courts",
    sport: "BASKETBALL",
    neighborhood: "Venice",
    city: "Los Angeles",
    address: "1800 Ocean Front Walk, Venice, CA",
    latitude: 33.985,
    longitude: -118.4695,
    activeCount: 8,
    maxCapacity: 15,
    rating: 4.7,
    ratingCount: 512,
    surface: "ASPHALT",
    lights: false,
    covered: false,
    status: "community",
    localCount: 11,
    courtCount: 3,
    hoopCount: 6,
    netType: "CHAIN",
    rimType: "SINGLE",
    waterFountain: false,
    addedDate: "JUN 2023",
  },
  {
    id: "c3",
    name: "The Cage",
    sport: "BASKETBALL",
    neighborhood: "West Village",
    city: "New York",
    address: "W 4th & 6th Ave, New York, NY",
    latitude: 40.7303,
    longitude: -74.0021,
    activeCount: 3,
    maxCapacity: 10,
    rating: 4.8,
    ratingCount: 633,
    surface: "CONCRETE",
    lights: false,
    covered: false,
    status: "confirmed",
    localCount: 4,
    courtCount: 1,
    hoopCount: 2,
    netType: "METAL",
    rimType: "DOUBLE",
    waterFountain: false,
    addedDate: "NOV 2023",
  },
  {
    id: "c4",
    name: "Eastside Pickleball",
    sport: "PICKLEBALL",
    neighborhood: "East Austin",
    city: "Austin",
    address: "2100 E 6th St, Austin, TX",
    latitude: 30.2607,
    longitude: -97.7187,
    activeCount: 6,
    maxCapacity: 12,
    rating: 4.6,
    ratingCount: 289,
    surface: "HARDCOURT",
    lights: true,
    covered: false,
    status: "confirmed",
    localCount: 3,
    courtCount: 4,
    hoopCount: 0,
    netType: "NYLON",
    waterFountain: true,
    addedDate: "JAN 2024",
  },
  {
    id: "c5",
    name: "Mission Playground",
    sport: "BASKETBALL",
    neighborhood: "Mission District",
    city: "San Francisco",
    address: "19th & Valencia, Mission, SF",
    latitude: 37.7601,
    longitude: -122.4195,
    activeCount: 0,
    maxCapacity: 10,
    rating: 4.3,
    ratingCount: 177,
    surface: "ASPHALT",
    lights: true,
    covered: false,
    status: "confirmed",
    localCount: 2,
    courtCount: 1,
    hoopCount: 2,
    netType: "CHAIN",
    rimType: "SINGLE",
    waterFountain: true,
    addedDate: "FEB 2024",
  },
  {
    id: "c6",
    name: "Millennium Park PB",
    sport: "PICKLEBALL",
    neighborhood: "The Loop",
    city: "Chicago",
    address: "Millennium Park, Chicago, IL",
    latitude: 41.8827,
    longitude: -87.6233,
    activeCount: 9,
    maxCapacity: 16,
    rating: 4.5,
    ratingCount: 341,
    surface: "HARDCOURT",
    lights: true,
    covered: false,
    status: "community",
    localCount: 8,
    courtCount: 6,
    hoopCount: 0,
    netType: "NYLON",
    waterFountain: true,
    addedDate: "APR 2024",
  },
];

export const SAMPLE_RUNS: GameRun[] = [
  {
    id: "r1",
    courtId: "c1",
    courtName: "Rucker Park",
    sport: "BASKETBALL",
    title: "5v5 FULL COURT",
    time: "18:00",
    date: "TODAY",
    maxPlayers: 10,
    teamA: [SAMPLE_PLAYERS[0], SAMPLE_PLAYERS[1], null, null, null],
    teamB: [SAMPLE_PLAYERS[2], SAMPLE_PLAYERS[3], null, null, null],
    hostId: "p1",
    autoBalance: false,
    skillLevel: "INTERMEDIATE",
  },
  {
    id: "r2",
    courtId: "c4",
    courtName: "Eastside Pickleball",
    sport: "PICKLEBALL",
    title: "DOUBLES OPEN PLAY",
    time: "09:00",
    date: "TOMORROW",
    maxPlayers: 8,
    teamA: [SAMPLE_PLAYERS[4], SAMPLE_PLAYERS[6], null, null],
    teamB: [null, null, null, null],
    hostId: "p5",
    autoBalance: true,
    skillLevel: "ALL LEVELS",
  },
  {
    id: "r3",
    courtId: "c3",
    courtName: "The Cage",
    sport: "BASKETBALL",
    title: "3v3 HALF COURT",
    time: "20:00",
    date: "TODAY",
    maxPlayers: 6,
    teamA: [SAMPLE_PLAYERS[5], null, null],
    teamB: [SAMPLE_PLAYERS[7], null, null],
    hostId: "p6",
    autoBalance: false,
    skillLevel: "ADVANCED",
  },
];

export const SAMPLE_FEED: FeedItem[] = [
  {
    id: "f1",
    type: "checkin",
    playerId: "p1",
    playerName: "MARCUS J.",
    courtName: "RUCKER PARK",
    courtId: "c1",
    sport: "BASKETBALL",
    message: "MARCUS J. CHECKED INTO RUCKER PARK",
    timestamp: "2 MINS AGO",
    hypeCount: 32,
  },
  {
    id: "f2",
    type: "run_result",
    playerId: "p5",
    playerName: "KEISHA P.",
    courtName: "EASTSIDE PICKLEBALL",
    courtId: "c4",
    sport: "PICKLEBALL",
    message: "KEISHA P. WON DOUBLES RUN — +22 ELO",
    timestamp: "14 MINS AGO",
    hypeCount: 87,
  },
  {
    id: "f3",
    type: "run_started",
    playerId: "p2",
    playerName: "DRE K.",
    courtName: "THE CAGE",
    courtId: "c3",
    sport: "BASKETBALL",
    message: "DRE K. STARTED A 3v3 RUN AT THE CAGE",
    timestamp: "31 MINS AGO",
    hypeCount: 41,
  },
  {
    id: "f4",
    type: "checkin",
    playerId: "p7",
    playerName: "SAM T.",
    courtName: "MILLENNIUM PARK PB",
    courtId: "c6",
    sport: "PICKLEBALL",
    message: "SAM T. CHECKED INTO MILLENNIUM PARK PB",
    timestamp: "1 HR AGO",
    hypeCount: 18,
  },
  {
    id: "f5",
    type: "run_result",
    playerId: "p3",
    playerName: "ZARA M.",
    courtName: "RUCKER PARK",
    courtId: "c1",
    sport: "BASKETBALL",
    message: "ZARA M. LOST A 5v5 RUN — -8 ELO",
    timestamp: "2 HRS AGO",
    hypeCount: 6,
  },
  {
    id: "f6",
    type: "new_court",
    playerId: "p4",
    playerName: "TYLER B.",
    courtName: "EASTSIDE PICKLEBALL",
    courtId: "c4",
    sport: "PICKLEBALL",
    message: "TYLER B. ADDED EASTSIDE PICKLEBALL",
    timestamp: "3 HRS AGO",
    hypeCount: 54,
  },
];

export const SAMPLE_MATCHES: MatchResult[] = [
  { id: "m1", date: "MAR 28", courtName: "RUCKER PARK", sport: "BASKETBALL", result: "WIN", eloDelta: 15, teamScore: "21", opposingScore: "14" },
  { id: "m2", date: "MAR 26", courtName: "THE CAGE", sport: "BASKETBALL", result: "LOSS", eloDelta: -12, teamScore: "11", opposingScore: "21" },
  { id: "m3", date: "MAR 24", courtName: "EASTSIDE PB", sport: "PICKLEBALL", result: "WIN", eloDelta: 18, teamScore: "11", opposingScore: "7" },
  { id: "m4", date: "MAR 22", courtName: "RUCKER PARK", sport: "BASKETBALL", result: "WIN", eloDelta: 12, teamScore: "21", opposingScore: "9" },
  { id: "m5", date: "MAR 20", courtName: "MISSION PARK", sport: "BASKETBALL", result: "LOSS", eloDelta: -8, teamScore: "15", opposingScore: "21" },
];

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
