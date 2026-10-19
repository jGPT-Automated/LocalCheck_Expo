import { Feather } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React from "react";
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { DetailHeader } from "@/components/ui/DetailHeader";
import { Colors, Radius } from "@/constants/colors";
import { Typography } from "@/constants/typography";
import { useNotifications } from "@/context/NotificationContext";
import { NotificationType } from "@/services/notificationService";

const ICONS: Record<NotificationType, React.ComponentProps<typeof Feather>["name"]> = {
  friend_request: "user-plus",
  friend_accepted: "users",
  run_invite: "calendar",
  match_review: "check-square",
  match_confirmed: "award",
  match_rejected: "alert-circle",
  challenge: "zap",
  friend_check_in: "map-pin",
  auto_check_in: "log-in",
  auto_check_out: "log-out",
};

/** "Now", "5m", "2h", "3d": the feed's short time, quieter than the event. */
function timeAgo(value: string): string {
  const seconds = Math.max(0, Math.floor((Date.now() - new Date(value).getTime()) / 1000));
  if (seconds < 60) return "Now";
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m`;
  if (seconds < 86_400) return `${Math.floor(seconds / 3600)}h`;
  return `${Math.floor(seconds / 86_400)}d`;
}

export default function NotificationsScreen() {
  const router = useRouter();
  const { bottom } = useSafeAreaInsets();
  const {
    notifications,
    unreadCount,
    isLoading,
    pushEnabled,
    openNotification,
    readAll,
    enablePush,
  } = useNotifications();

  const turnOnPush = async () => {
    const result = await enablePush();
    if (!result.ok) Alert.alert("Alerts are not on", result.message ?? "Please try again.");
  };

  return (
    <View style={styles.screen}>
      {/* The shared detail header, like Game score and Profile. */}
      <DetailHeader
        onBack={() => router.back()}
        right={
          unreadCount > 0 ? (
            <Pressable accessibilityRole="button" onPress={() => void readAll()} hitSlop={10} style={styles.readAllButton}>
              <Text style={styles.readAll}>Read all</Text>
            </Pressable>
          ) : undefined
        }
        title="NOTIFICATIONS"
      />

      <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 16, paddingBottom: bottom + 40 }}>
        {!pushEnabled ? (
          <Pressable style={styles.pushCard} onPress={() => void turnOnPush()}>
            <View style={styles.pushIcon}><Feather name="bell" size={15} color={Colors.text} /></View>
            <View style={{ flex: 1 }}>
              <Text style={styles.pushTitle}>TURN ON PHONE ALERTS</Text>
              <Text style={styles.pushBody}>Get game invitations and score reviews when LocalCheck is closed.</Text>
            </View>
            <Feather name="chevron-right" size={18} color={Colors.muted} />
          </Pressable>
        ) : null}

        {isLoading && notifications.length === 0 ? (
          <ActivityIndicator color={Colors.accent} style={{ marginTop: 44 }} />
        ) : notifications.length === 0 ? (
          <View style={styles.empty}>
            <Feather name="bell" size={24} color={Colors.muted} />
            <Text style={styles.emptyTitle}>NO NOTIFICATIONS YET</Text>
            <Text style={styles.emptyBody}>Friend requests, game invitations, and score reviews will appear here.</Text>
          </View>
        ) : notifications.map((item) => (
          <Pressable
            key={item.id}
            style={({ pressed }) => [
              styles.row,
              !item.readAt && styles.rowUnread,
              pressed && styles.pressed,
            ]}
            onPress={() => void openNotification(item)}
          >
            <View style={[styles.icon, !item.readAt && styles.iconUnread]}>
              <Feather name={ICONS[item.type]} size={14} color={!item.readAt ? Colors.text : Colors.textSecondary} />
            </View>
            <View style={{ flex: 1 }}>
              <View style={styles.rowTitleLine}>
                {!item.readAt ? <View style={styles.dot} /> : null}
                <Text numberOfLines={2} style={styles.rowTitle}>{item.title}</Text>
              </View>
              <Text style={styles.rowBody}>{item.body}</Text>
            </View>
            <Text style={styles.time}>{timeAgo(item.createdAt)}</Text>
          </Pressable>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Colors.background },
  readAllButton: { minHeight: 38, justifyContent: "center" },
  readAll: { fontFamily: Typography.bodyBold, fontSize: 9.5, letterSpacing: 1.3, textTransform: "uppercase", color: Colors.inkSoft },
  pushCard: { flexDirection: "row", alignItems: "center", gap: 12, padding: 14, marginBottom: 8, borderWidth: 1, borderColor: Colors.hairlineCard, borderRadius: Radius.row, backgroundColor: Colors.panel },
  pushIcon: { width: 32, height: 32, alignItems: "center", justifyContent: "center", borderRadius: Radius.chip, backgroundColor: Colors.tile },
  pushTitle: { fontFamily: Typography.bodyBold, fontSize: 10, color: Colors.text, letterSpacing: 1.2, textTransform: "uppercase" },
  pushBody: { fontFamily: Typography.bodyMedium, fontSize: 11.5, lineHeight: 16, color: Colors.textSecondary, marginTop: 3 },
  row: { minHeight: 64, flexDirection: "row", alignItems: "flex-start", gap: 10, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: "rgba(242,242,246,0.06)" },
  rowUnread: {},
  icon: { width: 32, height: 32, borderRadius: Radius.chip, alignItems: "center", justifyContent: "center", backgroundColor: Colors.panel, borderWidth: 1, borderColor: "rgba(242,242,246,0.08)" },
  iconUnread: { borderColor: Colors.hairlineChrome },
  rowTitleLine: { flexDirection: "row", alignItems: "center", gap: 7 },
  rowTitle: { flexShrink: 1, fontFamily: Typography.bodySemiBold, fontSize: 12.5, lineHeight: 17, color: Colors.text },
  rowBody: { fontFamily: Typography.bodyMedium, fontSize: 12, lineHeight: 17, color: Colors.textSecondary, marginTop: 2 },
  time: { flexShrink: 0, paddingTop: 2, fontFamily: Typography.bodySemiBold, fontSize: 9.5, color: Colors.muted },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: Colors.accent },
  pressed: { opacity: 0.68 },
  empty: { alignItems: "center", paddingHorizontal: 34, paddingTop: 80 },
  emptyTitle: { fontFamily: Typography.headingSemiBold, fontSize: 16, color: Colors.text, letterSpacing: 0.5, textTransform: "uppercase", marginTop: 15 },
  emptyBody: { fontFamily: Typography.bodyMedium, fontSize: 12, lineHeight: 18, color: Colors.textSecondary, textAlign: "center", marginTop: 7 },
});
