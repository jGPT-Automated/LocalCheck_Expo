import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import React, { createContext, useContext, useEffect, useMemo } from "react";
import { AppState } from "react-native";

import type { Court } from "@/constants/data";
import { useApp } from "@/context/AppContext";
import { useAuth } from "@/context/AuthContext";
import { useLocalPlus } from "@/hooks/useLocalPlus";
import { fetchLocalList, updateLocalList } from "@/services/courtService";

type Value = {
  courts: Court[];
  defaultCourt: Court | null;
  entries: Awaited<ReturnType<typeof fetchLocalList>>;
  ready: boolean;
  error: boolean;
  reload: () => void;
  busy: boolean;
  canEdit: boolean;
  addCourt: (court: Court) => Promise<void>;
  removeCourt: (id: string) => Promise<void>;
  setDefaultCourt: (id: string) => Promise<void>;
  setAutoCheckIn: (id: string, enabled: boolean) => Promise<void>;
};
const LocalListContext = createContext<Value | null>(null);

export function LocalListProvider({ children }: { children: React.ReactNode }) {
  const { localCourt, acceptSavedDefault } = useApp();
  const { user, profile, refreshProfile } = useAuth();
  const canEdit = useLocalPlus();
  const cache = useQueryClient();
  const key = useMemo(() => ["local-list", user?.id], [user?.id]);
  const enabled = Boolean(user && canEdit);
  const query = useQuery({ queryKey: key, queryFn: fetchLocalList, enabled, retry: 1 });
  useEffect(() => {
    if (!enabled) return;
    const reload = () => { void cache.invalidateQueries({ queryKey: key }); };
    reload();
    const subscription = AppState.addEventListener("change", state => { if (state === "active") reload(); });
    return () => subscription.remove();
  }, [cache, enabled, key, profile?.local_court_id]);
  const entries = useMemo(() => enabled && query.data ? query.data : localCourt
    ? [{ court: localCourt, isDefault: true, autoCheckIn: null }] : [], [enabled, query.data, localCourt]);
  const courts = useMemo(() => entries.map(row => row.court), [entries]);
  const defaultCourt = entries.find(row => row.isDefault)?.court ?? null;
  const mutation = useMutation({
    scope: { id: `local-list-${user?.id}` },
    mutationFn: async (args: Parameters<typeof updateLocalList>) => {
      await updateLocalList(...args);
      await cache.cancelQueries({ queryKey: key });
      const rows = await fetchLocalList();
      cache.setQueryData(key, rows);
      if (args[0] === "default" || (args[0] === "add" && !localCourt)) {
        const next = rows.find(row => row.isDefault)?.court;
        if (next) acceptSavedDefault(next);
        await refreshProfile();
      }
    },
    onError: () => { void cache.invalidateQueries({ queryKey: key }); },
  });
  const value: Value = {
    entries, courts, defaultCourt, ready: enabled && query.isSuccess, error: enabled && query.isError,
    reload: () => { void query.refetch(); }, busy: mutation.isPending, canEdit,
    addCourt: court => mutation.mutateAsync(["add", court.id]),
    removeCourt: id => mutation.mutateAsync(["remove", id]),
    setDefaultCourt: id => mutation.mutateAsync(["default", id]),
    setAutoCheckIn: (id, on) => mutation.mutateAsync(["auto", id, on]),
  };
  return <LocalListContext.Provider value={value}>{children}</LocalListContext.Provider>;
}

export function useLocalList(): Value {
  const value = useContext(LocalListContext);
  if (!value) throw new Error("useLocalList must be used inside LocalListProvider");
  return value;
}
