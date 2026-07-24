import * as Location from "expo-location";
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { AppState, Platform } from "react-native";

import {
  Court,
  CourtSport,
  FeedItem,
  GameRun,
  MatchResult,
  PlannedVisit,
  Player,
  getEloTier,
} from "@/constants/data";
import {
  createPlannedVisit,
  deletePlannedVisit,
  fetchPlannedVisits,
} from "@/services/plannedVisitService";
import { checkInToCourt, checkOutOfCourt, fetchCheckedInCourtId } from "@/services/checkInService";
import { addFriend, fetchFriends, removeFriend } from "@/services/friendshipService";
import { fetchFeed } from "@/services/feedService";
import { fetchGamesByPlayer } from "@/services/gameService";
import { fetchScheduledGames, joinScheduledGame } from "@/services/scheduledGameService";
import { createCourt, fetchCourtById, fetchNearbyCourts } from "@/services/courtService";
import { updateLocalCourtId, updateProfileFields } from "@/services/profileService";
import { useAuth } from "@/context/AuthContext";
import { usePresenceRefresh } from "@/context/CourtPresenceContext";
import { supabase } from "@/lib/supabase";

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
  plannedVisits: PlannedVisit[];
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
  joinRun: (runId: string) => Promise<boolean>;
  addPlannedVisit: (courtId: string, plannedAtIso: string, note?: string) => Promise<boolean>;
  removePlannedVisit: (visitId: string) => Promise<boolean>;
  refreshPlannedVisits: () => Promise<void>;
  hypeItem: (feedId: string) => void;
  addCourt: (court: Court) => Promise<void>;
  setLocalCourt: (courtId: string | null, courtObj?: Court) => Promise<boolean>;
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
  const [plannedVisits, setPlannedVisits] = useState<PlannedVisit[]>([]);
  const [feed, setFeed] = useState<FeedItem[]>([]);
  const [matches, setMatches] = useState<MatchResult[]>([]);
  const [isLocalPlus, setIsLocalPlusState] = useState<boolean>(false);
  const [visibility, setVisibilityState] = useState<Visibility>("public");
  const [friendIds, setFriendIds] = useState<string[]>([]);
  const [friends, setFriends] = useState<Player[]>([]);
  const [preferredSport, setPreferredSportState] = useState<CourtSport | null>(null);
  const [preferredCourtId, setPreferredCourtIdState] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // The presence store (CourtPresenceContext, mounted above this provider) is
  // the ONLY roster/count source. Actions here push a refresh into it so the
  // acting device converges instantly on every surface; other devices get the
  // same refresh from the realtime event.
  const refreshPresence = usePresenceRefresh();

  const currentUser = useMemo(() => profileToPlayer(profile), [profile]);

  // ─── Derive UI preferences from the authoritative Supabase profile ─────────
  // local_court_id is the user's saved home court AND is mutable in-session via
  // setLocalCourt. It must be initialized from the profile ONCE per user, not
  // re-applied on every `profile` object change: waitForProfile runs on every
  // onAuthStateChange (TOKEN_REFRESHED, and a transient null during
  // provisioning), and re-applying would clobber a court the user just picked
  // with a stale/racy snapshot — that was the "My Court resets" bug. is_pro and
  // preferred_sport are read-mostly and safe to keep tracking the server.
  const localCourtInitializedForRef = useRef<string | null>(null);
  useEffect(() => {
    if (!profile) {
      setIsLocalPlusState(false);
      setPreferredSportState(null);
      // Do NOT clear localCourtId here — a transient null profile during
      // provisioning must not deselect the home court. Real sign-out unmounts
      // this whole provider (gated on session), which resets all state.
      return;
    }
    setIsLocalPlusState(!!profile.is_pro);
    setPreferredSportState(
      profile.preferred_sport ? (profile.preferred_sport.toUpperCase() as CourtSport) : null
    );
    if (localCourtInitializedForRef.current !== profile.id) {
      localCourtInitializedForRef.current = profile.id;
      setLocalCourtId(profile.local_court_id ?? null);
    }
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

  // ─── Refresh court state: delegates to the shared presence store ────────────
  // Kept as the callable surface older screens use (focus effects, pull to
  // refresh). Keyed on localCourtId (the id state), NOT the hydrated object —
  // the object lags behind after switching courts. courtIdOverride lets
  // callers refresh a specific court without waiting for state to settle.
  const refreshCourtState = useCallback(async (courtIdOverride?: string) => {
    const id = courtIdOverride ?? localCourtId;
    if (!id) return;
    await refreshPresence(id);
  }, [localCourtId, refreshPresence]);

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
  // Runs are fetched for ALL courts (7-day window) — screens filter by court
  // where needed. Fetching only the local court made runs created or joined at
  // other courts vanish from Schedule after a refresh.
  const refreshRuns = useCallback(async () => {
    // From start-of-today, not "now": a run created for earlier today should
    // still show on today's schedule instead of silently disappearing.
    // 14-day window: Schedule's heatmap pages between this week and next.
    const from = new Date();
    from.setHours(0, 0, 0, 0);
    const to = new Date();
    to.setDate(to.getDate() + 14);
    const games = await fetchScheduledGames({ from, to });
    setRuns(games);
  }, []);

  // Planned presence ("pulling up") — all courts, same 14-day window.
  const refreshPlannedVisits = useCallback(async () => {
    const from = new Date();
    from.setHours(0, 0, 0, 0);
    const to = new Date();
    to.setDate(to.getDate() + 14);
    const visits = await fetchPlannedVisits({ from, to });
    setPlannedVisits(visits);
  }, []);

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
        refreshPlannedVisits(),
        refreshFeed(),
        refreshMatches(),
        refreshFriends(),
      ]);
      if (mounted) setIsLoading(false);
    })();
    return () => { mounted = false; };
  }, [refreshRuns, refreshPlannedVisits, refreshFeed, refreshMatches, refreshFriends]);

  // NO recurring poll. Live convergence comes from the scoped realtime
  // channels (CourtPresenceContext); shared state here resyncs exactly once
  // when the app returns to the foreground / the tab becomes visible.
  // (The 2026-07-19 outage was self-inflicted global polling — fetch once,
  // subscribe narrowly, resync on foreground, nothing on a timer.)
  const resyncInFlight = useRef(false);
  const resync = useCallback(async () => {
    if (!userId || resyncInFlight.current) return;
    resyncInFlight.current = true;
    try {
      // Presence (rosters/counts) foreground-refreshes itself in
      // CourtPresenceContext — only the non-presence stores resync here.
      await Promise.all([
        refreshFeed(),
        refreshRuns(),
        refreshPlannedVisits(),
        refreshFriends(),
      ]);
    } finally {
      resyncInFlight.current = false;
    }
  }, [userId, refreshFeed, refreshRuns, refreshPlannedVisits, refreshFriends]);

  useEffect(() => {
    const sub = AppState.addEventListener("change", (state) => {
      if (state === "active") resync();
    });
    let onVisible: (() => void) | undefined;
    if (Platform.OS === "web" && typeof document !== "undefined") {
      onVisible = () => {
        if (document.visibilityState === "visible") resync();
      };
      document.addEventListener("visibilitychange", onVisible);
    }
    return () => {
      sub.remove();
      if (onVisible) document.removeEventListener("visibilitychange", onVisible);
    };
  }, [resync]);

  // ─── Live feed for the court shown on Home ──────────────────────────────────
  // One scoped activity_events channel (filtered to the local court), debounced.
  // Keeps RECENT ACTIVITY in step with the realtime roster instead of only
  // refreshing on foreground — same architecture as presence: scoped, no
  // polling, torn down when the court changes or the provider unmounts.
  // (Delivery requires the authenticated Realtime socket — see AuthContext
  // supabase.realtime.setAuth.)
  useEffect(() => {
    const courtId = localCourt?.id;
    if (!userId || !courtId) return;
    let debounce: ReturnType<typeof setTimeout> | null = null;
    const channel = supabase
      .channel(`feed:${courtId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "activity_events", filter: `court_id=eq.${courtId}` },
        () => {
          if (debounce) clearTimeout(debounce);
          debounce = setTimeout(() => refreshFeed(), 400);
        }
      )
      .subscribe();
    return () => {
      if (debounce) clearTimeout(debounce);
      supabase.removeChannel(channel);
    };
  }, [userId, localCourt?.id, refreshFeed]);

  // ─── Live runs ──────────────────────────────────────────────────────────────
  // The runs store is a global 7-day window (all courts), so its realtime
  // scope matches: ONE channel on runs + run_participants + planned_visits,
  // debounced into the corresponding refetch. RSVPs and run edits are rare
  // human actions — a handful of events an hour, each costing one query per
  // client — unlike the per-court check-in stream this stays a single
  // subscription. This is what makes a join on one device show up on every
  // other device's run page / Schedule / NEXT RUN without foregrounding.
  useEffect(() => {
    if (!userId) return;
    let runsDebounce: ReturnType<typeof setTimeout> | null = null;
    let visitsDebounce: ReturnType<typeof setTimeout> | null = null;
    const onRunsEvent = () => {
      if (runsDebounce) clearTimeout(runsDebounce);
      runsDebounce = setTimeout(() => refreshRuns(), 400);
    };
    const onVisitsEvent = () => {
      if (visitsDebounce) clearTimeout(visitsDebounce);
      visitsDebounce = setTimeout(() => refreshPlannedVisits(), 400);
    };
    const channel = supabase
      .channel("runs-live")
      .on("postgres_changes", { event: "*", schema: "public", table: "runs" }, onRunsEvent)
      .on("postgres_changes", { event: "*", schema: "public", table: "run_participants" }, onRunsEvent)
      .on("postgres_changes", { event: "*", schema: "public", table: "planned_visits" }, onVisitsEvent)
      .subscribe();
    return () => {
      if (runsDebounce) clearTimeout(runsDebounce);
      if (visitsDebounce) clearTimeout(visitsDebounce);
      supabase.removeChannel(channel);
    };
  }, [userId, refreshRuns, refreshPlannedVisits]);

  // ─── Actions ───────────────────────────────────────────────────────────────
  const checkIn = useCallback(
    async (courtId: string) => {
      if (!userId) return;
      const prevCourtId = checkedInCourtId;
      const ok = await checkInToCourt(courtId, undefined, visibility);
      if (ok) {
        setCheckedInCourtId(courtId);
        setLastVisitedCourtId(courtId);
      }
      // Converge the acting device now (don't wait for its own realtime echo):
      // the court acted on, plus the court implicitly checked out of — the
      // check_in RPC atomically closes any prior open check-in elsewhere.
      refreshPresence(courtId);
      if (prevCourtId && prevCourtId !== courtId) refreshPresence(prevCourtId);
      refreshFeed();
    },
    [userId, visibility, checkedInCourtId, refreshPresence, refreshFeed]
  );

  const checkOut = useCallback(async () => {
    if (!userId) return;
    const prevCourtId = checkedInCourtId;
    const ok = await checkOutOfCourt(userId);
    if (ok) setCheckedInCourtId(null);
    if (prevCourtId) refreshPresence(prevCourtId);
    refreshFeed();
  }, [userId, checkedInCourtId, refreshPresence, refreshFeed]);

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

  const setLocalCourt = useCallback(async (courtId: string | null, courtObj?: Court): Promise<boolean> => {
    // Optimistic UI, but with rollback: if the profile write fails, keeping
    // the new court on screen would silently revert on next launch (the old
    // error-swallowing path hid exactly that).
    const prevId = localCourtId;
    const prevObj = localCourt;
    setLocalCourtId(courtId);
    if (courtId === null) {
      setLocalCourtObj(null);
    } else if (courtObj) {
      setLocalCourtObj(courtObj);
    } else {
      const court = await fetchCourtById(courtId);
      setLocalCourtObj(court);
    }
    if (!userId) return true;
    const persisted = await updateLocalCourtId(userId, courtId);
    if (!persisted) {
      setLocalCourtId(prevId);
      setLocalCourtObj(prevObj);
    }
    return persisted;
  }, [userId, localCourtId, localCourt]);

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
    async (runId: string): Promise<boolean> => {
      if (!userId) return false;
      const ok = await joinScheduledGame(runId, userId);
      if (ok) {
        // Reflect the confirmed RSVP immediately, then reconcile from the DB.
        setRuns((prev) =>
          prev.map((run) => {
            if (run.id !== runId) return run;
            if (run.participants.some((p) => p.id === userId)) return run;
            return { ...run, participants: [...run.participants, currentUser] };
          })
        );
        refreshRuns();
      }
      return ok;
    },
    [userId, currentUser, refreshRuns]
  );

  const addPlannedVisit = useCallback(
    async (courtId: string, plannedAtIso: string, note?: string): Promise<boolean> => {
      if (!userId) return false;
      const ok = await createPlannedVisit(userId, courtId, plannedAtIso, note);
      if (ok) await refreshPlannedVisits();
      return ok;
    },
    [userId, refreshPlannedVisits]
  );

  const removePlannedVisit = useCallback(
    async (visitId: string): Promise<boolean> => {
      if (!userId) return false;
      const ok = await deletePlannedVisit(visitId);
      if (ok) setPlannedVisits((prev) => prev.filter((v) => v.id !== visitId));
      return ok;
    },
    [userId]
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
        plannedVisits,
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
        addPlannedVisit,
        removePlannedVisit,
        refreshPlannedVisits,
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
