import React, { createContext, useContext, useMemo, useState } from "react";

import type { Court } from "@/constants/data";
import { useApp } from "@/context/AppContext";
import { useAuth } from "@/context/AuthContext";
import { useLocalPlus } from "@/hooks/useLocalPlus";
import { addLocalListCourt, orderLocalList } from "@/lib/localListModel";

type Draft = {
  ownerId: string | null;
  sourceId: string | null;
  courts: Court[];
  defaultId: string | null;
};
type Value = {
  courts: Court[];
  defaultCourt: Court | null;
  canEdit: boolean;
  addCourt: (court: Court) => void;
  removeCourt: (id: string) => void;
  setDefaultCourt: (id: string) => void;
};
const LocalListContext = createContext<Value | null>(null);

/** UI draft only until the separately approved backend slice. No device persistence or invented RPC. */
export function LocalListProvider({ children }: { children: React.ReactNode }) {
  const { localCourt } = useApp();
  const { user } = useAuth();
  const canEdit = useLocalPlus();
  const [draft, setDraft] = useState<Draft | null>(null);
  const ownerId = user?.id ?? null;
  const sourceId = localCourt?.id ?? null;
  const seed: Draft = {
    ownerId,
    sourceId,
    courts: localCourt ? [localCourt] : [],
    defaultId: sourceId,
  };
  const current = (previous: Draft | null): Draft => {
    if (previous?.ownerId !== ownerId) return seed;
    if (previous.sourceId === sourceId) return previous;
    if (previous.sourceId === null && localCourt)
      return {
        ...previous,
        sourceId,
        courts: [
          localCourt,
          ...previous.courts.filter((court) => court.id !== sourceId),
        ],
        defaultId: previous.defaultId ?? sourceId,
      };
    return seed;
  };
  const base = current(draft);
  const courts = useMemo(
    () => orderLocalList(base.courts, base.defaultId, canEdit),
    [base.courts, base.defaultId, canEdit],
  );
  const value: Value = {
    courts,
    defaultCourt: courts[0] ?? null,
    canEdit,
    addCourt: (court) => {
      if (!canEdit)
        throw new Error("LocalPlus is required to add more courts.");
      // Validate before scheduling state so the calling control can show its error.
      addLocalListCourt(base.courts, court);
      setDraft((previous) => {
        const row = current(previous);
        return {
          ...row,
          courts:
            row.courts.length >= 5
              ? row.courts
              : addLocalListCourt(row.courts, court),
          defaultId: row.defaultId,
        };
      });
    },
    removeCourt: (id) => {
      if (!canEdit || id === courts[0]?.id) return;
      setDraft((previous) => {
        const row = current(previous);
        return {
          ...row,
          courts: row.courts.filter((court) => court.id !== id),
        };
      });
    },
    setDefaultCourt: (id) => {
      if (!canEdit || !base.courts.some((court) => court.id === id)) return;
      setDraft((previous) => ({ ...current(previous), defaultId: id }));
    },
  };
  return (
    <LocalListContext.Provider value={value}>
      {children}
    </LocalListContext.Provider>
  );
}

export function useLocalList(): Value {
  const value = useContext(LocalListContext);
  if (!value) throw new Error("LocalListProvider is required");
  return value;
}
