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

import { Court, Player } from "@/constants/data";
import { useAuth } from "@/context/AuthContext";
import { useRealtimeHub } from "@/context/RealtimeHubContext";
import {
  batchHasResource,
  marketTopic,
  type RealtimeTopic,
} from "@/lib/realtimeHub";
import { fetchActiveCheckIns } from "@/services/checkInService";
import { fetchLocals } from "@/services/profileService";
import { supabase } from "@/lib/supabase";

/**
 * Single source of truth for live court presence.
 *
 * Every surface that shows a roster or an active/local count reads it from
 * here via usePresence(courtId) / useCourtCounts(ids). Scoped Realtime
 * channels refresh exactly the courts currently on screen, so when another
 * player checks in, every watching screen updates within a second — no
 * tab-switching, no stale snapshots. No recurring timers: a single foreground
 * resync covers events missed while backgrounded.
 */

export interface CourtPresence {
  roster: Player[];       // active check-ins (45-min freshness rule)
  locals: Player[];       // players whose local court is this court
  activeCount: number;
  localCount: number;
  lastSync: number;       // epoch ms of last successful fetch
}

export interface CourtCounts {
  activeCount: number;
  localCount: number;
}

export type CourtCountTarget = Pick<Court, "id" | "market">;

interface CourtPresenceValue {
  presence: Record<string, CourtPresence>;
  counts: Record<string, CourtCounts>;
  watch: (courtId: string) => () => void;
  watchCounts: (courts: CourtCountTarget[]) => () => void;
  refreshCourt: (courtId: string) => Promise<void>;
  refreshAllWatched: () => Promise<void>;
}

const CourtPresenceContext = createContext<CourtPresenceValue | null>(null);

const STALE_MS = 15_000; // refetch on watch if older than this
const PRESENCE_RESOURCES = ["check_ins", "profiles"] as const;

export function CourtPresenceProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const userId = user?.id ?? null;
  const realtimeHub = useRealtimeHub();

  const [presence, setPresence] = useState<Record<string, CourtPresence>>({});
  const [counts, setCounts] = useState<Record<string, CourtCounts>>({});

  // Ref-counted sets of what's on screen right now.
  const watchedRef = useRef<Map<string, number>>(new Map());
  const countWatchedRef = useRef<
    Map<string, { refs: number; topic: RealtimeTopic }>
  >(new Map());
  const presenceRef = useRef(presence);
  presenceRef.current = presence;

  // ─── Fetchers ──────────────────────────────────────────────────────────────
  const refreshCourt = useCallback(async (courtId: string) => {
    if (!courtId) return;
    const [roster, locals] = await Promise.all([
      fetchActiveCheckIns(courtId),
      fetchLocals(courtId),
    ]);
    setPresence((prev) => ({
      ...prev,
      [courtId]: {
        roster,
        locals,
        activeCount: roster.length,
        localCount: locals.length,
        lastSync: Date.now(),
      },
    }));
    setCounts((prev) => ({
      ...prev,
      [courtId]: { activeCount: roster.length, localCount: locals.length },
    }));
  }, []);

  const refreshCounts = useCallback(async (courtIds: string[]) => {
    const uniqueIds = Array.from(new Set(courtIds.filter(Boolean)));
    if (uniqueIds.length === 0) return;
    try {
      const { data, error } = await supabase
        .from("courts_with_stats")
        .select("id,active_check_in_count,local_player_count")
        .in("id", uniqueIds);
      if (error || !data) return;
      setCounts((prev) => {
        const next = { ...prev };
        for (const row of data as { id: string; active_check_in_count: number; local_player_count: number }[]) {
          next[String(row.id)] = {
            activeCount: row.active_check_in_count ?? 0,
            localCount: row.local_player_count ?? 0,
          };
        }
        return next;
      });
    } catch {
      // network hiccup — poll/foreground refresh will retry
    }
  }, []);

  const refreshAllWatched = useCallback(async () => {
    const rosterIds = Array.from(watchedRef.current.keys());
    const countIds = Array.from(countWatchedRef.current.keys()).filter(
      (id) => !watchedRef.current.has(id)
    );
    await Promise.all([
      ...rosterIds.map((id) => refreshCourt(id)),
      refreshCounts(countIds),
    ]);
  }, [refreshCourt, refreshCounts]);

  // Roster views use exact court topics. Explore/map counts use one market
  // topic (Houston, Austin, etc.) instead of one channel per marker. The hub
  // deduplicates consumers and closes every channel in the background.
  const courtStopsRef = useRef(new Map<string, () => void>());
  const countTopicStopsRef = useRef(new Map<RealtimeTopic, () => void>());

  const ensureRosterChannel = useCallback(
    (courtId: string) => {
      if (courtStopsRef.current.has(courtId)) return;
      const topic = `court:${courtId}` as RealtimeTopic;
      const stop = realtimeHub.subscribe(topic, (batch) => {
        if (batchHasResource(batch, PRESENCE_RESOURCES)) void refreshCourt(courtId);
      });
      courtStopsRef.current.set(courtId, stop);
    },
    [realtimeHub, refreshCourt]
  );

  const releaseChannelIfUnwatched = useCallback((courtId: string) => {
    if (watchedRef.current.has(courtId)) return;
    const stop = courtStopsRef.current.get(courtId);
    if (!stop) return;
    courtStopsRef.current.delete(courtId);
    stop();
  }, []);

  const syncCountTopicSubscriptions = useCallback(() => {
    const desiredTopics = new Set(
      Array.from(countWatchedRef.current.values()).map((entry) => entry.topic)
    );

    for (const [topic, stop] of countTopicStopsRef.current) {
      if (desiredTopics.has(topic)) continue;
      countTopicStopsRef.current.delete(topic);
      stop();
    }

    for (const topic of desiredTopics) {
      if (countTopicStopsRef.current.has(topic)) continue;
      const stop = realtimeHub.subscribe(topic, (batch) => {
        if (!batchHasResource(batch, PRESENCE_RESOURCES)) return;
        const ids = Array.from(countWatchedRef.current.entries())
          .filter(([id, entry]) => entry.topic === topic && !watchedRef.current.has(id))
          .map(([id]) => id);
        if (ids.length > 0) void refreshCounts(ids);
      });
      countTopicStopsRef.current.set(topic, stop);
    }
  }, [realtimeHub, refreshCounts]);

  // ─── Watch registration (hooks call these) ─────────────────────────────────
  const watch = useCallback(
    (courtId: string) => {
      const map = watchedRef.current;
      map.set(courtId, (map.get(courtId) ?? 0) + 1);
      ensureRosterChannel(courtId);
      const entry = presenceRef.current[courtId];
      if (!entry || Date.now() - entry.lastSync > STALE_MS) {
        refreshCourt(courtId);
      }
      return () => {
        const n = (map.get(courtId) ?? 1) - 1;
        if (n <= 0) map.delete(courtId);
        else map.set(courtId, n);
        releaseChannelIfUnwatched(courtId);
      };
    },
    [refreshCourt, ensureRosterChannel, releaseChannelIfUnwatched]
  );

  const watchCounts = useCallback(
    (courts: CourtCountTarget[]) => {
      const map = countWatchedRef.current;
      for (const court of courts) {
        const existing = map.get(court.id);
        const topic = marketTopic(court.market) ?? (`court:${court.id}` as RealtimeTopic);
        map.set(court.id, { refs: (existing?.refs ?? 0) + 1, topic: existing?.topic ?? topic });
      }
      syncCountTopicSubscriptions();
      void refreshCounts(courts.map((court) => court.id));
      return () => {
        for (const court of courts) {
          const existing = map.get(court.id);
          const refs = (existing?.refs ?? 1) - 1;
          if (refs <= 0) map.delete(court.id);
          else if (existing) map.set(court.id, { ...existing, refs });
        }
        syncCountTopicSubscriptions();
      };
    },
    [refreshCounts, syncCountTopicSubscriptions]
  );

  // Release every requested topic when the provider unmounts (sign-out).
  useEffect(() => {
    const courtStops = courtStopsRef.current;
    const countStops = countTopicStopsRef.current;
    return () => {
      courtStops.forEach((stop) => stop());
      countStops.forEach((stop) => stop());
      courtStops.clear();
      countStops.clear();
    };
  }, []);

  // ─── Foreground resync: ONE scoped refresh, no recurring timer ─────────────
  useEffect(() => {
    if (!userId) return;
    const sub = AppState.addEventListener("change", (state) => {
      if (state === "active") refreshAllWatched();
    });
    let onVisible: (() => void) | undefined;
    if (Platform.OS === "web" && typeof document !== "undefined") {
      onVisible = () => {
        if (document.visibilityState === "visible") void refreshAllWatched();
      };
      document.addEventListener("visibilitychange", onVisible);
    }
    return () => {
      sub.remove();
      if (onVisible) document.removeEventListener("visibilitychange", onVisible);
    };
  }, [userId, refreshAllWatched]);

  const value = useMemo(
    () => ({ presence, counts, watch, watchCounts, refreshCourt, refreshAllWatched }),
    [presence, counts, watch, watchCounts, refreshCourt, refreshAllWatched]
  );

  return (
    <CourtPresenceContext.Provider value={value}>
      {children}
    </CourtPresenceContext.Provider>
  );
}

const EMPTY_PRESENCE: CourtPresence = {
  roster: [],
  locals: [],
  activeCount: 0,
  localCount: 0,
  lastSync: 0,
};

/**
 * Live roster + counts for one court. Registers the court as watched while
 * the component is mounted; realtime events refresh it automatically.
 */
export function usePresence(courtId: string | null | undefined): CourtPresence {
  const ctx = useContext(CourtPresenceContext);
  if (!ctx) throw new Error("usePresence must be used within CourtPresenceProvider");
  const { presence, watch } = ctx;

  useEffect(() => {
    if (!courtId) return;
    return watch(courtId);
  }, [courtId, watch]);

  return (courtId && presence[courtId]) || EMPTY_PRESENCE;
}

/**
 * Live counts for a list of courts (Explore cards, search results, map
 * markers). One bulk query against courts_with_stats; realtime events on any
 * of these courts refresh their counts.
 */
export function useCourtCounts(courts: CourtCountTarget[]): Record<string, CourtCounts> {
  const ctx = useContext(CourtPresenceContext);
  if (!ctx) throw new Error("useCourtCounts must be used within CourtPresenceProvider");
  const { counts, watchCounts } = ctx;

  const key = JSON.stringify(courts.map(({ id, market }) => ({ id, market })));
  useEffect(() => {
    const targets = JSON.parse(key) as CourtCountTarget[];
    if (targets.length === 0) return;
    return watchCounts(targets);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, watchCounts]);

  return counts;
}

/** Manual refresh hook for pull-to-refresh style interactions. */
export function usePresenceRefresh(): (courtId?: string) => Promise<void> {
  const ctx = useContext(CourtPresenceContext);
  if (!ctx) throw new Error("usePresenceRefresh must be used within CourtPresenceProvider");
  const { refreshCourt, refreshAllWatched } = ctx;
  return useCallback(
    (courtId?: string) => (courtId ? refreshCourt(courtId) : refreshAllWatched()),
    [refreshCourt, refreshAllWatched]
  );
}
