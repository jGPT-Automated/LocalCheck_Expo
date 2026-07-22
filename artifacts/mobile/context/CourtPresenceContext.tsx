import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { AppState } from "react-native";

import { Player } from "@/constants/data";
import { fetchActiveCheckIns } from "@/services/checkInService";
import { fetchLocalCount, fetchLocals } from "@/services/profileService";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/context/AuthContext";

/**
 * Single source of truth for live court presence.
 *
 * Every surface that shows a roster or an active/local count reads it from
 * here via usePresence(courtId) / useCourtCounts(ids). One Supabase Realtime
 * channel listens to check_ins and profiles changes and refreshes exactly the
 * courts currently on screen, so when another player checks in, every
 * watching screen updates within a second — no tab-switching, no stale
 * snapshots. A 60s poll + foreground refresh covers missed events.
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

interface CourtPresenceValue {
  presence: Record<string, CourtPresence>;
  counts: Record<string, CourtCounts>;
  watch: (courtId: string) => () => void;
  watchCounts: (courtIds: string[]) => () => void;
  refreshCourt: (courtId: string) => Promise<void>;
  refreshAllWatched: () => Promise<void>;
}

const CourtPresenceContext = createContext<CourtPresenceValue | null>(null);

const STALE_MS = 15_000;      // refetch on watch if older than this
const EVENT_DEBOUNCE_MS = 300;

export function CourtPresenceProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const userId = user?.id ?? null;

  const [presence, setPresence] = useState<Record<string, CourtPresence>>({});
  const [counts, setCounts] = useState<Record<string, CourtCounts>>({});

  // Ref-counted sets of what's on screen right now.
  const watchedRef = useRef<Map<string, number>>(new Map());
  const countWatchedRef = useRef<Map<string, number>>(new Map());
  const debounceRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());
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
    if (courtIds.length === 0) return;
    try {
      const { data, error } = await supabase
        .from("courts_with_stats")
        .select("id,active_check_in_count,local_player_count")
        .in("id", courtIds);
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

  // Debounced per-court refresh so a burst of events costs one query.
  const scheduleRefresh = useCallback(
    (courtId: string) => {
      const timers = debounceRef.current;
      const existing = timers.get(courtId);
      if (existing) clearTimeout(existing);
      timers.set(
        courtId,
        setTimeout(() => {
          timers.delete(courtId);
          if (watchedRef.current.has(courtId)) {
            refreshCourt(courtId);
          } else if (countWatchedRef.current.has(courtId)) {
            refreshCounts([courtId]);
          }
        }, EVENT_DEBOUNCE_MS)
      );
    },
    [refreshCourt, refreshCounts]
  );

  // ─── Watch registration (hooks call these) ─────────────────────────────────
  const watch = useCallback(
    (courtId: string) => {
      const map = watchedRef.current;
      map.set(courtId, (map.get(courtId) ?? 0) + 1);
      const entry = presenceRef.current[courtId];
      if (!entry || Date.now() - entry.lastSync > STALE_MS) {
        refreshCourt(courtId);
      }
      return () => {
        const n = (map.get(courtId) ?? 1) - 1;
        if (n <= 0) map.delete(courtId);
        else map.set(courtId, n);
      };
    },
    [refreshCourt]
  );

  const watchCounts = useCallback(
    (courtIds: string[]) => {
      const map = countWatchedRef.current;
      for (const id of courtIds) map.set(id, (map.get(id) ?? 0) + 1);
      refreshCounts(courtIds);
      return () => {
        for (const id of courtIds) {
          const n = (map.get(id) ?? 1) - 1;
          if (n <= 0) map.delete(id);
          else map.set(id, n);
        }
      };
    },
    [refreshCounts]
  );

  // ─── Realtime: one channel for the whole app ───────────────────────────────
  useEffect(() => {
    if (!userId) return;

    const channel = supabase
      .channel("court-presence")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "check_ins" },
        (payload) => {
          const row = (payload.new ?? payload.old) as { court_id?: string } | null;
          const courtId = row?.court_id ? String(row.court_id) : null;
          if (courtId && (watchedRef.current.has(courtId) || countWatchedRef.current.has(courtId))) {
            scheduleRefresh(courtId);
          }
        }
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "profiles" },
        (payload) => {
          // A local-court switch changes locals counts. The old court id isn't
          // in the payload (replica identity default), so refresh both the
          // court named in the new row and, cheaply, all watched courts'
          // counts — the watched set is small (what's on screen).
          const row = payload.new as { local_court_id?: string | null } | null;
          const newCourt = row?.local_court_id ? String(row.local_court_id) : null;
          if (newCourt) scheduleRefresh(newCourt);
          const watchedIds = new Set([
            ...watchedRef.current.keys(),
            ...countWatchedRef.current.keys(),
          ]);
          watchedIds.forEach((id) => {
            if (id !== newCourt) scheduleRefresh(id);
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId, scheduleRefresh]);

  // ─── Fallback: poll watched courts + refresh on app foreground ────────────
  useEffect(() => {
    if (!userId) return;
    const interval = setInterval(refreshAllWatched, 120_000);
    const sub = AppState.addEventListener("change", (state) => {
      if (state === "active") refreshAllWatched();
    });
    return () => {
      clearInterval(interval);
      sub.remove();
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
export function useCourtCounts(courtIds: string[]): Record<string, CourtCounts> {
  const ctx = useContext(CourtPresenceContext);
  if (!ctx) throw new Error("useCourtCounts must be used within CourtPresenceProvider");
  const { counts, watchCounts } = ctx;

  const key = courtIds.join(",");
  useEffect(() => {
    const ids = key ? key.split(",") : [];
    if (ids.length === 0) return;
    return watchCounts(ids);
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
