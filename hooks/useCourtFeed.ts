import { useCallback, useEffect, useRef, useState } from "react";
import { AppState } from "react-native";
import type { FeedItem } from "@/constants/data";
import { useAuth } from "@/context/AuthContext";
import { useRealtimeHub } from "@/context/RealtimeHubContext";
import { batchHasResource, type RealtimeTopic } from "@/lib/realtimeHub";
import { fetchFeed } from "@/services/feedService";

const RESOURCES = ["activity_events", "activity_event_likes"] as const;

/** One court feed lifecycle for Home, court detail and the court drawer. */
export function useCourtFeed(courtId: string | null, limit = 50): FeedItem[] {
  const { user } = useAuth();
  const hub = useRealtimeHub();
  const revision = useRef(0);
  const [state, setState] = useState<{ courtId: string | null; items: FeedItem[] }>({ courtId: null, items: [] });
  const refresh = useCallback(async () => {
    const next = ++revision.current;
    if (!courtId) return;
    const items = await fetchFeed(courtId, user?.id);
    if (next === revision.current) setState({ courtId, items: items.slice(0, limit) });
  }, [courtId, user?.id, limit]);
  useEffect(() => {
    void refresh();
    return () => { revision.current++; };
  }, [refresh]);
  useEffect(() => {
    if (!courtId) return;
    const unsubscribe = hub.subscribe(`court:${courtId}` as RealtimeTopic, (batch) => {
      if (batchHasResource(batch, RESOURCES)) void refresh();
    });
    const sub = AppState.addEventListener("change", (next) => { if (next === "active") void refresh(); });
    return () => { unsubscribe(); sub.remove(); };
  }, [courtId, hub, refresh]);
  return state.courtId === courtId ? state.items : [];
}
