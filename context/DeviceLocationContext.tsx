import * as Location from "expo-location";
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";

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

export type DeviceLocationStatus = "idle" | "loading" | "granted" | "denied" | "unavailable";

export interface DeviceLocationValue {
  coord: { lat: number; lng: number } | null;
  status: DeviceLocationStatus;
  // Returns the freshly resolved coordinate directly — callers that need the
  // result in the same tick (flyToUser, findNearestCourt) can't rely on the
  // `coord` from their render closure, since state updates don't land until
  // the next render.
  refresh: () => Promise<DeviceLocationValue["coord"]>;
}

const LA_FALLBACK = { lat: 34.0522, lng: -118.2437 };

const DeviceLocationContext = createContext<DeviceLocationValue | null>(null);

export function DeviceLocationProvider({ children }: { children: React.ReactNode }) {
  const [coord, setCoord] = useState<DeviceLocationValue["coord"]>(null);
  const [status, setStatus] = useState<DeviceLocationStatus>("idle");
  const inFlight = useRef<Promise<DeviceLocationValue["coord"]> | null>(null);

  const resolve = useCallback(async () => {
    if (inFlight.current) return inFlight.current;
    const run = (async () => {
      setStatus("loading");
      try {
        const { status: permission } = await Location.requestForegroundPermissionsAsync();
        if (permission !== "granted") {
          setCoord(LA_FALLBACK);
          setStatus("denied");
          return LA_FALLBACK;
        }
        const last = await Location.getLastKnownPositionAsync();
        const loc =
          last ?? (await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }));
        const resolved = { lat: loc.coords.latitude, lng: loc.coords.longitude };
        setCoord(resolved);
        setStatus("granted");
        return resolved;
      } catch {
        let fallback: DeviceLocationValue["coord"] = null;
        setCoord((current) => {
          fallback = current ?? LA_FALLBACK;
          return fallback;
        });
        setStatus("unavailable");
        return fallback;
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
