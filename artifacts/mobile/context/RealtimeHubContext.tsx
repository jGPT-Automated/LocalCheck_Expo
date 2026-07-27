import React, { createContext, useContext, useEffect, useMemo, useRef } from "react";
import { AppState, Platform } from "react-native";

import { useAuth } from "@/context/AuthContext";
import { RealtimeHub } from "@/lib/realtimeHub";
import { supabase } from "@/lib/supabase";

const RealtimeHubContext = createContext<RealtimeHub | null>(null);

export function RealtimeHubProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const userId = user?.id;
  if (!userId) throw new Error("RealtimeHubProvider requires an authenticated user");

  const hub = useMemo(
    () =>
      new RealtimeHub(supabase, userId, {
        onDiagnostic: ({ topic, status, error, activeTopics }) => {
          if (status === "SUBSCRIBED") {
            if (__DEV__) console.info(`[Realtime] ${status} ${topic} (${activeTopics} active)`);
            return;
          }
          console.warn(`[Realtime] ${status} ${topic}${error ? `: ${error}` : ""}`);
        },
      }),
    [userId]
  );

  const appActiveRef = useRef(AppState.currentState === "active");
  const webVisibleRef = useRef(
    Platform.OS !== "web" ||
      typeof document === "undefined" ||
      document.visibilityState === "visible"
  );

  useEffect(() => {
    const applyActivity = () => hub.setActive(appActiveRef.current && webVisibleRef.current);
    applyActivity();

    const appStateSub = AppState.addEventListener("change", (state) => {
      appActiveRef.current = state === "active";
      applyActivity();
    });

    let onVisibilityChange: (() => void) | undefined;
    if (Platform.OS === "web" && typeof document !== "undefined") {
      onVisibilityChange = () => {
        webVisibleRef.current = document.visibilityState === "visible";
        applyActivity();
      };
      document.addEventListener("visibilitychange", onVisibilityChange);
    }

    return () => {
      appStateSub.remove();
      if (onVisibilityChange) document.removeEventListener("visibilitychange", onVisibilityChange);
      hub.dispose();
    };
  }, [hub]);

  return <RealtimeHubContext.Provider value={hub}>{children}</RealtimeHubContext.Provider>;
}

export function useRealtimeHub(): RealtimeHub {
  const hub = useContext(RealtimeHubContext);
  if (!hub) throw new Error("useRealtimeHub must be used within RealtimeHubProvider");
  return hub;
}
