/**
 * Auto check-in at the player's local court (D35, D36; plan doc Spec 8).
 * Pure rules, tested without the phone: the circle, the hold, the status line
 * in Settings, and the notification.
 */

/** iOS geofences use Wi-Fi and cell positioning; under ~100 m they misfire. */
export const AUTO_CHECK_IN_RADIUS_M = 150;
/**
 * Checked in privately on arrival; posted (court, feed, friends' alerts) this
 * many minutes later unless the player hides it or leaves (Jesse, Oct 12).
 */
export const AUTO_CHECK_IN_HOLD_MINUTES = 5;
/** Auto check-ins end when the player leaves; this is the backstop. */
export const AUTO_CHECK_IN_MAX_HOURS = 1.5;

export const AUTO_CHECK_IN_TASK = "localcheck-auto-check-in";
export const AUTO_CHECK_IN_NOTIFICATION_ID = "localcheck-auto-check-in";
export const AUTO_CHECK_IN_CATEGORY = "auto-check-in";
export const AUTO_CHECK_IN_UNDO_ACTION = "undo";
/** Emitted after the notification's Undo runs (payload: boolean ok). */
export const AUTO_CHECK_IN_UNDONE_EVENT = "localcheck:auto-check-in-undone";
/** The 1.5-hour "Auto checked out" push and its I'm still here button. */
export const AUTO_CHECK_OUT_CATEGORY = "auto-check-out";
export const CHECK_BACK_IN_ACTION = "check_back_in";
/** Emitted after "I'm still here" runs (payload: boolean ok). */
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

/** The value on the Settings row that opens the auto check-in drawer. */
export function autoCheckInLabel(state: AutoCheckInState): string {
  switch (state) {
    case "on":
      return "ON";
    case "needs_always":
      return "PAUSED";
    case "no_court":
      return "NO COURT";
    case "unavailable":
      return "APP ONLY";
    default:
      return "OFF";
  }
}

export function autoCheckInSwitchValue(state: AutoCheckInState): boolean {
  return state === "on" || state === "needs_always";
}

/**
 * The phone shows "Checked in at …" after a minute inside the circle, so
 * driving past shows nothing (the "dwell" approach from Android's geofencing
 * guide; iOS has no built-in dwell).
 */
export const AUTO_CHECK_IN_NOTICE_DELAY_SECONDS = 60;

/** "4:05 PM" in the phone's own time. */
export function clockTime(date: Date): string {
  const hours = date.getHours();
  const minutes = String(date.getMinutes()).padStart(2, "0");
  return `${hours % 12 === 0 ? 12 : hours % 12}:${minutes} ${hours < 12 ? "AM" : "PM"}`;
}

/** When an arrival posts: 5 minutes after arriving. */
export function postsAt(arrivedAtIso: string | null | undefined, now: Date = new Date()): Date {
  const arrived = arrivedAtIso ? new Date(arrivedAtIso) : now;
  const base = Number.isNaN(arrived.getTime()) ? now : arrived;
  return new Date(base.getTime() + AUTO_CHECK_IN_HOLD_MINUTES * 60_000);
}

export function checkedInNotification(courtName: string, posts: Date): { title: string; body: string } {
  return {
    title: `Checked in at ${courtName}`,
    body: `Posts at ${clockTime(posts)}. Not playing? Tap Hide.`,
  };
}
