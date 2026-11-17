import { InfiniteData, useInfiniteQuery, useQuery, useQueryClient } from "@tanstack/react-query";
import { Href, useRouter } from "expo-router";
import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef } from "react";
import { AppState, DeviceEventEmitter, Platform } from "react-native";

import { useAuth } from "@/context/AuthContext";
import { useRealtimeHub } from "@/context/RealtimeHubContext";
import { batchHasResource, RealtimeTopic } from "@/lib/realtimeHub";
import {
  AUTO_CHECK_IN_RESUMED_EVENT,
  AUTO_CHECK_IN_UNDO_ACTION,
  AUTO_CHECK_IN_UNDONE_EVENT,
  CHECK_BACK_IN_ACTION,
} from "@/lib/autoCheckInModel";
import { getSafeNotificationRoute, notificationResponseKey } from "@/lib/notificationRoutes";
import { resumeAutoCheckIn, undoAutoCheckIn } from "@/services/autoCheckInService";
import { canAutoPromptPush } from "@/lib/onboardingGate";
import {
  AppNotification,
  fetchNotificationPage,
  fetchUnreadNotificationCount,
  NotificationCursor,
  NotificationPage,
  markAllNotificationsRead,
  markNotificationRead,
  setPushPreference,
} from "@/services/notificationService";
import {
  configureForegroundNotifications,
  PushSetupResult,
  registerPushNotifications,
  syncPushRegistration,
} from "@/services/pushNotificationService";

interface NotificationContextValue {
  notifications: AppNotification[];
  unreadCount: number;
  isLoading: boolean;
  pushEnabled: boolean;
  hasMore: boolean;
  isLoadingMore: boolean;
  loadError: boolean;
  loadMore: () => Promise<void>;
  refreshNotifications: () => Promise<void>;
  openNotification: (notification: AppNotification) => Promise<void>;
  readNotification: (notification: AppNotification) => Promise<void>;
  readAll: () => Promise<void>;
  enablePush: () => Promise<PushSetupResult>;
  disablePush: () => Promise<boolean>;
}

const NotificationContext = createContext<NotificationContextValue | null>(null);

export function NotificationProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { user, profile, refreshProfile } = useAuth();
  const realtimeHub = useRealtimeHub();
  const handledResponseIdRef = useRef<string | null>(null);
  const queryClient = useQueryClient();
  const queryKey = ["notifications", user?.id] as const;
  const unreadKey = ["notification-unread", user?.id] as const;
  const inbox = useInfiniteQuery({
    queryKey,
    initialPageParam: null as NotificationCursor | null,
    queryFn: ({ pageParam }) => fetchNotificationPage(pageParam),
    getNextPageParam: (page) => page.nextCursor ?? undefined,
    enabled: Boolean(user),
    retry: false,
  });
  const unread = useQuery({ queryKey: unreadKey, queryFn: fetchUnreadNotificationCount, enabled: Boolean(user) });
  const notifications = useMemo(() => inbox.data?.pages.flatMap(page => page.items) ?? [], [inbox.data]);
  const refreshNotifications = useCallback(async () => {
    if (user) await Promise.all([inbox.refetch(), unread.refetch()]);
  }, [user?.id, inbox.refetch, unread.refetch]);
  const loadMore = async () => {
    if (inbox.isError && !inbox.isFetchNextPageError) return refreshNotifications();
    if (inbox.hasNextPage && !inbox.isFetching) await inbox.fetchNextPage();
  };
  const updateRead = (id?: string) => {
    const now = new Date().toISOString();
    queryClient.setQueryData<InfiniteData<NotificationPage>>(queryKey, old => old ? {
      ...old, pages: old.pages.map(page => ({ ...page, items: page.items.map(item => !id || item.id === id ? { ...item, readAt: item.readAt ?? now } : item) })),
    } : old);
    if (!id) queryClient.setQueryData(unreadKey, 0);
    else void queryClient.invalidateQueries({ queryKey: unreadKey });
  };

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
    // The automatic prompt needs a positive "onboarding finished" signal for
    // THIS user. Until then (profile still loading, a stale or unflagged row,
    // or onboarding in progress) the only path to the iOS alerts prompt is
    // onboarding's last step, after the "why alerts" explainer.
    // `profile.onboarding_completed` is a dependency below so this re-fires
    // once onboarding finishes.
    if (!profile || !canAutoPromptPush(user?.id, profile)) return;
    const preferenceEnabled = profile.push_notifications_enabled;
    let cancelled = false;
    // Staggered, not simultaneous: on a fresh sign-in this mounts the same
    // instant the location permission prompt fires elsewhere (Home/Explore),
    // and two native permission dialogs firing back to back read as one
    // dialog stacked on another. A few seconds' delay lets location's prompt
    // (and the user's response to it) land first.
    const timer = setTimeout(() => {
      if (cancelled) return;
      void syncPushRegistration(preferenceEnabled).then((result) => {
        if (!cancelled && !preferenceEnabled && result?.ok) void refreshProfile();
      });
    }, 2500);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [profile?.id, profile?.push_notifications_enabled, profile?.onboarding_completed, refreshProfile, user]);

  useEffect(() => {
    if (Platform.OS !== "ios" && Platform.OS !== "android") return;
    let responseSubscription: { remove: () => void } | undefined;
    let cancelled = false;
    void configureForegroundNotifications();
    void import("expo-notifications").then((Notifications) => {
      if (cancelled) return;
      const handleResponse = (response: Awaited<ReturnType<typeof Notifications.getLastNotificationResponseAsync>>) => {
        if (!response) return;
        const key = notificationResponseKey(response);
        if (handledResponseIdRef.current === key) return;
        handledResponseIdRef.current = key;
        const data = response.notification.request.content.data;
        if (data?.kind === "auto_check_in" && response.actionIdentifier === AUTO_CHECK_IN_UNDO_ACTION) {
          void undoAutoCheckIn().then((ok) => DeviceEventEmitter.emit(AUTO_CHECK_IN_UNDONE_EVENT, ok));
        }
        if (
          data?.kind === "auto_check_out" &&
          response.actionIdentifier === CHECK_BACK_IN_ACTION &&
          typeof data.court_id === "string"
        ) {
          void resumeAutoCheckIn(data.court_id).then((ok) => DeviceEventEmitter.emit(AUTO_CHECK_IN_RESUMED_EVENT, ok));
        }
        const path = getSafeNotificationRoute(data?.path);
        if (path) router.push(path as Href);
      };
      responseSubscription = Notifications.addNotificationResponseReceivedListener(handleResponse);
      void Notifications.getLastNotificationResponseAsync().then((response) => {
        if (cancelled || !response) return;
        handleResponse(response);
        // Clearing prevents a response from a previous launch from routing the
        // user again on a later ordinary app open.
        return Notifications.clearLastNotificationResponseAsync();
      });
    });
    return () => {
      cancelled = true;
      responseSubscription?.remove();
    };
  }, [router]);

  const readNotification = useCallback(async (notification: AppNotification) => {
    if (!notification.readAt) {
      const ok = await markNotificationRead(notification.id);
      if (ok) {
        updateRead(notification.id);
      }
    }
  }, [user?.id]);

  const openNotification = useCallback(async (notification: AppNotification) => {
    await readNotification(notification);
    const path = getSafeNotificationRoute(notification.path);
    if (path) router.push(path as Href);
  }, [readNotification, router]);

  const readAll = useCallback(async () => {
    const ok = await markAllNotificationsRead();
    if (ok) {
      updateRead();
    }
  }, [user?.id]);

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


  return (
    <NotificationContext.Provider value={{
      notifications,
      unreadCount: unread.data ?? 0,
      isLoading: inbox.isPending && Boolean(user),
      hasMore: inbox.hasNextPage,
      isLoadingMore: inbox.isFetchingNextPage,
      loadError: inbox.isError,
      loadMore,
      pushEnabled: profile?.push_notifications_enabled === true,
      refreshNotifications,
      openNotification,
      readNotification,
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
