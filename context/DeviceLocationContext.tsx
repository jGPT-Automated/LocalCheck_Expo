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
// cached device fix while another was still on the LA fallback. Every
// consumer now reads the same resolved coordinate and can call refresh() to
// force a fresh read (used by "center on me" / "find nearest court").
//
// The LA fallback only applies once permission is truly denied or the device
// is unavailable — never while a real fix is still in flight — so a slow
// cold-start permission prompt can't get locked into LA for the session.

export interface DeviceLocationValue {
  coord: DeviceCoordinate | null;
  status: DeviceLocationStatus;
  // Returns the coordinate together with the status from that same attempt.
  // Callers that require real GPS must not confuse a denied/unavailable
  // display fallback with a permission-backed device fix.
  refresh: () => Promise<DeviceLocationResolution>;
}

const LA_FALLBACK = { lat: 34.0522, lng: -118.2437 };

const DeviceLocationContext = createContext<DeviceLocationValue | null>(null);

export function DeviceLocationProvider({ children }: { children: React.ReactNode }) {
  const [coord, setCoord] = useState<DeviceLocationValue["coord"]>(null);
  const [status, setStatus] = useState<DeviceLocationStatus>("idle");
  const inFlight = useRef<Promise<DeviceLocationResolution> | null>(null);

  const resolve = useCallback(async () => {
    if (inFlight.current) return inFlight.current;
    const run = (async () => {
      setStatus("loading");
      try {
        const { status: permission } = await Location.requestForegroundPermissionsAsync();
        if (permission !== "granted") {
          setCoord(LA_FALLBACK);
          setStatus("denied");
          return { coord: LA_FALLBACK, status: "denied" as const };
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
        let fallback: DeviceLocationValue["coord"] = null;
        setCoord((current) => {
          fallback = current ?? LA_FALLBACK;
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
    void resolve();
  }, [resolve]);

  return (
    <DeviceLocationContext.Provider value={{ coord, status, refresh: resolve }}>
      {children}
    </DeviceLocationContext.Provider>
  );
}

export function useDeviceLocation(): DeviceLocationValue {
  const ctx = useContext(DeviceLocationContext);
  if (!ctx) throw new Error("useDeviceLocation must be used within DeviceLocationProvider");
  return ctx;
}
