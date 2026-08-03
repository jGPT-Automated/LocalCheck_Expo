import { Href, useRouter } from "expo-router";
import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { AppState, Platform } from "react-native";

import { useAuth } from "@/context/AuthContext";
import { useRealtimeHub } from "@/context/RealtimeHubContext";
import { batchHasResource, RealtimeTopic } from "@/lib/realtimeHub";
import { getSafeNotificationRoute } from "@/lib/notificationRoutes";
import {
  AppNotification,
  fetchNotifications,
  markAllNotificationsRead,
  markNotificationRead,
  setPushPreference,
} from "@/services/notificationService";
import {
  configureForegroundNotifications,
  PushSetupResult,
  registerPushNotifications,
} from "@/services/pushNotificationService";

interface NotificationContextValue {
  notifications: AppNotification[];
  unreadCount: number;
  isLoading: boolean;
  pushEnabled: boolean;
  refreshNotifications: () => Promise<void>;
  openNotification: (notification: AppNotification) => Promise<void>;
  readAll: () => Promise<void>;
  enablePush: () => Promise<PushSetupResult>;
  disablePush: () => Promise<boolean>;
}

const NotificationContext = createContext<NotificationContextValue | null>(null);

export function NotificationProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { user, profile, refreshProfile } = useAuth();
  const realtimeHub = useRealtimeHub();
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const refreshNotifications = useCallback(async () => {
    if (!user) {
      setNotifications([]);
      return;
    }
    setIsLoading(true);
    const next = await fetchNotifications();
    setNotifications(next);
    setIsLoading(false);
  }, [user]);

  useEffect(() => {
    void refreshNotifications();
  }, [refreshNotifications]);

  useEffect(() => {
    if (!user) return;
    return realtimeHub.subscribe(`user:${user.id}` as RealtimeTopic, (batch) => {
      if (batchHasResource(batch, ["notifications"])) void refreshNotifications();
    });
  }, [realtimeHub, refreshNotifications, user]);

  useEffect(() => {
    const sub = AppState.addEventListener("change", (state) => {
      if (state === "active") void refreshNotifications();
    });
    return () => sub.remove();
  }, [refreshNotifications]);

  useEffect(() => {
    if (!user || profile?.push_notifications_enabled !== true) return;
    // Never show the permission prompt here. This only repairs a token after a
    // user has already granted notification access.
    void registerPushNotifications(false);
  }, [profile?.push_notifications_enabled, user]);

  useEffect(() => {
    if (Platform.OS !== "ios" && Platform.OS !== "android") return;
    let responseSubscription: { remove: () => void } | undefined;
    let cancelled = false;
    void configureForegroundNotifications();
    void import("expo-notifications").then((Notifications) => {
      if (cancelled) return;
      responseSubscription = Notifications.addNotificationResponseReceivedListener((response) => {
        const path = getSafeNotificationRoute(response.notification.request.content.data?.path);
        if (path) router.push(path as Href);
      });
    });
    return () => {
      cancelled = true;
      responseSubscription?.remove();
    };
  }, [router]);

  const openNotification = useCallback(async (notification: AppNotification) => {
    if (!notification.readAt) {
      const ok = await markNotificationRead(notification.id);
      if (ok) {
        setNotifications((items) => items.map((item) =>
          item.id === notification.id ? { ...item, readAt: new Date().toISOString() } : item
        ));
      }
    }
    const path = getSafeNotificationRoute(notification.path);
    if (path) router.push(path as Href);
  }, [router]);

  const readAll = useCallback(async () => {
    const ok = await markAllNotificationsRead();
    if (ok) {
      const now = new Date().toISOString();
      setNotifications((items) => items.map((item) => ({ ...item, readAt: item.readAt ?? now })));
    }
  }, []);

  const enablePush = useCallback(async () => {
    const result = await registerPushNotifications(true);
    if (result.ok) await refreshProfile();
    return result;
  }, [refreshProfile]);

  const disablePush = useCallback(async () => {
    const ok = await setPushPreference(false);
    if (ok) await refreshProfile();
    return ok;
  }, [refreshProfile]);

  const unreadCount = useMemo(
    () => notifications.reduce((count, item) => count + (item.readAt ? 0 : 1), 0),
    [notifications]
  );

  return (
    <NotificationContext.Provider value={{
      notifications,
      unreadCount,
      isLoading,
      pushEnabled: profile?.push_notifications_enabled === true,
      refreshNotifications,
      openNotification,
      readAll,
      enablePush,
      disablePush,
    }}>
      {children}
    </NotificationContext.Provider>
  );
}

export function useNotifications(): NotificationContextValue {
  const value = useContext(NotificationContext);
  if (!value) throw new Error("useNotifications must be used inside NotificationProvider");
  return value;
}
