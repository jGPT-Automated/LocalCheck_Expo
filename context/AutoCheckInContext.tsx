import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { Alert, AppState, DeviceEventEmitter, Linking } from "react-native";

import { AutoCheckInSheet } from "@/components/autoCheckIn/AutoCheckInSheet";
import { useToast } from "@/components/ui/Toast";
import { useApp } from "@/context/AppContext";
import { useAuth } from "@/context/AuthContext";
import { profileNeedsOnboarding } from "@/lib/onboardingGate";
import {
  AUTO_CHECK_IN_RESUMED_EVENT,
  AUTO_CHECK_IN_UNDONE_EVENT,
  type AutoCheckInCourt,
  type AutoCheckInState,
  autoCheckInState,
} from "@/lib/autoCheckInModel";
import {
  disableAutoCheckIn,
  enableAutoCheckIn,
  getAutoCheckInPermission,
  isAutoCheckInAvailable,
  isAutoCheckInRunning,
  registerUndoAction,
  syncAutoCheckIn,
} from "@/services/autoCheckInService";

type AutoCheckInValue = {
  state: AutoCheckInState;
  busy: boolean;
  courtName: string | null;
  /** Opens the explainer sheet (Settings switch turning on). */
  offer: () => void;
  turnOff: () => Promise<void>;
  openSettings: () => void;
};

const AutoCheckInContext = createContext<AutoCheckInValue | null>(null);

/**
 * Auto check-in at the local court (D35, D36). Keeps the one geofence on the
 * current local court, stops it on sign-out, offers it once when a player
 * picks a local court, and shows the "Undone" toast.
 */
export function AutoCheckInProvider({ children }: { children: React.ReactNode }) {
  const { user, profile, isLoading } = useAuth();
  const { localCourt, refreshCheckedIn } = useApp();
  const { showToast } = useToast();
  const [state, setState] = useState<AutoCheckInState>(isAutoCheckInAvailable() ? "off" : "unavailable");
  const [busy, setBusy] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);

  const court: AutoCheckInCourt | null = useMemo(
    () =>
      localCourt
        ? {
            id: localCourt.id,
            name: localCourt.shortName || localCourt.name,
            latitude: localCourt.latitude,
            longitude: localCourt.longitude,
          }
        : null,
    [localCourt],
  );

  const hasLocalCourt = Boolean(court);
  const refresh = useCallback(async () => {
    const [running, permission] = await Promise.all([isAutoCheckInRunning(), getAutoCheckInPermission()]);
    setState(
      autoCheckInState({
        available: isAutoCheckInAvailable(),
        running,
        permission,
        hasLocalCourt,
      }),
    );
  }, [hasLocalCourt]);

  // Status on launch and whenever the app comes back (they may have changed
  // Location in iPhone Settings).
  useEffect(() => {
    void refresh();
    void registerUndoAction();
    const sub = AppState.addEventListener("change", (next) => {
      if (next === "active") void refresh();
    });
    return () => sub.remove();
  }, [refresh]);

  // The circle follows the local court (keyed on id + position, not object
  // identity, so routine refetches don't re-register it). Acts only on settled
  // data: on a cold start (including iOS launching the app in the background
  // for a geofence) the profile and court load a moment after the first
  // render, and an early "no court" must not switch the geofence off.
  const profileCourtId = profile ? (profile.local_court_id ?? null) : undefined;
  const courtKey = court ? `${court.id}:${court.latitude}:${court.longitude}` : "none";
  const courtRef = useRef(court);
  courtRef.current = court;
  useEffect(() => {
    if (!user || profileCourtId === undefined) return;
    if (profileCourtId === null) {
      void syncAutoCheckIn(null).then(refresh); // local court removed: stop
      return;
    }
    const current = courtRef.current;
    if (!current || current.id !== profileCourtId) return; // court still loading
    void syncAutoCheckIn(current).then(refresh);
  }, [courtKey, profileCourtId, user, refresh]);

  // Signed out (a real sign-out, not the empty first render): stop watching.
  const lastUserId = useRef<string | null>(null);
  useEffect(() => {
    if (isLoading) return;
    const id = user?.id ?? null;
    if (lastUserId.current && !id) void disableAutoCheckIn().then(refresh);
    lastUserId.current = id;
  }, [isLoading, user, refresh]);

  // Offer it once when the player picks (or changes) a local court this session.
  const baselineCourt = useRef<string | null | undefined>(undefined);
  useEffect(() => {
    if (!profile) return;
    const current = profile.local_court_id ?? null;
    // Not mid-onboarding: the offer waits until onboarding is done.
    if (profileNeedsOnboarding(profile)) {
      if (baselineCourt.current === undefined) baselineCourt.current = null;
      return;
    }
    if (baselineCourt.current === undefined) {
      baselineCourt.current = current;
      return;
    }
    if (current && current !== baselineCourt.current && (state === "off" || state === "no_court")) {
      setSheetOpen(true);
    }
    baselineCourt.current = current;
  }, [profile, state]);

  useEffect(() => {
    const sub = DeviceEventEmitter.addListener(AUTO_CHECK_IN_UNDONE_EVENT, (ok: boolean) => {
      showToast(
        ok
          ? { title: "REMOVED", body: "You're not checked in.", icon: "rotate-ccw" }
          : { title: "COULDN'T REMOVE", body: "Check out from the court page instead.", icon: "alert-circle" },
      );
      void refreshCheckedIn();
    });
    const resumed = DeviceEventEmitter.addListener(AUTO_CHECK_IN_RESUMED_EVENT, (ok: boolean) => {
      showToast(
        ok
          ? { title: "CHECKED BACK IN", body: "We'll check you out when you leave.", icon: "map-pin" }
          : { title: "COULDN'T CHECK IN", body: "Tap CHECK IN on the court instead.", icon: "alert-circle" },
      );
      void refreshCheckedIn();
    });
    return () => {
      sub.remove();
      resumed.remove();
    };
  }, [showToast, refreshCheckedIn]);

  const openSettings = useCallback(() => {
    void Linking.openSettings();
  }, []);

  const turnOn = useCallback(async () => {
    if (!court || busy) return;
    setBusy(true);
    const result = await enableAutoCheckIn(court);
    setBusy(false);
    setSheetOpen(false);
    await refresh();
    if (result === "on") {
      showToast({ title: "AUTO CHECK-IN ON", body: `We'll check you in at ${court.name}.`, icon: "map-pin" });
    } else if (result === "needs_always" || result === "denied") {
      Alert.alert(
        "Allow location Always",
        "Auto check-in needs Location set to Always for LocalCheck, so it works with your phone in your pocket.",
        [
          { text: "Not now", style: "cancel" },
          { text: "Open Settings", onPress: openSettings },
        ],
      );
    } else if (result === "error") {
      showToast({ title: "COULDN'T TURN ON", body: "Try again in a moment.", icon: "alert-circle" });
    }
  }, [busy, court, openSettings, refresh, showToast]);

  const turnOff = useCallback(async () => {
    await disableAutoCheckIn();
    await refresh();
  }, [refresh]);

  const offer = useCallback(() => {
    if (court && isAutoCheckInAvailable()) setSheetOpen(true);
  }, [court]);

  const value = useMemo(
    () => ({ state, busy, courtName: court?.name ?? null, offer, turnOff, openSettings }),
    [state, busy, court?.name, offer, turnOff, openSettings],
  );

  return (
    <AutoCheckInContext.Provider value={value}>
      {children}
      {court ? (
        <AutoCheckInSheet
          busy={busy}
          courtName={court.name}
          onClose={() => setSheetOpen(false)}
          onTurnOn={() => void turnOn()}
          visible={sheetOpen}
        />
      ) : null}
    </AutoCheckInContext.Provider>
  );
}

export function useAutoCheckIn(): AutoCheckInValue {
  const value = useContext(AutoCheckInContext);
  if (!value) throw new Error("useAutoCheckIn must be used inside AutoCheckInProvider");
  return value;
}
