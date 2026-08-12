import Constants from "expo-constants";
import * as Device from "expo-device";
import { Platform } from "react-native";

import { savePushToken } from "./notificationService";
import {
  getPushRegistrationAction,
  PushPermissionStatus,
} from "./pushRegistrationPolicy";

export interface PushSetupResult {
  ok: boolean;
  status: "enabled" | "denied" | "simulator" | "unsupported" | "error";
  message?: string;
}
function getProjectId(): string | null {
  return (
    Constants.expoConfig?.extra?.eas?.projectId
    ?? Constants.easConfig?.projectId
    ?? null
  );
}

/**
 * Register this physical phone. `ask=false` never opens the system prompt; it
 * only repairs an existing grant when the app starts or returns to foreground.
 */
export async function registerPushNotifications(ask: boolean): Promise<PushSetupResult> {
  if (Platform.OS !== "ios" && Platform.OS !== "android") {
    return { ok: false, status: "unsupported" };
  }
  if (!Device.isDevice) {
    return { ok: false, status: "simulator", message: "Push alerts need a physical phone." };
  }

  try {
    const Notifications = await import("expo-notifications");
    if (Platform.OS === "android") {
      await Notifications.setNotificationChannelAsync("default", {
        name: "LocalCheck alerts",
        importance: Notifications.AndroidImportance.DEFAULT,
      });
    }

    let permission = await Notifications.getPermissionsAsync();
    if (permission.status !== "granted" && ask && permission.canAskAgain) {
      permission = await Notifications.requestPermissionsAsync();
    }
    if (permission.status !== "granted") {
      return {
        ok: false,
        status: "denied",
        message: permission.canAskAgain
          ? "Alerts are off. You can turn them on when you are ready."
          : "Alerts are blocked in iPhone Settings.",
      };
    }

    const projectId = getProjectId();
    if (!projectId) return { ok: false, status: "error", message: "The app project ID is missing." };
    const token = await Notifications.getExpoPushTokenAsync({ projectId });
    const saved = await savePushToken(token.data, Platform.OS);
    return saved
      ? { ok: true, status: "enabled" }
      : { ok: false, status: "error", message: "The phone could not be registered." };
  } catch (error) {
    return {
      ok: false,
      status: "error",
      message: error instanceof Error ? error.message : "Push setup failed.",
    };
  }
}

/**
 * Prompts once when iOS/Android has never received a decision, repairs an
 * existing enabled registration, and respects both system denial and the
 * user's LocalCheck opt-out.
 */
export async function syncPushRegistration(
  preferenceEnabled: boolean,
): Promise<PushSetupResult | null> {
  if (Platform.OS !== "ios" && Platform.OS !== "android") return null;
  if (!Device.isDevice) return null;

  try {
    const Notifications = await import("expo-notifications");
    const permission = await Notifications.getPermissionsAsync();
    const permissionStatus: PushPermissionStatus =
      permission.status === "granted"
        ? "granted"
        : permission.status === "denied"
          ? "denied"
          : "undetermined";
    const action = getPushRegistrationAction({
      preferenceEnabled,
      permissionStatus,
    });
    if (action === "none") return null;
    return registerPushNotifications(action === "prompt");
  } catch (error) {
    return {
      ok: false,
      status: "error",
      message: error instanceof Error ? error.message : "Push setup failed.",
    };
  }
}

export async function configureForegroundNotifications(): Promise<void> {
  if (Platform.OS !== "ios" && Platform.OS !== "android") return;
  const Notifications = await import("expo-notifications");
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: false,
      shouldSetBadge: true,
    }),
  });
}
