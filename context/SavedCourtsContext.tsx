import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { AppState } from "react-native";

import type { Court } from "@/constants/data";
import { useApp } from "@/context/AppContext";
import { useAuth } from "@/context/AuthContext";
import { useRealtimeHub } from "@/context/RealtimeHubContext";
import { useLocalPlus } from "@/hooks/useLocalPlus";
import { batchHasResource, type RealtimeTopic } from "@/lib/realtimeHub";
import { selectHomeCourt } from "@/lib/savedCourtsModel";
import { changeSavedCourt, fetchSavedCourts, resolveSavedCourtAutoCheckIn, type SavedCourt, type AvailableSavedCourt } from "@/services/savedCourtsService";

const RESOURCES = ["saved_courts", "profiles"] as const;
type SavedCourtsValue = {
  hasLocalPlus: boolean;
  entries: SavedCourt[];
  availableEntries: AvailableSavedCourt[];
  resolveLegacyPreference: (courtId: string, enabled: boolean) => Promise<boolean>;
  loading: boolean;
  refreshing: boolean;
  error: string | null;
  homeCourt: Court | null;
  primaryCourt: Court | null;
  chooseHomeCourt: (id: string) => void;
  refresh: () => Promise<void>;
  save: (courtId: string) => Promise<void>;
  remove: (courtId: string) => Promise<void>;
  setAutoCheckIn: (courtId: string, enabled: boolean) => Promise<void>;
};
const SavedCourtsContext = createContext<SavedCourtsValue | null>(null);

/** Paid list state is always read from Supabase. The viewed court is only a
 * transient screen selection and never writes profiles.local_court_id. */
export function SavedCourtsProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const { localCourt, applyPrimaryCourt } = useApp();
  const hasLocalPlus = useLocalPlus();
  const hub = useRealtimeHub();
  const [entries, setEntries] = useState<SavedCourt[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasSnapshot, setHasSnapshot] = useState(false);
  const [primaryId, setPrimaryId] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const generation = useRef(0);
  const inFlight = useRef(new Set<string>());

  const refresh = useCallback(async (throwOnError = false) => {
    const revision = ++generation.current;
    if (!hasLocalPlus || !user) {
      setEntries([]);
      setLoading(false);
      setRefreshing(false);
      setError(null);
      return;
    }
    setRefreshing(true);
    try {
      const snapshot = await fetchSavedCourts(user.id);
      if (generation.current !== revision) return;
      setEntries(snapshot.entries);
      setPrimaryId(snapshot.primaryCourtId);
      setHasSnapshot(true);
      applyPrimaryCourt(snapshot.primaryCourtId, snapshot.entries.find((row) => row.courtId === snapshot.primaryCourtId)?.court ?? null);
      setError(null);
    } catch (err) {
      if (generation.current === revision) setError((err as Error).message);
      if (throwOnError) throw err;
    } finally {
      if (generation.current === revision) { setLoading(false); setRefreshing(false); }
    }
  }, [hasLocalPlus, user?.id, applyPrimaryCourt]);

  useEffect(() => {
    setLoading(true);
    void refresh();
    return () => { generation.current++; };
  }, [refresh]);
  useEffect(() => {
    if (!user || !hasLocalPlus) return;
    return hub.subscribe(`user:${user.id}` as RealtimeTopic, (batch) => {
      if (batchHasResource(batch, RESOURCES)) void refresh();
    });
  }, [hub, user?.id, hasLocalPlus, refresh]);
  useEffect(() => {
    const sub = AppState.addEventListener("change", (next) => { if (next === "active") void refresh(); });
    return () => sub.remove();
  }, [refresh]);

  const mutate = useCallback(async (action: "save" | "remove" | "auto", courtId: string, enabled?: boolean) => {
    if (!hasLocalPlus || !user) throw new Error("LocalPlus");
    if (inFlight.current.has(courtId)) return;
    inFlight.current.add(courtId);
    try {
      await changeSavedCourt(action, courtId, enabled);
      await refresh(true);
    } finally { inFlight.current.delete(courtId); }
  }, [hasLocalPlus, user?.id, refresh]);
  const availableEntries = useMemo(() => entries.filter((entry): entry is AvailableSavedCourt => entry.court !== null), [entries]);
  const resolveLegacyPreference = useCallback(async (courtId: string, enabled: boolean) => {
    const actual = await resolveSavedCourtAutoCheckIn(courtId, enabled);
    setEntries((rows) => rows.map((row) => row.courtId === courtId ? { ...row, autoCheckInEnabled: actual } : row));
    return actual;
  }, []);
  const primaryCourt = hasSnapshot ? entries.find((row) => row.courtId === primaryId)?.court ?? null : localCourt;
  const value = useMemo<SavedCourtsValue>(() => ({
    hasLocalPlus, entries, availableEntries, resolveLegacyPreference, loading, refreshing, error, primaryCourt,
    homeCourt: selectHomeCourt(hasLocalPlus, selectedId, availableEntries.map((entry) => entry.court), hasLocalPlus ? primaryCourt : localCourt),
    chooseHomeCourt: setSelectedId, refresh,
    save: (id) => mutate("save", id),
    remove: (id) => mutate("remove", id),
    setAutoCheckIn: (id, enabled) => mutate("auto", id, enabled),
  }), [hasLocalPlus, entries, availableEntries, resolveLegacyPreference, loading, refreshing, error, selectedId, primaryCourt, localCourt, refresh, mutate]);
  return <SavedCourtsContext.Provider value={value}>{children}</SavedCourtsContext.Provider>;
}

export function useSavedCourts(): SavedCourtsValue {
  const value = useContext(SavedCourtsContext);
  if (!value) throw new Error("useSavedCourts must be inside SavedCourtsProvider");
  return value;
}
