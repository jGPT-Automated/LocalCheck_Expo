import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AppState } from "react-native";

import type { PlannedVisit } from "@/constants/data";
import { useApp } from "@/context/AppContext";
import { useRealtimeHub } from "@/context/RealtimeHubContext";
import type { CheckInSpan } from "@/lib/courtHours";
import { batchHasResource, type RealtimeTopic } from "@/lib/realtimeHub";
import { fetchCourtWeekSpans } from "@/services/courtService";
import {
  fetchCourtPlannedTimes,
  fetchPlannedVisits,
} from "@/services/plannedVisitService";

export interface CourtActivityData {
  ready: boolean;
  now: number;
  spans: CheckInSpan[];
  planned: Date[];
  visits: PlannedVisit[];
  loading: boolean;
  error: boolean;
  refresh: () => void;
}

/** One court snapshot for both the chart and its hour rows. No per-row reads. */
export function useCourtActivity(
  courtId: string,
  refreshKey?: number | string,
): CourtActivityData {
  const { plannedVisits } = useApp();
  const hub = useRealtimeHub();
  const [snapshot, setSnapshot] = useState<{
    courtId: string;
    spans: CheckInSpan[];
    planned: Date[];
    visits: PlannedVisit[];
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [now, setNow] = useState(Date.now);
  const [version, setVersion] = useState(0);
  const generation = useRef(0);
  const refresh = useCallback(() => setVersion((v) => v + 1), []);

  useEffect(() => {
    const request = ++generation.current;
    let active = true;
    setLoading(true);
    setError(false);
    const from = new Date();
    from.setHours(0, 0, 0, 0);
    const to = new Date(from);
    to.setDate(to.getDate() + 7);
    void Promise.all([
      fetchCourtWeekSpans(courtId, true),
      fetchCourtPlannedTimes(courtId, from, to, true),
      fetchPlannedVisits({ courtId, from, to, throwOnError: true }),
    ])
      .then(([spans, planned, visits]) => {
        if (active && request === generation.current)
          setSnapshot({ courtId, spans, planned, visits });
      })
      .catch(() => {
        if (active && request === generation.current) setError(true);
      })
      .finally(() => {
        if (active && request === generation.current) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [courtId, refreshKey, plannedVisits, version]);

  useEffect(
    () =>
      hub.subscribe(`court:${courtId}` as RealtimeTopic, (batch) => {
        if (
          batchHasResource(batch, [
            "check_ins",
            "planned_visits",
            "runs",
            "run_participants",
          ])
        )
          refresh();
      }),
    [courtId, hub, refresh],
  );
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(timer);
  }, []);
  useEffect(() => {
    const sub = AppState.addEventListener("change", (state) => {
      if (state === "active") {
        setNow(Date.now());
        refresh();
      }
    });
    const visible = () => {
      if (document.visibilityState === "visible") refresh();
    };
    if (typeof document !== "undefined")
      document.addEventListener("visibilitychange", visible);
    return () => {
      sub.remove();
      if (typeof document !== "undefined")
        document.removeEventListener("visibilitychange", visible);
    };
  }, [refresh]);
  const current = snapshot?.courtId === courtId ? snapshot : null;
  return useMemo(
    () => ({
      ready: Boolean(current),
      now,
      spans: current?.spans ?? [],
      planned: current?.planned ?? [],
      visits: current?.visits ?? [],
      loading: loading || (!current && !error),
      error,
      refresh,
    }),
    [current, now, loading, error, refresh],
  );
}
