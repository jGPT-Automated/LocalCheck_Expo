import Constants, { ExecutionEnvironment } from "expo-constants";
import * as Location from "expo-location";
import * as TaskManager from "expo-task-manager";
import { Platform } from "react-native";

import {
  AUTO_CHECK_OUT_CATEGORY,
  AUTO_CHECK_IN_CATEGORY,
  CHECK_BACK_IN_ACTION,
  AUTO_CHECK_IN_NOTIFICATION_ID,
  AUTO_CHECK_IN_TASK,
  AUTO_CHECK_IN_UNDO_ACTION,
  type AutoCheckInCourt,
  type AutoCheckInPermission,
  type AutoCheckInRegion,
  AUTO_CHECK_IN_NOTICE_DELAY_SECONDS,
  checkedInNotification,
  postsAt,
  regionFor,
  savedCourtRegions,
  type SavedRegion,
} from "@/lib/autoCheckInModel";
import { supabase } from "@/lib/supabase";

/**
 * Auto check-in at the local court (D35, D36). One geofence, set from the
 * player's local court. iOS wakes the app for a few seconds on arrival and on
 * leaving; the task below tells the server. On arrival the player is checked
 * in privately and, after a minute inside, told ("Checked in at …", with
 * Hide); 5 minutes after arriving
 * later a QStash timer posts it, unless they hid it or left (migrations
 * 20261009120000_auto_check_in.sql and 20261012180000_qstash_timers.sql).
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
  const content = checkedInNotification(result.court_name ?? "your court", postsAt(result.arrived_at));
  await Notifications.scheduleNotificationAsync({
    identifier: `${AUTO_CHECK_IN_NOTIFICATION_ID}-${courtId}`,
    content: {
      ...content,
      categoryIdentifier: AUTO_CHECK_IN_CATEGORY,
      data: { kind: "auto_check_in", court_id: courtId, path: `/court/${courtId}` },
    },
    // After a minute inside the circle, so driving past shows nothing. The
    // server's "Check-in posted" push later replaces it (same id).
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
      seconds: AUTO_CHECK_IN_NOTICE_DELAY_SECONDS,
    },
  });
}

async function onLeave(courtId: string) {
  const Notifications = await notifications();
  // Left before it posted: the notice never shows, or is taken away.
  const noticeId = `${AUTO_CHECK_IN_NOTIFICATION_ID}-${courtId}`;
  await Notifications.cancelScheduledNotificationAsync(noticeId).catch(() => {});
  await Notifications.dismissNotificationAsync(noticeId).catch(() => {});
  const { error } = await supabase.rpc("auto_check_in_leave", { p_court_id: courtId });
  if (error) console.warn("auto check-in leave failed", error.message);
}

if (isAutoCheckInAvailable()) {
  TaskManager.defineTask<GeofenceTaskData>(AUTO_CHECK_IN_TASK, async ({ data, error }) => {
    if (error || !data?.region?.identifier) return;
    const { data: session } = await supabase.auth.getSession();
    if (!session.session) return;
    const parts = data.region.identifier.split("/");
    if (parts.length === 2 && parts[0] !== session.session.user.id) return;
    const courtId = parts[parts.length - 1];
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

export async function requestAutoPermission(): Promise<EnableResult> {
  if (!isAutoCheckInAvailable()) return "unavailable";
  const foreground = await Location.requestForegroundPermissionsAsync();
  if (!foreground.granted) return "denied";
  const background = await Location.requestBackgroundPermissionsAsync();
  return background.granted ? "on" : "needs_always";
}

async function registeredRegions(): Promise<AutoCheckInRegion[]> {
  if (!await isAutoCheckInRunning()) return [];
  const options = await TaskManager.getTaskOptionsAsync<{ regions?: AutoCheckInRegion[] }>(AUTO_CHECK_IN_TASK);
  return options?.regions ?? [];
}

export async function isWatchingCourt(userId: string, courtId: string): Promise<boolean> {
  return (await registeredRegions()).some(r => r.identifier === courtId || r.identifier === `${userId}/${courtId}`);
}

let registration: Promise<void> = Promise.resolve();
export function clearRegisteredCourts(): Promise<void> {
  registration = registration.catch(() => {}).then(disableAutoCheckIn);
  return registration;
}

export function syncSavedRegions(userId: string, entries: SavedRegion[]): Promise<void> {
  const sync = async () => {
    if (!isAutoCheckInAvailable()) return;
    const active = await registeredRegions();
    const wanted = savedCourtRegions(userId, entries, active);
    const unchanged = wanted.length === active.length && wanted.every(r => active.some(a =>
      a.identifier === r.identifier && a.latitude === r.latitude && a.longitude === r.longitude && a.radius === r.radius));
    if (unchanged) return;
    if (wanted.length && await getAutoCheckInPermission() === "always") {
      await Location.startGeofencingAsync(AUTO_CHECK_IN_TASK, wanted);
    } else if (active.length) {
      await Location.stopGeofencingAsync(AUTO_CHECK_IN_TASK);
    }
    const notices = await notifications();
    for (const region of active) {
      const courtId = region.identifier.split("/").pop();
      if (!wanted.some(r => r.identifier === `${userId}/${courtId}`)) {
        await notices.cancelScheduledNotificationAsync(`${AUTO_CHECK_IN_NOTIFICATION_ID}-${courtId}`).catch(() => {});
      }
    }
  };
  registration = registration.catch(() => {}).then(sync);
  return registration;
}

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
    const permission = await requestAutoPermission();
    if (permission !== "on") return permission;
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
    const regions = await registeredRegions();
    if (regions.length || await isAutoCheckInRunning()) await Location.stopGeofencingAsync(AUTO_CHECK_IN_TASK);
    const Notifications = await notifications();
    for (const region of regions) {
      const id = `${AUTO_CHECK_IN_NOTIFICATION_ID}-${region.identifier.split("/").pop()}`;
      await Notifications.cancelScheduledNotificationAsync(id).catch(() => {});
      await Notifications.dismissNotificationAsync(id).catch(() => {});
    }
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
  const regions = await registeredRegions();
  const wasMultiCourt = regions.some(r => r.identifier.includes("/"));
  const keepDefault = !wasMultiCourt || regions.some(r => r.identifier.endsWith(`/${court?.id}`));
  const region = court && keepDefault ? regionFor(court) : null;
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
 * Notification buttons: "Hide" on "Checked in at …" and "Check-in posted",
 * and "I'm still here" on the 1.5-hour "Auto checked out" push.
 */
export async function registerUndoAction(): Promise<void> {
  if (Platform.OS !== "ios") return;
  try {
    const Notifications = await notifications();
    await Notifications.setNotificationCategoryAsync(AUTO_CHECK_IN_CATEGORY, [
      {
        identifier: AUTO_CHECK_IN_UNDO_ACTION,
        buttonTitle: "Hide",
        options: { opensAppToForeground: true },
      },
    ]);
    await Notifications.setNotificationCategoryAsync(AUTO_CHECK_OUT_CATEGORY, [
      {
        identifier: CHECK_BACK_IN_ACTION,
        buttonTitle: "I'm still here",
        options: { opensAppToForeground: true },
      },
    ]);
  } catch (error) {
    console.warn("register notification actions failed", error);
  }
}

/** "I'm still here" on the 1.5-hour notice: auto check-in again, right away (another 1.5 hours). */
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
export async function undoAutoCheckIn(courtId?: string): Promise<boolean> {
  const { data, error } = courtId
    ? await supabase.rpc("undo_auto_check_in_at", { p_court_id: courtId })
    : await supabase.rpc("undo_auto_check_in");
  if (error) {
    console.warn("undo auto check-in failed", error.message);
    return false;
  }
  return data === true;
}
