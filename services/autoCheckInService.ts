import Constants, { ExecutionEnvironment } from "expo-constants";
import * as Location from "expo-location";
import * as TaskManager from "expo-task-manager";
import { Platform } from "react-native";

import {
  AUTO_CHECK_OUT_CATEGORY,
  AUTO_CHECK_IN_CATEGORY,
  CHECK_BACK_IN_ACTION,
  GOT_IT_ACTION,
  AUTO_CHECK_IN_NOTIFICATION_ID,
  AUTO_CHECK_IN_TASK,
  AUTO_CHECK_IN_UNDO_ACTION,
  type AutoCheckInCourt,
  type AutoCheckInPermission,
  checkedInNotification,
  notifyAt,
  regionFor,
} from "@/lib/autoCheckInModel";
import { supabase } from "@/lib/supabase";

/**
 * Auto check-in at the local court (D35, D36). One geofence, set from the
 * player's local court. iOS wakes the app for a few seconds on arrival and on
 * leaving; the task below tells the server, which holds arrivals 3 minutes
 * before they become a check-in (migration 20261009120000_auto_check_in.sql).
 *
 * Geofencing needs a real build: Expo Go has no background location, so
 * everything here reports "unavailable" there and never throws.
 */

export function isAutoCheckInAvailable(): boolean {
  if (Platform.OS !== "ios") return false;
  return Constants.executionEnvironment !== ExecutionEnvironment.StoreClient;
}

// ─── Background task ───────────────────────────────────────────────────────
// Must be defined at module scope and imported when the app starts
// (app/_layout.tsx), because iOS may launch the app straight into this task.

type GeofenceTaskData = {
  eventType: Location.GeofencingEventType;
  region: { identifier: string };
};

async function notifications() {
  return import("expo-notifications");
}

async function onArrive(courtId: string) {
  const { data, error } = await supabase.rpc("auto_check_in_arrive", { p_court_id: courtId });
  if (error) {
    console.warn("auto check-in arrive failed", error.message);
    return;
  }
  const result = data as { status?: string; arrived_at?: string; court_name?: string } | null;
  if (result?.status !== "pending") return;
  const Notifications = await notifications();
  const content = checkedInNotification(result.court_name ?? "your court");
  await Notifications.scheduleNotificationAsync({
    identifier: AUTO_CHECK_IN_NOTIFICATION_ID,
    content: {
      ...content,
      categoryIdentifier: AUTO_CHECK_IN_CATEGORY,
      data: { kind: "auto_check_in", path: `/court/${courtId}` },
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DATE,
      date: notifyAt(result.arrived_at),
    },
  });
}

async function onLeave(courtId: string) {
  const Notifications = await notifications();
  // Left inside the hold: the "Checked in" notification never goes out.
  await Notifications.cancelScheduledNotificationAsync(AUTO_CHECK_IN_NOTIFICATION_ID).catch(() => {});
  const { error } = await supabase.rpc("auto_check_in_leave", { p_court_id: courtId });
  if (error) console.warn("auto check-in leave failed", error.message);
}

if (isAutoCheckInAvailable()) {
  TaskManager.defineTask<GeofenceTaskData>(AUTO_CHECK_IN_TASK, async ({ data, error }) => {
    if (error || !data?.region?.identifier) return;
    const { data: session } = await supabase.auth.getSession();
    if (!session.session) return;
    const courtId = data.region.identifier;
    if (data.eventType === Location.GeofencingEventType.Enter) await onArrive(courtId);
    else if (data.eventType === Location.GeofencingEventType.Exit) await onLeave(courtId);
  });
}

// ─── Permissions and status ────────────────────────────────────────────────

export async function getAutoCheckInPermission(): Promise<AutoCheckInPermission> {
  if (!isAutoCheckInAvailable()) return "unavailable";
  try {
    const background = await Location.getBackgroundPermissionsAsync();
    if (background.granted) return "always";
    const foreground = await Location.getForegroundPermissionsAsync();
    return foreground.granted ? "needs_always" : "denied";
  } catch {
    return "unavailable";
  }
}

export async function isAutoCheckInRunning(): Promise<boolean> {
  if (!isAutoCheckInAvailable()) return false;
  try {
    return await Location.hasStartedGeofencingAsync(AUTO_CHECK_IN_TASK);
  } catch {
    return false;
  }
}

export type EnableResult = "on" | "needs_always" | "denied" | "unavailable" | "error";

/**
 * Ask for location (While Using, then Always) and start watching the court.
 * iOS shows the Always upgrade only once; after that the player has to
 * change it in Settings.
 */
export async function enableAutoCheckIn(court: AutoCheckInCourt): Promise<EnableResult> {
  if (!isAutoCheckInAvailable()) return "unavailable";
  const region = regionFor(court);
  if (!region) return "error";
  try {
    const foreground = await Location.requestForegroundPermissionsAsync();
    if (!foreground.granted) return "denied";
    const background = await Location.requestBackgroundPermissionsAsync();
    if (!background.granted) return "needs_always";
    await registerUndoAction();
    await Location.startGeofencingAsync(AUTO_CHECK_IN_TASK, [region]);
    return "on";
  } catch (error) {
    console.warn("enable auto check-in failed", error);
    return "error";
  }
}

export async function disableAutoCheckIn(): Promise<void> {
  if (!isAutoCheckInAvailable()) return;
  try {
    if (await Location.hasStartedGeofencingAsync(AUTO_CHECK_IN_TASK)) {
      await Location.stopGeofencingAsync(AUTO_CHECK_IN_TASK);
    }
    const Notifications = await notifications();
    await Notifications.cancelScheduledNotificationAsync(AUTO_CHECK_IN_NOTIFICATION_ID).catch(() => {});
  } catch (error) {
    console.warn("disable auto check-in failed", error);
  }
}

/**
 * Keep the circle on the current local court. Only acts when auto check-in is
 * already on; a new local court moves the circle, no court stops it.
 */
export async function syncAutoCheckIn(court: AutoCheckInCourt | null): Promise<void> {
  if (!(await isAutoCheckInRunning())) return;
  const region = court ? regionFor(court) : null;
  if (!region) {
    await disableAutoCheckIn();
    return;
  }
  try {
    await Location.startGeofencingAsync(AUTO_CHECK_IN_TASK, [region]);
  } catch (error) {
    console.warn("sync auto check-in failed", error);
  }
}

/**
 * Notification buttons: "Not here" on "Checked in at …" (D36), and
 * "Check back in" / "Got it" on the 3-hour "You've been checked out" push
 * (D38).
 */
export async function registerUndoAction(): Promise<void> {
  if (Platform.OS !== "ios") return;
  try {
    const Notifications = await notifications();
    await Notifications.setNotificationCategoryAsync(AUTO_CHECK_IN_CATEGORY, [
      {
        identifier: AUTO_CHECK_IN_UNDO_ACTION,
        buttonTitle: "Not here",
        options: { opensAppToForeground: true },
      },
    ]);
    await Notifications.setNotificationCategoryAsync(AUTO_CHECK_OUT_CATEGORY, [
      {
        identifier: CHECK_BACK_IN_ACTION,
        buttonTitle: "Check back in",
        options: { opensAppToForeground: true },
      },
      {
        identifier: GOT_IT_ACTION,
        buttonTitle: "Got it",
        options: { opensAppToForeground: false },
      },
    ]);
  } catch (error) {
    console.warn("register notification actions failed", error);
  }
}

/** "Check back in" on the 3-hour notice: auto check-in again, right away. */
export async function resumeAutoCheckIn(courtId: string): Promise<boolean> {
  const { data, error } = await supabase.rpc("resume_auto_check_in", { p_court_id: courtId });
  if (error) {
    console.warn("resume auto check-in failed", error.message);
    return false;
  }
  return data === "checked_in" || data === "already";
}

/** The two friend-alert switches (D37). */
export async function setAutoCheckInAlerts(prefs: { share?: boolean; receive?: boolean }): Promise<boolean> {
  const { error } = await supabase.rpc("set_auto_check_in_alerts", {
    p_share: prefs.share ?? null,
    p_receive: prefs.receive ?? null,
  });
  if (error) {
    console.warn("set auto check-in alerts failed", error.message);
    return false;
  }
  return true;
}

/** Remove the latest auto check-in (or a held arrival) as if it never happened. */
export async function undoAutoCheckIn(): Promise<boolean> {
  const { data, error } = await supabase.rpc("undo_auto_check_in");
  if (error) {
    console.warn("undo auto check-in failed", error.message);
    return false;
  }
  return data === true;
}
