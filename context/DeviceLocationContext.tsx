import * as Location from "expo-location";
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";

import type {
  DeviceCoordinate,
  DeviceLocationResolution,
  DeviceLocationStatus,
} from "./deviceLocationModel";

export type { DeviceLocationStatus } from "./deviceLocationModel";

// Single shared GPS source. Explore's list, Explore's map, and AppContext's
// nearby-court fetch used to each run their own independent
// requestForegroundPermissionsAsync/getCurrentPositionAsync call, so the
// three surfaces could disagree — one could be sitting on a permanently
// cached device fix while another was still stale. Every consumer now reads
// the same resolved coordinate and can call refresh() to force a fresh read
// (used by "center on me" / "find nearest court").
//
// Denied/unavailable resolves to a null coordinate, never a substitute city —
// every consumer already treats "no coordinate" as its own real state
// (Explore falls back to the saved local court or an empty/prompt state;
// nothing downstream ever assumed a coordinate was guaranteed).

export interface DeviceLocationValue {
  coord: DeviceCoordinate | null;
  status: DeviceLocationStatus;
  // Returns the coordinate together with the status from that same attempt.
  // Callers that require real GPS must not confuse a denied/unavailable
  // display fallback with a permission-backed device fix.
  refresh: () => Promise<DeviceLocationResolution>;
  // Skips the very next auto-resolve triggered by `autoResolve` turning on.
  // Onboarding calls this when the user finishes via ZIP instead of "Share
  // location" — completing onboarding flips autoResolve on for the rest of
  // the app, and without this it would immediately fire the native prompt
  // right after the user explicitly opted out of sharing location.
  suppressNextAutoResolve: () => void;
}

const DeviceLocationContext = createContext<DeviceLocationValue | null>(null);

export function DeviceLocationProvider({
  children,
  // Whether to request the permission/fix the moment this provider mounts.
  // Onboarding wants this off: the OS prompt should only fire when the user
  // actually taps "Share location" there, not silently during an earlier
  // step. Every other session (onboarding already done) keeps the original
  // eager behavior — flipping this back on later (once onboarding finishes)
  // still resolves a fix for the first time.
  autoResolve = true,
}: {
  children: React.ReactNode;
  autoResolve?: boolean;
}) {
  const [coord, setCoord] = useState<DeviceLocationValue["coord"]>(null);
  const [status, setStatus] = useState<DeviceLocationStatus>("idle");
  const inFlight = useRef<Promise<DeviceLocationResolution> | null>(null);
  const suppressNextRef = useRef(false);
  const suppressNextAutoResolve = useCallback(() => {
    suppressNextRef.current = true;
  }, []);

  const resolve = useCallback(async () => {
    if (inFlight.current) return inFlight.current;
    const run = (async () => {
      setStatus("loading");
      try {
        const { status: permission } = await Location.requestForegroundPermissionsAsync();
        if (permission !== "granted") {
          setCoord(null);
          setStatus("denied");
          return { coord: null, status: "denied" as const };
        }
        const last = await Location.getLastKnownPositionAsync();
        if (last) {
          setCoord({ lat: last.coords.latitude, lng: last.coords.longitude });
        }
        const loc = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
        });
        const resolved = { lat: loc.coords.latitude, lng: loc.coords.longitude };
        setCoord(resolved);
        setStatus("granted");
        return { coord: resolved, status: "granted" as const };
      } catch {
        // A transient error on a later refresh() shouldn't discard an
        // already-resolved real fix — only a first-ever attempt has nothing
        // to fall back to.
        let fallback: DeviceLocationValue["coord"] = null;
        setCoord((current) => {
          fallback = current;
          return fallback;
        });
        setStatus("unavailable");
        return { coord: fallback, status: "unavailable" as const };
      } finally {
        inFlight.current = null;
      }
    })();
    inFlight.current = run;
    return run;
  }, []);

  useEffect(() => {
    if (!autoResolve) return;
    if (suppressNextRef.current) {
      suppressNextRef.current = false;
      return;
    }
    void resolve();
  }, [autoResolve, resolve]);

  return (
    <DeviceLocationContext.Provider
      value={{ coord, status, refresh: resolve, suppressNextAutoResolve }}
    >
      {children}
    </DeviceLocationContext.Provider>
  );
}

export function useDeviceLocation(): DeviceLocationValue {
  const ctx = useContext(DeviceLocationContext);
  if (!ctx) throw new Error("useDeviceLocation must be used within DeviceLocationProvider");
  return ctx;
}
