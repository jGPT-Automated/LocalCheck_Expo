import { Feather } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React from "react";
import { ActivityIndicator, Alert, FlatList, Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { ScreenViewport } from "@/components/ui/ScreenViewport";
import { DetailHeader } from "@/components/ui/DetailHeader";
import { Colors } from "@/constants/colors";
import { TextStyles, Typography } from "@/constants/typography";
import { useNotifications } from "@/context/NotificationContext";
import { notificationHeading, notificationTimestamp } from "@/lib/notificationPresentation";

const AUDIENCES = {
  private: { icon: "lock", label: "Private · Only you" },
  friends: { icon: "users", label: "Friends" },
  public: { icon: "globe", label: "Public" },
} as const;

export default function NotificationsScreen() {
  const router = useRouter();
  const { bottom } = useSafeAreaInsets();
  const { notifications, unreadCount, isLoading, pushEnabled, openNotification, readAll,
    enablePush, hasMore, isLoadingMore, loadMore, loadError, refreshNotifications } = useNotifications();
  const turnOnPush = async () => {
    const result = await enablePush();
    if (!result.ok) Alert.alert("Alerts are not on", result.message ?? "Please try again.");
  };
  return (
    <ScreenViewport>
      <DetailHeader onBack={() => router.back()} title="NOTIFICATIONS" right={unreadCount > 0 ? (
        <Pressable accessibilityRole="button" onPress={() => void readAll()} style={styles.readAllButton}>
          <Text style={styles.readAll}>Read all</Text>
        </Pressable>
      ) : undefined} />
      <FlatList
        testID="notification-log-scroll"
        style={{ flex: 1, minHeight: 0 }}
        bounces={false}
        alwaysBounceVertical={false}
        data={notifications}
        keyExtractor={item => item.id}
        contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: bottom + 32 }}
        ListHeaderComponent={!pushEnabled ? (
          <Pressable accessibilityRole="button" style={styles.pushRow} onPress={() => void turnOnPush()}>
            <Feather name="bell" size={16} color={Colors.textSecondary} />
            <Text style={styles.pushText}>Turn on phone alerts</Text>
            <Feather name="chevron-right" size={16} color={Colors.muted} />
          </Pressable>
        ) : null}
        ListEmptyComponent={isLoading ? <ActivityIndicator color={Colors.accent} style={styles.loading} /> : !loadError ? (
          <View style={styles.empty}>
            <Text style={styles.emptyTitle}>No notifications yet</Text>
            <Text style={styles.emptyBody}>Friend requests, game invitations, and score reviews will appear here.</Text>
          </View>
        ) : null}
        renderItem={({ item }) => {
          // Only display a recorded event audience, never today's profile setting.
          const ownEvent = item.type === "auto_check_in" || item.type === "auto_check_out";
          const audience = ownEvent && item.visibility ? AUDIENCES[item.visibility] : null;
          return (
            <Pressable accessibilityRole="button" accessibilityLabel={`${!item.readAt ? "Unread. " : ""}${notificationHeading(item.title)}. ${item.body}. ${notificationTimestamp(item.createdAt)}${audience ? `. ${audience.label}` : ""}`}
              onPress={() => void openNotification(item)} style={({ pressed }) => [styles.row, pressed && styles.pressed]} testID={`notification-${item.id}`}>
              <View style={styles.markerGutter}>{!item.readAt ? <View style={styles.dot} /> : null}</View>
              <View style={styles.content}>
                <Text style={[styles.rowTitle, item.readAt && styles.readTitle]}>{notificationHeading(item.title)}</Text>
                <Text style={styles.rowBody}>{item.body}</Text>
                <View style={styles.metadata}>
                  <Text style={styles.time}>{notificationTimestamp(item.createdAt)}</Text>
                  {ownEvent && item.source ? <Text style={styles.time}>{item.source === "auto" ? "Automatic" : "Manual"}</Text> : null}
                  {audience ? <View style={styles.audience}><Feather name={audience.icon} size={12} color={Colors.textSecondary} /><Text style={styles.time}>{audience.label}</Text></View> : null}
                </View>
              </View>
            </Pressable>
          );
        }}
        ListFooterComponent={loadError ? (
          <View style={styles.footer}>
            <Text style={styles.error}>Couldn't load notifications.</Text>
            <Pressable accessibilityRole="button" style={styles.loadButton} onPress={() => void (notifications.length ? loadMore() : refreshNotifications())}><Text style={styles.loadText}>Try again</Text></Pressable>
          </View>
        ) : hasMore ? (
          <Pressable accessibilityRole="button" accessibilityLabel="Load 20 more notifications" disabled={isLoadingMore} style={styles.loadButton} onPress={() => void loadMore()}>
            {isLoadingMore ? <ActivityIndicator color={Colors.text} /> : <Text style={styles.loadText}>Load more</Text>}
          </Pressable>
        ) : null}
      />
    </ScreenViewport>
  );
}

const styles = StyleSheet.create({
  readAllButton: { minHeight: 44, minWidth: 60, justifyContent: "center", alignItems: "flex-end" },
  readAll: { fontFamily: Typography.bodySemiBold, fontSize: 12, color: Colors.inkSoft },
  row: { flexDirection: "row", paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: Colors.hairlineCard, minHeight: 80 },
  markerGutter: { width: 20, paddingTop: 6, alignItems: "flex-start" },
  dot: { width: 7, height: 7, borderRadius: 4, backgroundColor: Colors.accent },
  content: { flex: 1, minWidth: 0, gap: 5 },
  rowTitle: { ...TextStyles.bodySmall, fontFamily: Typography.bodySemiBold, color: Colors.text },
  readTitle: { fontFamily: Typography.bodyMedium },
  rowBody: { ...TextStyles.bodySmall, color: Colors.textSecondary },
  metadata: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", columnGap: 12, rowGap: 6, marginTop: 3 },
  time: { ...TextStyles.caption, lineHeight: 16, color: Colors.muted },
  audience: { flexDirection: "row", alignItems: "center", gap: 4 },
  pressed: { opacity: 0.68 },
  pushRow: { minHeight: 52, flexDirection: "row", alignItems: "center", gap: 10, borderBottomWidth: 1, borderBottomColor: Colors.hairlineCard },
  pushText: { flex: 1, fontFamily: Typography.bodyMedium, fontSize: 13, color: Colors.textSecondary },
  loading: { marginTop: 44 },
  empty: { alignItems: "center", paddingHorizontal: 24, paddingTop: 64, gap: 8 },
  emptyTitle: { fontFamily: Typography.bodySemiBold, fontSize: 15, color: Colors.text },
  emptyBody: { ...TextStyles.bodySmall, color: Colors.textSecondary, textAlign: "center" },
  footer: { alignItems: "center", paddingTop: 16 },
  error: { fontFamily: Typography.bodyMedium, fontSize: 13, color: Colors.textSecondary },
  loadButton: { minHeight: 48, alignItems: "center", justifyContent: "center", marginVertical: 16, borderWidth: 1, borderColor: Colors.borderLight, borderRadius: 4 },
  loadText: { fontFamily: Typography.bodySemiBold, fontSize: 13, color: Colors.text },
});
