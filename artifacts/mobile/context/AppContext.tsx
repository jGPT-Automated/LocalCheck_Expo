import AsyncStorage from "@react-native-async-storage/async-storage";
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
  SAMPLE_PLAYERS,
  getEloTier,
} from "@/constants/data";
import { checkInToCourt, checkOutOfCourt, fetchActiveCheckIns, fetchCheckedInCourtId } from "@/services/checkInService";
import { addFriend, fetchFriends, removeFriend } from "@/services/friendshipService";
import { fetchFeed } from "@/services/feedService";
import { fetchGamesByPlayer } from "@/services/gameService";
import { fetchScheduledGames, joinScheduledGame } from "@/services/scheduledGameService";
import { fetchCourtById } from "@/services/courtService";
import { fetchLocals, updateLocalCourtId } from "@/services/profileService";
import { useAuth } from "@/context/AuthContext";

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
  addMatchResult: (result: MatchResult) => void;
  recordResult: (runId: string, winner: "A" | "B") => void;
  recordWin: (runId: string, eloDelta: number) => void;
  recordLoss: (runId: string, eloDelta: number) => void;
  addCourt: (court: Court) => Promise<void>;
  setLocalCourt: (courtId: string, courtObj?: Court) => Promise<void>;
  setVisibility: (v: Visibility) => Promise<void>;
  setIsLocalPlus: (v: boolean) => Promise<void>;
  setPreferredSport: (sport: CourtSport | null) => Promise<void>;
  setPreferredCourtId: (courtId: string | null) => Promise<void>;
  addFriend: (playerId: string) => Promise<void>;
  removeFriend: (playerId: string) => Promise<void>;
  isFriend: (playerId: string) => boolean;
  getFriendsList: () => Player[];
  refreshCourtState: () => Promise<void>;
  refreshFeed: () => Promise<void>;
  refreshRuns: () => Promise<void>;
  refreshMatches: () => Promise<void>;
  refreshFriends: () => Promise<void>;
  localPlayers: Player[];
  activePlayers: Player[];
  isLoading: boolean;
}

const AppContext = createContext<AppContextValue | null>(null);

const STORAGE_KEYS = {
  lastVisitedCourtId: "localcheck:lastVisitedCourtId",
  localCourtId: "localcheck:localCourtId",
  visibility: "localcheck:visibility",
  isLocalPlus: "localcheck:isLocalPlus",
  friendIds: "localcheck:friendIds",
  preferredSport: "localcheck:preferredSport",
  preferredCourtId: "localcheck:preferredCourtId",
  courts: "localcheck:courts",
};

function profileToPlayer(profile: ReturnType<typeof useAuth>["profile"]): Player {
  if (!profile) return SAMPLE_PLAYERS[0];
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
    sport: undefined,
    visibility: "public",
    isLocalPlus: false,
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

  // ─── Hydration from local storage (UI prefs + local court fallback) ────────
  useEffect(() => {
    (async () => {
      try {
        const [lastVisitedRaw, localCourtRaw, visibilityRaw, isLocalPlusRaw, friendIdsRaw, preferredSportRaw, preferredCourtIdRaw, courtsRaw] = await Promise.all([
          AsyncStorage.getItem(STORAGE_KEYS.lastVisitedCourtId),
          AsyncStorage.getItem(STORAGE_KEYS.localCourtId),
          AsyncStorage.getItem(STORAGE_KEYS.visibility),
          AsyncStorage.getItem(STORAGE_KEYS.isLocalPlus),
          AsyncStorage.getItem(STORAGE_KEYS.friendIds),
          AsyncStorage.getItem(STORAGE_KEYS.preferredSport),
          AsyncStorage.getItem(STORAGE_KEYS.preferredCourtId),
          AsyncStorage.getItem(STORAGE_KEYS.courts),
        ]);
        if (lastVisitedRaw) setLastVisitedCourtId(lastVisitedRaw);
        if (localCourtRaw) setLocalCourtId(localCourtRaw);
        if (visibilityRaw) setVisibilityState(visibilityRaw as Visibility);
        if (isLocalPlusRaw === "true") setIsLocalPlusState(true);
        if (friendIdsRaw) {
          try { setFriendIds(JSON.parse(friendIdsRaw)); } catch { }
        }
        if (preferredSportRaw) setPreferredSportState(preferredSportRaw as CourtSport);
        if (preferredCourtIdRaw) setPreferredCourtIdState(preferredCourtIdRaw);
        if (courtsRaw) {
          try { setCourts(JSON.parse(courtsRaw)); } catch { }
        }
      } catch { }
    })();
  }, []);

  // ─── When auth user or localCourtId changes, hydrate local court object ────
  const hydrateLocalCourt = useCallback(async () => {
    const id = profile?.local_court_id ?? localCourtId;
    if (!id) {
      setLocalCourtObj(null);
      return;
    }
    // If device stored id differs from server profile, update device storage silently
    if (profile?.local_court_id && profile.local_court_id !== localCourtId) {
      setLocalCourtId(profile.local_court_id);
      await AsyncStorage.setItem(STORAGE_KEYS.localCourtId, profile.local_court_id);
    }
    const court = await fetchCourtById(id);
    setLocalCourtObj(court);
  }, [profile?.local_court_id, localCourtId]);

  useEffect(() => {
    hydrateLocalCourt();
  }, [hydrateLocalCourt]);

  // ─── Refresh court state: locals + active check-ins ─────────────────────────
  const refreshCourtState = useCallback(async () => {
    const id = localCourt?.id;
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
  }, [localCourt?.id]);

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
      // Optimistic UI
      const court = await fetchCourtById(courtId);
      if (court) setActivePlayers((prev) => {
        const exists = prev.some((p) => p.id === userId);
        if (exists) return prev;
        return [currentUser, ...prev];
      });
      await checkInToCourt(userId, courtId, undefined, visibility);
      setCheckedInCourtId(courtId);
      setLastVisitedCourtId(courtId);
      await AsyncStorage.setItem(STORAGE_KEYS.lastVisitedCourtId, courtId);
      // Refresh shared state
      refreshCourtState();
      refreshFeed();
    },
    [userId, visibility, currentUser, refreshCourtState, refreshFeed]
  );

  const checkOut = useCallback(async () => {
    if (!userId) return;
    await checkOutOfCourt(userId);
    setCheckedInCourtId(null);
    refreshCourtState();
    refreshFeed();
  }, [userId, refreshCourtState, refreshFeed]);

  const visitCourt = useCallback(async (courtId: string) => {
    setLastVisitedCourtId(courtId);
    await AsyncStorage.setItem(STORAGE_KEYS.lastVisitedCourtId, courtId);
  }, []);

  const addCourt = useCallback(async (court: Court) => {
    setCourts((prev) => {
      const updated = [...prev, court];
      AsyncStorage.setItem(STORAGE_KEYS.courts, JSON.stringify(updated));
      return updated;
    });
  }, []);

  const setLocalCourt = useCallback(async (courtId: string, courtObj?: Court) => {
    setLocalCourtId(courtId);
    await AsyncStorage.setItem(STORAGE_KEYS.localCourtId, courtId);
    if (courtObj) {
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
    setVisibilityState(v);
    await AsyncStorage.setItem(STORAGE_KEYS.visibility, v);
  }, []);

  const setIsLocalPlus = useCallback(async (v: boolean) => {
    setIsLocalPlusState(v);
    await AsyncStorage.setItem(STORAGE_KEYS.isLocalPlus, String(v));
  }, []);

  const setPreferredSport = useCallback(async (sport: CourtSport | null) => {
    setPreferredSportState(sport);
    if (sport) {
      await AsyncStorage.setItem(STORAGE_KEYS.preferredSport, sport);
    } else {
      await AsyncStorage.removeItem(STORAGE_KEYS.preferredSport);
    }
  }, []);

  const setPreferredCourtId = useCallback(async (courtId: string | null) => {
    setPreferredCourtIdState(courtId);
    if (courtId) {
      await AsyncStorage.setItem(STORAGE_KEYS.preferredCourtId, courtId);
    } else {
      await AsyncStorage.removeItem(STORAGE_KEYS.preferredCourtId);
    }
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

  const addMatchResult = useCallback((result: MatchResult) => {
    setMatches((prev) => [result, ...prev]);
  }, []);

  const recordResult = useCallback(
    (runId: string, winner: "A" | "B") => {
      const run = runs.find((r) => r.id === runId);
      if (!run) return;
      const isOnTeamA = run.teamA.some((p) => p?.id === currentUser.id);
      const isWin = (winner === "A" && isOnTeamA) || (winner === "B" && !isOnTeamA);
      const delta = 15;
      if (isWin) recordWin(runId, delta);
      else recordLoss(runId, delta);
    },
    [runs, currentUser]
  );

  const recordWin = useCallback(
    (runId: string, eloDelta: number) => {
      const run = runs.find((r) => r.id === runId);
      addMatchResult({
        id: `m${Date.now()}`,
        date: new Date().toLocaleDateString("en-US", { month: "short", day: "numeric" }).toUpperCase(),
        courtName: run?.courtName.toUpperCase() ?? "UNKNOWN",
        sport: run?.sport ?? "BASKETBALL",
        result: "WIN",
        eloDelta,
        teamScore: "21",
        opposingScore: "14",
      });
    },
    [runs, addMatchResult]
  );

  const recordLoss = useCallback(
    (runId: string, eloDelta: number) => {
      const run = runs.find((r) => r.id === runId);
      addMatchResult({
        id: `m${Date.now()}`,
        date: new Date().toLocaleDateString("en-US", { month: "short", day: "numeric" }).toUpperCase(),
        courtName: run?.courtName.toUpperCase() ?? "UNKNOWN",
        sport: run?.sport ?? "BASKETBALL",
        result: "LOSS",
        eloDelta: -eloDelta,
        teamScore: "11",
        opposingScore: "21",
      });
    },
    [runs, addMatchResult]
  );

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
        addMatchResult,
        recordResult,
        recordWin,
        recordLoss,
        addCourt,
        setLocalCourt,
        setVisibility,
        setIsLocalPlus,
        setPreferredSport,
        setPreferredCourtId,
        addFriend: addFriendAction,
        removeFriend: removeFriendAction,
        isFriend,
        getFriendsList,
        refreshCourtState,
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
