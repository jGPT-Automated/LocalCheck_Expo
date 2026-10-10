/**
 * Auto check-in at the player's local court (D35, D36; plan doc Spec 8).
 * Pure rules, tested without the phone: the circle, the hold, the status line
 * in Settings, and the notification.
 */

/** iOS geofences use Wi-Fi and cell positioning; under ~100 m they misfire. */
export const AUTO_CHECK_IN_RADIUS_M = 150;
/** Arrivals stay hidden this long so driving past never posts (D36). */
export const AUTO_CHECK_IN_HOLD_MINUTES = 3;
/** Auto check-ins end when the player leaves; this is the backstop. */
export const AUTO_CHECK_IN_MAX_HOURS = 3;

export const AUTO_CHECK_IN_TASK = "localcheck-auto-check-in";
export const AUTO_CHECK_IN_NOTIFICATION_ID = "localcheck-auto-check-in";
export const AUTO_CHECK_IN_CATEGORY = "auto-check-in";
export const AUTO_CHECK_IN_UNDO_ACTION = "undo";
/** Emitted after the notification's Undo runs (payload: boolean ok). */
export const AUTO_CHECK_IN_UNDONE_EVENT = "localcheck:auto-check-in-undone";
/** The 3-hour "You've been checked out" push (D38) and its buttons. */
export const AUTO_CHECK_OUT_CATEGORY = "auto-check-out";
export const CHECK_BACK_IN_ACTION = "check_back_in";
export const GOT_IT_ACTION = "got_it";
/** Emitted after "Check back in" runs (payload: boolean ok). */
export const AUTO_CHECK_IN_RESUMED_EVENT = "localcheck:auto-check-in-resumed";

export type AutoCheckInCourt = {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
};

export type AutoCheckInRegion = {
  identifier: string;
  latitude: number;
  longitude: number;
  radius: number;
  notifyOnEnter: true;
  notifyOnExit: true;
};

export function regionFor(court: AutoCheckInCourt): AutoCheckInRegion | null {
  const { latitude, longitude } = court;
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;
  if (Math.abs(latitude) > 90 || Math.abs(longitude) > 180) return null;
  if (latitude === 0 && longitude === 0) return null;
  return {
    identifier: court.id,
    latitude,
    longitude,
    radius: AUTO_CHECK_IN_RADIUS_M,
    notifyOnEnter: true,
    notifyOnExit: true,
  };
}

/**
 * What the phone allows. `unavailable` = Expo Go or a platform without
 * geofencing; `needs_always` = location is only While Using (or Once);
 * `denied` = location off for LocalCheck.
 */
export type AutoCheckInPermission = "always" | "needs_always" | "denied" | "unavailable";

export type AutoCheckInState = "on" | "off" | "needs_always" | "no_court" | "unavailable";

export function autoCheckInState(input: {
  available: boolean;
  running: boolean;
  permission: AutoCheckInPermission;
  hasLocalCourt: boolean;
}): AutoCheckInState {
  if (!input.available || input.permission === "unavailable") return "unavailable";
  if (!input.hasLocalCourt) return "no_court";
  if (!input.running) return "off";
  if (input.permission !== "always") return "needs_always";
  return "on";
}

/** One line under the Settings switch. The court is the row above, so only "on" names it. */
export function autoCheckInDetail(state: AutoCheckInState, courtName?: string | null): string {
  switch (state) {
    case "on":
      return `On at ${courtName ?? "your local court"}`;
    case "off":
      return "Checks you in when you arrive";
    case "needs_always":
      return "Paused. Set Location to Always in iPhone Settings";
    case "no_court":
      return "Pick a local court first";
    case "unavailable":
      return "Available in the App Store version";
  }
}

export function autoCheckInSwitchValue(state: AutoCheckInState): boolean {
  return state === "on" || state === "needs_always";
}

/** When the "Checked in" notification should fire for a held arrival. */
export function notifyAt(arrivedAtIso: string | null | undefined, now: Date = new Date()): Date {
  const arrived = arrivedAtIso ? new Date(arrivedAtIso) : now;
  const at = new Date(
    (Number.isNaN(arrived.getTime()) ? now : arrived).getTime() +
      AUTO_CHECK_IN_HOLD_MINUTES * 60_000,
  );
  // Never in the past: at least a few seconds out so iOS accepts it.
  return at.getTime() < now.getTime() + 5_000 ? new Date(now.getTime() + 5_000) : at;
}

export function checkedInNotification(courtName: string): { title: string; body: string } {
  return {
    title: `Checked in at ${courtName}`,
    body: "Auto check-in. Not playing? Tap Not here.",
  };
}
