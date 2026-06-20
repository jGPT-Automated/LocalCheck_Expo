import AsyncStorage from "@react-native-async-storage/async-storage";
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";

import {
  Court,
  CourtSport,
  CourtStatus,
  FeedItem,
  GameRun,
  MatchResult,
  Player,
  SAMPLE_COURTS,
  SAMPLE_FEED,
  SAMPLE_MATCHES,
  SAMPLE_PLAYERS,
  SAMPLE_RUNS,
  getEloTier,
} from "@/constants/data";

export type Visibility = "public" | "friends" | "private";

interface AppContextValue {
  currentUser: Player;
  courts: Court[];
  checkedInCourtId: string | null;
  lastVisitedCourtId: string | null;
  localCourtId: string | null;
  runs: GameRun[];
  feed: FeedItem[];
  matches: MatchResult[];
  isLocalPlus: boolean;
  visibility: Visibility;
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
  setLocalCourt: (courtId: string) => Promise<void>;
  setVisibility: (v: Visibility) => Promise<void>;
  setIsLocalPlus: (v: boolean) => Promise<void>;
}

const AppContext = createContext<AppContextValue | null>(null);

const STORAGE_KEYS = {
  currentUser: "localcheck:currentUser",
  checkedInCourtId: "localcheck:checkedInCourtId",
  lastVisitedCourtId: "localcheck:lastVisitedCourtId",
  localCourtId: "localcheck:localCourtId",
  feed: "localcheck:feed",
  matches: "localcheck:matches",
  courts: "localcheck:courts",
  visibility: "localcheck:visibility",
  isLocalPlus: "localcheck:isLocalPlus",
};

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [currentUser, setCurrentUser] = useState<Player>(SAMPLE_PLAYERS[0]);
  const [courts, setCourts] = useState<Court[]>(SAMPLE_COURTS);
  const [checkedInCourtId, setCheckedInCourtId] = useState<string | null>(null);
  const [lastVisitedCourtId, setLastVisitedCourtId] = useState<string | null>(null);
  const [localCourtId, setLocalCourtId] = useState<string | null>(null);
  const [runs, setRuns] = useState<GameRun[]>(SAMPLE_RUNS);
  const [feed, setFeed] = useState<FeedItem[]>(SAMPLE_FEED);
  const [matches, setMatches] = useState<MatchResult[]>(SAMPLE_MATCHES);
  const [isLocalPlus, setIsLocalPlusState] = useState<boolean>(false);
  const [visibility, setVisibilityState] = useState<Visibility>("public");

  useEffect(() => {
    (async () => {
      try {
        const [userRaw, courtIdRaw, lastVisitedRaw, feedRaw, matchesRaw, localCourtRaw, courtsRaw, visibilityRaw, isLocalPlusRaw] = await Promise.all([
          AsyncStorage.getItem(STORAGE_KEYS.currentUser),
          AsyncStorage.getItem(STORAGE_KEYS.checkedInCourtId),
          AsyncStorage.getItem(STORAGE_KEYS.lastVisitedCourtId),
          AsyncStorage.getItem(STORAGE_KEYS.feed),
          AsyncStorage.getItem(STORAGE_KEYS.matches),
          AsyncStorage.getItem(STORAGE_KEYS.localCourtId),
          AsyncStorage.getItem(STORAGE_KEYS.courts),
          AsyncStorage.getItem(STORAGE_KEYS.visibility),
          AsyncStorage.getItem(STORAGE_KEYS.isLocalPlus),
        ]);
        if (userRaw) setCurrentUser(JSON.parse(userRaw));
        if (courtIdRaw) setCheckedInCourtId(courtIdRaw);
        if (lastVisitedRaw) setLastVisitedCourtId(lastVisitedRaw);
        if (feedRaw) setFeed(JSON.parse(feedRaw));
        if (matchesRaw) setMatches(JSON.parse(matchesRaw));
        if (localCourtRaw) setLocalCourtId(localCourtRaw);
        if (courtsRaw) {
          const saved: Court[] = JSON.parse(courtsRaw);
          const sampleIds = new Set(SAMPLE_COURTS.map((c) => c.id));
          const userAdded = saved.filter((c) => !sampleIds.has(c.id));
          if (userAdded.length > 0) {
            setCourts([...SAMPLE_COURTS, ...userAdded]);
          }
        }
        if (visibilityRaw) setVisibilityState(visibilityRaw as Visibility);
        if (isLocalPlusRaw === "true") setIsLocalPlusState(true);
      } catch {}
    })();
  }, []);

  const checkIn = useCallback(
    async (courtId: string) => {
      if (checkedInCourtId) {
        setCourts((prev) =>
          prev.map((c) =>
            c.id === checkedInCourtId
              ? { ...c, activeCount: Math.max(0, c.activeCount - 1) }
              : c
          )
        );
      }

      const court = courts.find((c) => c.id === courtId);
      setCourts((prev) =>
        prev.map((c) =>
          c.id === courtId ? { ...c, activeCount: c.activeCount + 1 } : c
        )
      );
      setCheckedInCourtId(courtId);
      setLastVisitedCourtId(courtId);
      await Promise.all([
        AsyncStorage.setItem(STORAGE_KEYS.checkedInCourtId, courtId),
        AsyncStorage.setItem(STORAGE_KEYS.lastVisitedCourtId, courtId),
      ]);

      const newFeedItem: FeedItem = {
        id: `f${Date.now()}`,
        type: "checkin",
        playerId: currentUser.id,
        playerName: currentUser.name.toUpperCase(),
        courtName: court?.name.toUpperCase() ?? courtId.toUpperCase(),
        courtId,
        sport: court?.sport,
        message: `${currentUser.name.toUpperCase()} CHECKED INTO ${court?.name.toUpperCase() ?? courtId.toUpperCase()}`,
        timestamp: "JUST NOW",
        hypeCount: 0,
      };
      setFeed((prev) => {
        const updated = [newFeedItem, ...prev];
        AsyncStorage.setItem(STORAGE_KEYS.feed, JSON.stringify(updated));
        return updated;
      });

      const updatedUser = { ...currentUser, checkIns: currentUser.checkIns + 1 };
      setCurrentUser(updatedUser);
      await AsyncStorage.setItem(STORAGE_KEYS.currentUser, JSON.stringify(updatedUser));
    },
    [checkedInCourtId, courts, currentUser]
  );

  const checkOut = useCallback(async () => {
    if (!checkedInCourtId) return;
    setCourts((prev) =>
      prev.map((c) =>
        c.id === checkedInCourtId
          ? { ...c, activeCount: Math.max(0, c.activeCount - 1) }
          : c
      )
    );
    setCheckedInCourtId(null);
    await AsyncStorage.removeItem(STORAGE_KEYS.checkedInCourtId);
  }, [checkedInCourtId]);

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

    const newFeedItem: FeedItem = {
      id: `f${Date.now()}`,
      type: "new_court",
      playerId: court.addedBy ?? "unknown",
      playerName: "YOU",
      courtName: court.name.toUpperCase(),
      courtId: court.id,
      sport: court.sport,
      message: `YOU ADDED ${court.name.toUpperCase()} TO THE MAP`,
      timestamp: "JUST NOW",
      hypeCount: 0,
    };
    setFeed((prev) => {
      const updated = [newFeedItem, ...prev];
      AsyncStorage.setItem(STORAGE_KEYS.feed, JSON.stringify(updated));
      return updated;
    });
  }, []);

  const setLocalCourt = useCallback(async (courtId: string) => {
    const prev = localCourtId;
    setLocalCourtId(courtId);
    await AsyncStorage.setItem(STORAGE_KEYS.localCourtId, courtId);

    setCourts((prevCourts) => {
      const updated = prevCourts.map((c) => {
        if (c.id === prev && prev !== courtId) {
          const newLocalCount = Math.max(0, c.localCount - 1);
          return {
            ...c,
            localCount: newLocalCount,
            status: (newLocalCount >= 5 ? "community" : "confirmed") as CourtStatus,
          };
        }
        if (c.id === courtId && prev !== courtId) {
          const newLocalCount = c.localCount + 1;
          return {
            ...c,
            localCount: newLocalCount,
            status: (newLocalCount >= 5 ? "community" : "confirmed") as CourtStatus,
          };
        }
        return c;
      });
      AsyncStorage.setItem(STORAGE_KEYS.courts, JSON.stringify(updated));
      return updated;
    });
  }, [localCourtId]);

  const setVisibility = useCallback(async (v: Visibility) => {
    setVisibilityState(v);
    await AsyncStorage.setItem(STORAGE_KEYS.visibility, v);
  }, []);

  const setIsLocalPlus = useCallback(async (v: boolean) => {
    setIsLocalPlusState(v);
    await AsyncStorage.setItem(STORAGE_KEYS.isLocalPlus, String(v));
  }, []);

  const joinRun = useCallback(
    (runId: string, team: "A" | "B") => {
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
    [currentUser]
  );

  const hypeItem = useCallback((feedId: string) => {
    setFeed((prev) =>
      prev.map((item) =>
        item.id === feedId
          ? { ...item, hypeCount: item.hypeCount + 1 }
          : item
      )
    );
  }, []);

  const addMatchResult = useCallback(
    (result: MatchResult) => {
      setMatches((prev) => {
        const updated = [result, ...prev];
        AsyncStorage.setItem(STORAGE_KEYS.matches, JSON.stringify(updated));
        return updated;
      });
    },
    []
  );

  const recordResult = useCallback(
    (runId: string, winner: "A" | "B") => {
      const run = runs.find((r) => r.id === runId);
      if (!run) return;
      const isOnTeamA = run.teamA.some((p) => p?.id === currentUser.id);
      const isWin = (winner === "A" && isOnTeamA) || (winner === "B" && !isOnTeamA);
      const delta = 15;

      if (isWin) {
        recordWin(runId, delta);
      } else {
        recordLoss(runId, delta);
      }
    },
    [runs, currentUser]
  );

  const recordWin = useCallback(
    (runId: string, eloDelta: number) => {
      const run = runs.find((r) => r.id === runId);
      const updatedUser = {
        ...currentUser,
        elo: currentUser.elo + eloDelta,
        wins: currentUser.wins + 1,
        tier: getEloTier(currentUser.elo + eloDelta),
      };
      setCurrentUser(updatedUser);
      AsyncStorage.setItem(STORAGE_KEYS.currentUser, JSON.stringify(updatedUser));
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
    [currentUser, runs, addMatchResult]
  );

  const recordLoss = useCallback(
    (runId: string, eloDelta: number) => {
      const run = runs.find((r) => r.id === runId);
      const updatedUser = {
        ...currentUser,
        elo: Math.max(0, currentUser.elo - eloDelta),
        losses: currentUser.losses + 1,
        tier: getEloTier(Math.max(0, currentUser.elo - eloDelta)),
      };
      setCurrentUser(updatedUser);
      AsyncStorage.setItem(STORAGE_KEYS.currentUser, JSON.stringify(updatedUser));
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
    [currentUser, runs, addMatchResult]
  );

  return (
    <AppContext.Provider
      value={{
        currentUser,
        courts,
        checkedInCourtId,
        lastVisitedCourtId,
        localCourtId,
        runs,
        feed,
        matches,
        isLocalPlus,
        visibility,
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
