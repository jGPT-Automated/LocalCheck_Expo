import * as Location from "expo-location";
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  Court,
  CourtSport,
  FeedItem,
  GameRun,
  MatchResult,
  Player,
  getEloTier,
} from "@/constants/data";
import { checkInToCourt, checkOutOfCourt, fetchActiveCheckIns, fetchCheckedInCourtId } from "@/services/checkInService";
import { addFriend, fetchFriends, removeFriend } from "@/services/friendshipService";
import { fetchFeed } from "@/services/feedService";
import { fetchGamesByPlayer } from "@/services/gameService";
import { fetchScheduledGames, joinScheduledGame } from "@/services/scheduledGameService";
import { createCourt, fetchCourtById, fetchNearbyCourts } from "@/services/courtService";
import { fetchLocals, updateLocalCourtId, updateProfileFields } from "@/services/profileService";
import { useAuth } from "@/context/AuthContext";

const LA_FALLBACK = { lat: 34.0522, lng: -118.2437 };

export type Visibility = "public" | "friends" | "private";

interface AppContextValue {
  currentUser: Player;
  courts: Court[];
  checkedInCourtId: string | null;
  lastVisitedCourtId: string | null;
  localCourtId: string | null;
  localCourt: Court | null;
  runs: GameRun[];
  feed: FeedItem[];
  matches: MatchResult[];
  isLocalPlus: boolean;
  visibility: Visibility;
  friendIds: string[];
  preferredSport: CourtSport | null;
  preferredCourtId: string | null;
  checkIn: (courtId: string) => Promise<void>;
  checkOut: () => Promise<void>;
  visitCourt: (courtId: string) => Promise<void>;
  joinRun: (runId: string, team: "A" | "B") => void;
  hypeItem: (feedId: string) => void;
  addCourt: (court: Court) => Promise<void>;
  setLocalCourt: (courtId: string | null, courtObj?: Court) => Promise<void>;
  setVisibility: (v: Visibility) => Promise<void>;
  setPreferredSport: (sport: CourtSport | null) => Promise<void>;
  setPreferredCourtId: (courtId: string | null) => Promise<void>;
  addFriend: (playerId: string) => Promise<void>;
  removeFriend: (playerId: string) => Promise<void>;
  isFriend: (playerId: string) => boolean;
  getFriendsList: () => Player[];
  refreshCourtState: (courtIdOverride?: string) => Promise<void>;
  refreshCheckedIn: () => Promise<void>;
  refreshFeed: () => Promise<void>;
  refreshRuns: () => Promise<void>;
  refreshMatches: () => Promise<void>;
  refreshFriends: () => Promise<void>;
  localPlayers: Player[];
  activePlayers: Player[];
  isLoading: boolean;
}

const AppContext = createContext<AppContextValue | null>(null);

const EMPTY_PLAYER: Player = {
  id: "",
  name: "Player",
  elo: 1200,
  tier: getEloTier(1200),
  avatar: "",
  wins: 0,
  losses: 0,
  checkIns: 0,
  memberSince: new Date().toISOString(),
  courtId: undefined,
  sport: undefined,
  visibility: "public",
  isLocalPlus: false,
  friendIds: [],
};

function profileToPlayer(profile: ReturnType<typeof useAuth>["profile"]): Player {
  if (!profile) return EMPTY_PLAYER;
  const name = profile.display_name || profile.username || "Player";
  const initials = name
    .split(" ")
    .filter(Boolean)
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
  const elo = profile.elo_rating ?? 1200;
  return {
    id: profile.id,
    name,
    elo,
    tier: getEloTier(elo),
    avatar: initials,
    wins: profile.wins ?? 0,
    losses: profile.losses ?? 0,
    checkIns: profile.total_court_time_minutes ?? 0,
    memberSince: profile.created_at,
    courtId: profile.local_court_id ?? undefined,
    sport: (profile.preferred_sport?.toUpperCase() as CourtSport) ?? undefined,
    visibility: "public",
    isLocalPlus: !!profile.is_pro,
    friendIds: [],
  };
}

export function AppProvider({ children }: { children: React.ReactNode }) {
  const { user, profile } = useAuth();
  const userId = user?.id ?? null;

  const [courts, setCourts] = useState<Court[]>([]);
  const [localCourt, setLocalCourtObj] = useState<Court | null>(null);
  const [checkedInCourtId, setCheckedInCourtId] = useState<string | null>(null);
  const [lastVisitedCourtId, setLastVisitedCourtId] = useState<string | null>(null);
  const [localCourtId, setLocalCourtId] = useState<string | null>(null);
  const [runs, setRuns] = useState<GameRun[]>([]);
  const [feed, setFeed] = useState<FeedItem[]>([]);
  const [matches, setMatches] = useState<MatchResult[]>([]);
  const [isLocalPlus, setIsLocalPlusState] = useState<boolean>(false);
  const [visibility, setVisibilityState] = useState<Visibility>("public");
  const [friendIds, setFriendIds] = useState<string[]>([]);
  const [friends, setFriends] = useState<Player[]>([]);
  const [preferredSport, setPreferredSportState] = useState<CourtSport | null>(null);
  const [preferredCourtId, setPreferredCourtIdState] = useState<string | null>(null);
  const [localPlayers, setLocalPlayers] = useState<Player[]>([]);
  const [activePlayers, setActivePlayers] = useState<Player[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const currentUser = useMemo(() => profileToPlayer(profile), [profile]);

  // ─── Derive UI preferences from the authoritative Supabase profile ─────────
  useEffect(() => {
    if (!profile) {
      setLocalCourtId(null);
      setIsLocalPlusState(false);
      setPreferredSportState(null);
      return;
    }
    setLocalCourtId(profile.local_court_id ?? null);
    setIsLocalPlusState(!!profile.is_pro);
    setPreferredSportState(
      profile.preferred_sport ? (profile.preferred_sport.toUpperCase() as CourtSport) : null
    );
  }, [profile]);

  // ─── Load nearby courts from Supabase using device GPS (LA fallback for sort/
  // discovery only). Nearby courts are discovery data, not a user preference —
  // this must never write profiles.local_court_id. ────────────────────────────
  const loadCourts = useCallback(async () => {
    if (!userId) {
      setCourts([]);
      return;
    }
    let { lat, lng } = LA_FALLBACK;
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status === "granted") {
        const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
        lat = loc.coords.latitude;
        lng = loc.coords.longitude;
      }
    } catch {
      // Keep fallback coords.
    }
    const nearby = await fetchNearbyCourts(lat, lng, preferredSport ?? null, 30);
    setCourts(nearby);
  }, [userId, preferredSport]);

  useEffect(() => {
    loadCourts();
  }, [loadCourts]);

  // ─── Hydrate the local court object from its id. localCourtId is already kept
  // in sync with the authoritative profile.local_court_id (see the sync effect
  // above and setLocalCourt below) — don't re-derive from a possibly-stale
  // `profile` reference here, or clearing the local court can get resurrected. ─
  const hydrateLocalCourt = useCallback(async () => {
    if (!localCourtId) {
      setLocalCourtObj(null);
      return;
    }
    const court = await fetchCourtById(localCourtId);
    setLocalCourtObj(court);
  }, [localCourtId]);

  useEffect(() => {
    hydrateLocalCourt();
  }, [hydrateLocalCourt]);

  // ─── Refresh court state: locals + active check-ins ─────────────────────────
  // Keyed on localCourtId (the id state), NOT the hydrated localCourt object —
  // the object lags behind after switching courts, which made post-switch
  // check-ins refresh the OLD court's roster. courtIdOverride lets callers
  // refresh a specific court immediately without waiting for state to settle.
  const refreshCourtState = useCallback(async (courtIdOverride?: string) => {
    const id = courtIdOverride ?? localCourtId;
    if (!id) {
      setLocalPlayers([]);
      setActivePlayers([]);
      return;
    }
    const [locals, active] = await Promise.all([
      fetchLocals(id),
      fetchActiveCheckIns(id),
    ]);
    setLocalPlayers(locals);
    setActivePlayers(active);
  }, [localCourtId]);

  useEffect(() => {
    refreshCourtState();
  }, [refreshCourtState]);

  // ─── Refresh signed-in user's checked-in court ──────────────────────────────
  const refreshCheckedIn = useCallback(async () => {
    if (!userId) return;
    const courtId = await fetchCheckedInCourtId(userId);
    setCheckedInCourtId(courtId);
  }, [userId]);

  useEffect(() => {
    refreshCheckedIn();
  }, [refreshCheckedIn]);

  // ─── Refresh runs, feed, matches, friends ───────────────────────────────────
  const refreshRuns = useCallback(async () => {
    const courtId = localCourt?.id;
    const from = new Date();
    const to = new Date();
    to.setDate(to.getDate() + 7);
    const games = await fetchScheduledGames(courtId ? { courtId, from, to } : { from, to });
    setRuns(games);
  }, [localCourt?.id]);

  const refreshFeed = useCallback(async () => {
    const items = await fetchFeed(localCourt?.id ?? undefined);
    setFeed(items);
  }, [localCourt?.id]);

  const refreshMatches = useCallback(async () => {
    if (!userId) {
      setMatches([]);
      return;
    }
    const items = await fetchGamesByPlayer(userId);
    setMatches(items);
  }, [userId]);

  const refreshFriends = useCallback(async () => {
    if (!userId) return;
    const list = await fetchFriends(userId);
    setFriends(list);
    setFriendIds(list.map((f) => f.id));
  }, [userId]);

  // Initial data load + polling when user or local court changes
  useEffect(() => {
    let mounted = true;
    (async () => {
      setIsLoading(true);
      await Promise.all([
        refreshRuns(),
        refreshFeed(),
        refreshMatches(),
        refreshFriends(),
      ]);
      if (mounted) setIsLoading(false);
    })();
    return () => { mounted = false; };
  }, [refreshRuns, refreshFeed, refreshMatches, refreshFriends]);

  // Poll shared state every 30s so two devices see each other quickly
  useEffect(() => {
    const interval = setInterval(() => {
      refreshCourtState();
      refreshFeed();
      refreshRuns();
      refreshFriends();
    }, 30000);
    return () => clearInterval(interval);
  }, [refreshCourtState, refreshFeed, refreshRuns, refreshFriends]);

  // ─── Actions ───────────────────────────────────────────────────────────────
  const checkIn = useCallback(
    async (courtId: string) => {
      if (!userId) return;
      // Optimistic UI — only when checking into the court whose roster is shown
      if (courtId === localCourtId) {
        setActivePlayers((prev) => {
          const exists = prev.some((p) => p.id === userId);
          if (exists) return prev;
          return [currentUser, ...prev];
        });
      }
      const ok = await checkInToCourt(courtId, undefined, visibility);
      if (ok) {
        setCheckedInCourtId(courtId);
        setLastVisitedCourtId(courtId);
      }
      // Refresh against the court we just acted on — reconciles the optimistic
      // add on success and rolls it back on failure
      refreshCourtState(courtId === localCourtId ? courtId : undefined);
      refreshFeed();
    },
    [userId, visibility, currentUser, localCourtId, refreshCourtState, refreshFeed]
  );

  const checkOut = useCallback(async () => {
    if (!userId) return;
    const ok = await checkOutOfCourt(userId);
    if (ok) setCheckedInCourtId(null);
    refreshCourtState();
    refreshFeed();
  }, [userId, refreshCourtState, refreshFeed]);

  const visitCourt = useCallback(async (courtId: string) => {
    setLastVisitedCourtId(courtId);
  }, []);

  const addCourt = useCallback(async (court: Court) => {
    if (!userId) return;
    const created = await createCourt(
      {
        name: court.name,
        address: court.address,
        latitude: court.latitude,
        longitude: court.longitude,
        sport: court.sport,
        imageUrl: court.imageUri ?? null,
      },
      userId
    );
    if (created) {
      setCourts((prev) => [created, ...prev]);
    }
  }, [userId]);

  const setLocalCourt = useCallback(async (courtId: string | null, courtObj?: Court) => {
    setLocalCourtId(courtId);
    if (courtId === null) {
      setLocalCourtObj(null);
    } else if (courtObj) {
      setLocalCourtObj(courtObj);
    } else {
      const court = await fetchCourtById(courtId);
      setLocalCourtObj(court);
    }
    if (userId) {
      await updateLocalCourtId(userId, courtId);
    }
  }, [userId]);

  const setVisibility = useCallback(async (v: Visibility) => {
    // Session-scoped check-in visibility (persisted per check-in row, not device).
    setVisibilityState(v);
  }, []);

  // NOTE: profiles.is_pro is derived by a DB trigger from the subscriptions
  // table and must never be written from the client. LocalPlus status is
  // read-only here (see the profile effect above); real purchases should
  // write subscriptions rows through a secure server/RPC flow, then refresh
  // the profile.

  const setPreferredSport = useCallback(async (sport: CourtSport | null) => {
    setPreferredSportState(sport);
    if (userId) {
      await updateProfileFields(userId, { preferred_sport: sport ? sport.toLowerCase() : null });
    }
  }, [userId]);

  const setPreferredCourtId = useCallback(async (courtId: string | null) => {
    // In-memory only: a transient filter selection, not a persisted preference.
    setPreferredCourtIdState(courtId);
  }, []);

  const addFriendAction = useCallback(async (playerId: string) => {
    if (!userId) return;
    setFriendIds((prev) => (prev.includes(playerId) ? prev : [...prev, playerId]));
    await addFriend(userId, playerId);
    await refreshFriends();
  }, [userId, refreshFriends]);

  const removeFriendAction = useCallback(async (playerId: string) => {
    if (!userId) return;
    setFriendIds((prev) => prev.filter((id) => id !== playerId));
    await removeFriend(userId, playerId);
    await refreshFriends();
  }, [userId, refreshFriends]);

  const isFriend = useCallback((playerId: string) => friendIds.includes(playerId), [friendIds]);
  const getFriendsList = useCallback(() => friends, [friends]);

  const joinRun = useCallback(
    (runId: string, team: "A" | "B") => {
      if (!userId) return;
      joinScheduledGame(runId, userId, team);
      // Optimistic local update
      setRuns((prev) =>
        prev.map((run) => {
          if (run.id !== runId) return run;
          const key = team === "A" ? "teamA" : "teamB";
          const arr = [...run[key]];
          const emptyIdx = arr.findIndex((p) => p === null);
          if (emptyIdx === -1) return run;
          arr[emptyIdx] = currentUser;
          return { ...run, [key]: arr };
        })
      );
    },
    [userId, currentUser]
  );

  const hypeItem = useCallback((feedId: string) => {
    setFeed((prev) =>
      prev.map((item) =>
        item.id === feedId ? { ...item, hypeCount: item.hypeCount + 1 } : item
      )
    );
  }, []);

  return (
    <AppContext.Provider
      value={{
        currentUser,
        courts,
        checkedInCourtId,
        lastVisitedCourtId,
        localCourtId,
        localCourt,
        runs,
        feed,
        matches,
        isLocalPlus,
        visibility,
        friendIds,
        preferredSport,
        preferredCourtId,
        checkIn,
        checkOut,
        visitCourt,
        joinRun,
        hypeItem,
        addCourt,
        setLocalCourt,
        setVisibility,
        setPreferredSport,
        setPreferredCourtId,
        addFriend: addFriendAction,
        removeFriend: removeFriendAction,
        isFriend,
        getFriendsList,
        refreshCourtState,
        refreshCheckedIn,
        refreshFeed,
        refreshRuns,
        refreshMatches,
        refreshFriends,
        localPlayers,
        activePlayers,
        isLoading,
      }}
    >
      {children}
    </AppContext.Provider>
  );
}

export function useApp(): AppContextValue {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error("useApp must be used within AppProvider");
  return ctx;
}
