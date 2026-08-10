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
import {
  checkInToCourt,
  checkOutOfCourt,
  fetchCheckedInCourtId,
  fetchUserCheckInCount,
} from "@/services/checkInService";
import {
  addFriend,
  acceptFriendRequest,
  fetchFriends,
  fetchIncomingFriendRequests,
  fetchFriendshipStates,
  removeFriend,
} from "@/services/friendshipService";
import { fetchFeed } from "@/services/feedService";
import { fetchGamesByPlayer } from "@/services/gameService";
import { fetchScheduledGames, joinScheduledGame } from "@/services/scheduledGameService";
import {
  createCourt,
  fetchCourtById,
  fetchNearbyCourts,
  type CourtSubmissionResult,
  type VerifiedCourtSubmission,
} from "@/services/courtService";
import { updateLocalCourtId, updateProfileFields } from "@/services/profileService";
import { useAuth } from "@/context/AuthContext";
import { usePresenceRefresh } from "@/context/CourtPresenceContext";
import { useRealtimeHub } from "@/context/RealtimeHubContext";
import {
  batchHasResource,
  marketTopic,
  type RealtimeInvalidationBatch,
  type RealtimeTopic,
} from "@/lib/realtimeHub";

const LA_FALLBACK = { lat: 34.0522, lng: -118.2437 };
const USER_CHECKIN_RESOURCES = ["check_ins"] as const;
const USER_PROFILE_RESOURCES = ["profiles"] as const;
const USER_FRIEND_RESOURCES = ["friendships", "profiles"] as const;
const USER_MATCH_RESOURCES = ["matches", "match_participants"] as const;
const RUN_RESOURCES = ["runs", "run_participants"] as const;
const VISIT_RESOURCES = ["planned_visits"] as const;
const FEED_RESOURCES = ["activity_events", "activity_event_likes"] as const;

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
  incomingFriendRequests: Player[];
  preferredSport: CourtSport | null;
  preferredCourtId: string | null;
  addCourt: (submission: VerifiedCourtSubmission) => Promise<CourtSubmissionResult>;
  checkIn: (courtId: string) => Promise<void>;
  checkOut: () => Promise<void>;
  visitCourt: (courtId: string) => Promise<void>;
  joinRun: (runId: string) => Promise<boolean>;
  addPlannedVisit: (courtId: string, plannedAtIso: string, note?: string, visibility?: Visibility) => Promise<boolean>;
  removePlannedVisit: (visitId: string) => Promise<boolean>;
  savePlannedVisitBatch: (
    courtId: string,
    additions: string[],
    removals: string[],
    visibility?: Visibility
  ) => Promise<boolean>;
  refreshPlannedVisits: () => Promise<void>;
  hypeItem: (feedId: string) => void;
  setLocalCourt: (courtId: string | null, courtObj?: Court) => Promise<boolean>;
  setVisibility: (v: Visibility) => Promise<void>;
  setPreferredSport: (sport: CourtSport | null) => Promise<void>;
  setPreferredCourtId: (courtId: string | null) => Promise<void>;
  addFriend: (playerId: string) => Promise<void>;
  acceptFriendRequest: (playerId: string) => Promise<boolean>;
  removeFriend: (playerId: string) => Promise<void>;
  isFriend: (playerId: string) => boolean;
  isFriendPending: (playerId: string) => boolean;
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
  const sport = (profile.preferred_sport?.toUpperCase() as CourtSport | undefined);
  const elo = sport === "BASKETBALL"
    ? profile.elo_basketball ?? profile.elo_rating ?? 1200
    : sport === "PICKLEBALL"
    ? profile.elo_pickleball ?? profile.elo_rating ?? 1200
    : profile.elo_rating ?? 1200;
  const wins = sport === "BASKETBALL"
    ? profile.basketball_wins ?? profile.wins ?? 0
    : sport === "PICKLEBALL"
    ? profile.pickleball_wins ?? profile.wins ?? 0
    : profile.wins ?? 0;
  const losses = sport === "BASKETBALL"
    ? profile.basketball_losses ?? profile.losses ?? 0
    : sport === "PICKLEBALL"
    ? profile.pickleball_losses ?? profile.losses ?? 0
    : profile.losses ?? 0;
  return {
    id: profile.id,
    name,
    elo,
    tier: getEloTier(elo),
    avatar: initials,
    wins,
    losses,
    checkIns: profile.total_court_time_minutes ?? 0,
    memberSince: profile.created_at,
    courtId: profile.local_court_id ?? undefined,
    sport,
    visibility: "public",
    isLocalPlus: !!profile.is_pro,
    friendIds: [],
  };
}

export function AppProvider({ children }: { children: React.ReactNode }) {
  const { user, profile, refreshProfile } = useAuth();
  const userId = user?.id ?? null;
  const realtimeHub = useRealtimeHub();

  const [courts, setCourts] = useState<Court[]>([]);
  const [localCourt, setLocalCourtObj] = useState<Court | null>(null);
  const [checkedInCourtId, setCheckedInCourtId] = useState<string | null>(null);
  const [lastVisitedCourtId, setLastVisitedCourtId] = useState<string | null>(null);
  const [localCourtId, setLocalCourtId] = useState<string | null>(null);
  const [runs, setRuns] = useState<GameRun[]>([]);
  const [plannedVisits, setPlannedVisits] = useState<PlannedVisit[]>([]);
  const [feed, setFeed] = useState<FeedItem[]>([]);
  const [matches, setMatches] = useState<MatchResult[]>([]);
  const [checkInCount, setCheckInCount] = useState(0);
  const [isLocalPlus, setIsLocalPlusState] = useState<boolean>(false);
  const [visibility, setVisibilityState] = useState<Visibility>("public");
  const [friendIds, setFriendIds] = useState<string[]>([]);
  const [incomingFriendRequests, setIncomingFriendRequests] = useState<Player[]>([]);
  // Outgoing requests awaiting a reply. Kept separate from friendIds so the
  // UI never presents a pending request as an established friendship.
  const [pendingFriendIds, setPendingFriendIds] = useState<string[]>([]);
  const [friends, setFriends] = useState<Player[]>([]);
  const [preferredSport, setPreferredSportState] = useState<CourtSport | null>(null);
  const [preferredCourtId, setPreferredCourtIdState] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const realtimeTimersRef = useRef(new Map<string, ReturnType<typeof setTimeout>>());

  // The presence store (CourtPresenceContext, mounted above this provider) is
  // the ONLY roster/count source. Actions here push a refresh into it so the
  // acting device converges instantly on every surface; other devices get the
  // same refresh from the realtime event.
  const refreshPresence = usePresenceRefresh();

  const currentUser = useMemo(
    () => ({ ...profileToPlayer(profile), checkIns: checkInCount }),
    [profile, checkInCount]
  );

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

  const addCourtAction = useCallback(async (submission: VerifiedCourtSubmission) => {
    const result = await createCourt(submission);
    if (result.court) {
      // The verification response is the narrowest possible invalidation: add
      // only the new authoritative row. Explore separately refreshes its
      // market-scoped list after the sheet reports success.
      setCourts((current) => [
        result.court!,
        ...current.filter((court) => court.id !== result.court!.id),
      ]);
    }
    return result;
  }, []);

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

  const refreshCheckInCount = useCallback(async () => {
    if (!userId) {
      setCheckInCount(0);
      return;
    }
    const verifiedCount = await fetchUserCheckInCount(userId);
    // A failed read is unknown, not zero. Keep the last verified value so a
    // transient outage cannot erase the user's visible history.
    if (verifiedCount != null) setCheckInCount(verifiedCount);
  }, [userId]);

  const refreshFriends = useCallback(async () => {
    if (!userId) return;
    const [list, states, incoming] = await Promise.all([
      fetchFriends(userId),
      fetchFriendshipStates(userId),
      fetchIncomingFriendRequests(userId),
    ]);
    setFriends(list);
    setIncomingFriendRequests(incoming);
    setFriendIds(list.map((f) => f.id));
    setPendingFriendIds(
      Object.entries(states)
        .filter(([, state]) => state.status === "pending")
        .map(([otherId]) => otherId)
    );
  }, [userId]);

  // Initial data load when the user or local court changes.
  useEffect(() => {
    let mounted = true;
    (async () => {
      setIsLoading(true);
      await Promise.all([
        refreshRuns(),
        refreshPlannedVisits(),
        refreshFeed(),
        refreshMatches(),
        refreshCheckInCount(),
        refreshFriends(),
      ]);
      if (mounted) setIsLoading(false);
    })();
    return () => { mounted = false; };
  }, [refreshRuns, refreshPlannedVisits, refreshFeed, refreshMatches, refreshCheckInCount, refreshFriends]);

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
        refreshCheckInCount(),
        refreshFriends(),
      ]);
    } finally {
      resyncInFlight.current = false;
    }
  }, [userId, refreshFeed, refreshRuns, refreshPlannedVisits, refreshCheckInCount, refreshFriends]);

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

  const scheduleRealtimeRefresh = useCallback((key: string, task: () => Promise<void>) => {
    const timers = realtimeTimersRef.current;
    const existing = timers.get(key);
    if (existing) clearTimeout(existing);
    timers.set(
      key,
      setTimeout(() => {
        timers.delete(key);
        void task();
      }, 150)
    );
  }, []);

  useEffect(() => {
    const timers = realtimeTimersRef.current;
    return () => {
      timers.forEach((timer) => clearTimeout(timer));
      timers.clear();
    };
  }, []);

  // The signed-in user's private topic covers only data that can change their
  // own experience. The acting client still refreshes immediately after its
  // write; this path is for writes from friends, opponents, triggers, or a
  // second device. Hub-level coalescing plus this store-level debounce means a
  // burst across user/court/market topics produces one authoritative query.
  useEffect(() => {
    if (!userId) return;
    const topic = `user:${userId}` as RealtimeTopic;
    return realtimeHub.subscribe(topic, (batch: RealtimeInvalidationBatch) => {
      if (batchHasResource(batch, USER_CHECKIN_RESOURCES)) {
        scheduleRealtimeRefresh("checked-in", refreshCheckedIn);
        scheduleRealtimeRefresh("check-in-count", refreshCheckInCount);
      }
      if (batchHasResource(batch, USER_PROFILE_RESOURCES)) {
        scheduleRealtimeRefresh("profile", refreshProfile);
      }
      if (batchHasResource(batch, USER_FRIEND_RESOURCES)) {
        scheduleRealtimeRefresh("friends", refreshFriends);
      }
      if (batchHasResource(batch, USER_MATCH_RESOURCES)) {
        scheduleRealtimeRefresh("matches", refreshMatches);
      }
      if (batchHasResource(batch, RUN_RESOURCES)) {
        scheduleRealtimeRefresh("runs", refreshRuns);
      }
      if (batchHasResource(batch, VISIT_RESOURCES)) {
        scheduleRealtimeRefresh("planned-visits", refreshPlannedVisits);
      }
      if (batchHasResource(batch, FEED_RESOURCES)) {
        scheduleRealtimeRefresh("feed", refreshFeed);
      }
    });
  }, [
    userId,
    realtimeHub,
    refreshCheckedIn,
    refreshCheckInCount,
    refreshProfile,
    refreshFriends,
    refreshMatches,
    refreshRuns,
    refreshPlannedVisits,
    refreshFeed,
    scheduleRealtimeRefresh,
  ]);

  // The exact local-court topic owns that court's feed. Court presence uses the
  // same topic through CourtPresenceContext; RealtimeHub deduplicates them into
  // one physical private channel with multiple local listeners.
  useEffect(() => {
    const courtId = localCourt?.id;
    if (!courtId) return;
    return realtimeHub.subscribe(`court:${courtId}` as RealtimeTopic, (batch) => {
      if (batchHasResource(batch, FEED_RESOURCES)) {
        scheduleRealtimeRefresh("feed", refreshFeed);
      }
    });
  }, [localCourt?.id, realtimeHub, refreshFeed, scheduleRealtimeRefresh]);

  // Schedule/Explore data is market-scoped. One Houston topic replaces the old
  // global runs/check-ins streams and covers only the area this user is viewing.
  const currentMarketTopic = marketTopic(localCourt?.market ?? courts[0]?.market);
  useEffect(() => {
    if (!currentMarketTopic) return;
    return realtimeHub.subscribe(currentMarketTopic, (batch) => {
      if (batchHasResource(batch, RUN_RESOURCES)) {
        scheduleRealtimeRefresh("runs", refreshRuns);
      }
      if (batchHasResource(batch, VISIT_RESOURCES)) {
        scheduleRealtimeRefresh("planned-visits", refreshPlannedVisits);
      }
    });
  }, [
    currentMarketTopic,
    realtimeHub,
    refreshRuns,
    refreshPlannedVisits,
    scheduleRealtimeRefresh,
  ]);

  // ─── Actions ───────────────────────────────────────────────────────────────
  const checkIn = useCallback(
    async (courtId: string) => {
      if (!userId) return;
      const prevCourtId = checkedInCourtId;
      const ok = await checkInToCourt(courtId, undefined, visibility);
      if (ok) {
        setCheckedInCourtId(courtId);
        setLastVisitedCourtId(courtId);
        void refreshCheckInCount();
      }
      // Converge the acting device now (don't wait for its own realtime echo):
      // the court acted on, plus the court implicitly checked out of — the
      // check_in RPC atomically closes any prior open check-in elsewhere.
      refreshPresence(courtId);
      if (prevCourtId && prevCourtId !== courtId) refreshPresence(prevCourtId);
      refreshFeed();
    },
    [userId, visibility, checkedInCourtId, refreshPresence, refreshFeed, refreshCheckInCount]
  );

  const checkOut = useCallback(async () => {
    if (!userId) return;
    const prevCourtId = checkedInCourtId;
    const ok = await checkOutOfCourt(userId);
    if (ok) {
      setCheckedInCourtId(null);
      void refreshCheckInCount();
    }
    if (prevCourtId) refreshPresence(prevCourtId);
    refreshFeed();
  }, [userId, checkedInCourtId, refreshPresence, refreshFeed, refreshCheckInCount]);

  const visitCourt = useCallback(async (courtId: string) => {
    setLastVisitedCourtId(courtId);
  }, []);

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

  // Adding a friend creates a *pending request*, never a friendship — see
  // request_friend in friendshipService. The previous optimistic
  // `setFriendIds([...prev, playerId])` claimed instant friendship, then
  // refreshFriends (accepted-only) removed it again, which is what made the
  // button look like it did nothing even once the write started succeeding.
  const addFriendAction = useCallback(async (playerId: string) => {
    if (!userId) return;
    const status = await addFriend(userId, playerId);
    if (status === "accepted") {
      await refreshFriends();
      return;
    }
    if (status === "pending") {
      setPendingFriendIds((prev) =>
        prev.includes(playerId) ? prev : [...prev, playerId]
      );
    }
  }, [userId, refreshFriends]);

  const removeFriendAction = useCallback(async (playerId: string) => {
    if (!userId) return;
    const ok = await removeFriend(userId, playerId);
    if (!ok) return;
    setFriendIds((prev) => prev.filter((id) => id !== playerId));
    setPendingFriendIds((prev) => prev.filter((id) => id !== playerId));
    await refreshFriends();
  }, [userId, refreshFriends]);

  const acceptFriendRequestAction = useCallback(async (playerId: string): Promise<boolean> => {
    const ok = await acceptFriendRequest(playerId);
    if (ok) await refreshFriends();
    return ok;
  }, [refreshFriends]);

  const isFriend = useCallback((playerId: string) => friendIds.includes(playerId), [friendIds]);
  const isFriendPending = useCallback(
    (playerId: string) => pendingFriendIds.includes(playerId),
    [pendingFriendIds]
  );
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
    async (courtId: string, plannedAtIso: string, note?: string, visibility: Visibility = "public"): Promise<boolean> => {
      if (!userId) return false;
      const ok = await createPlannedVisit(userId, courtId, plannedAtIso, note, visibility);
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

  // Schedule edit mode commits once. Cell taps remain local UI state, then a
  // bounded batch of idempotent upserts/deletes is followed by one refresh.
  const savePlannedVisitBatch = useCallback(
    async (
      courtId: string,
      additions: string[],
      removals: string[],
      visibility: Visibility = "public"
    ): Promise<boolean> => {
      if (!userId) return false;
      const results = await Promise.all([
        ...additions.map((plannedAtIso) =>
          createPlannedVisit(userId, courtId, plannedAtIso, undefined, visibility)
        ),
        ...removals.map((visitId) => deletePlannedVisit(visitId)),
      ]);
      const ok = results.every(Boolean);
      // A partial network failure may still have committed some idempotent
      // writes. Reconcile once while keeping the editor open for a safe retry.
      await refreshPlannedVisits();
      return ok;
    },
    [userId, refreshPlannedVisits]
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
        incomingFriendRequests,
        preferredSport,
        preferredCourtId,
        addCourt: addCourtAction,
        checkIn,
        checkOut,
        visitCourt,
        joinRun,
        addPlannedVisit,
        removePlannedVisit,
        savePlannedVisitBatch,
        refreshPlannedVisits,
        hypeItem,
        setLocalCourt,
        setVisibility,
        setPreferredSport,
        setPreferredCourtId,
        addFriend: addFriendAction,
        acceptFriendRequest: acceptFriendRequestAction,
        removeFriend: removeFriendAction,
        isFriend,
        isFriendPending,
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
