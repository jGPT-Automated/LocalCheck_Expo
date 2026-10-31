import { Feather } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React from "react";
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { DetailHeader } from "@/components/ui/DetailHeader";
import { Colors, Radius } from "@/constants/colors";
import { Typography } from "@/constants/typography";
import { useNotifications } from "@/context/NotificationContext";

/** "Now", "5m", "2h", "3d": the feed's short time, quieter than the event. */
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
          // A plain log: exactly what was sent, when, and whether the push went out.
          <Pressable
            key={item.id}
            style={({ pressed }) => [styles.row, pressed && styles.pressed]}
            onPress={() => void openNotification(item)}
          >
            <Text style={styles.logMeta}>
              {logTime(item.createdAt)} · {item.type} · {item.readAt ? "read" : "unread"}
            </Text>
            <Text style={styles.rowTitle}>{item.title}</Text>
            {item.body ? <Text style={styles.rowBody}>{item.body}</Text> : null}
            <Text style={styles.logMeta}>
              push: {item.pushStatus ?? "unknown"}
              {item.pushSentAt ? ` · ${logTime(item.pushSentAt)}` : ""}
            </Text>
          </Pressable>
        ))}
      </ScrollView>
    </View>
  );
}

function logTime(iso: string): string {
  return new Date(iso).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
  });
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Colors.background },
  readAllButton: { minHeight: 38, justifyContent: "center" },
  readAll: { fontFamily: Typography.bodyBold, fontSize: 9.5, letterSpacing: 1.3, textTransform: "uppercase", color: Colors.inkSoft },
  pushCard: { flexDirection: "row", alignItems: "center", gap: 12, padding: 14, marginBottom: 8, borderWidth: 1, borderColor: Colors.hairlineCard, borderRadius: Radius.row, backgroundColor: Colors.panel },
  pushIcon: { width: 32, height: 32, alignItems: "center", justifyContent: "center", borderRadius: Radius.chip, backgroundColor: Colors.tile },
  pushTitle: { fontFamily: Typography.bodyBold, fontSize: 10, color: Colors.text, letterSpacing: 1.2, textTransform: "uppercase" },
  pushBody: { fontFamily: Typography.bodyMedium, fontSize: 11.5, lineHeight: 16, color: Colors.textSecondary, marginTop: 3 },
  row: { gap: 3, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: "rgba(242,242,246,0.06)" },
  logMeta: { fontFamily: Typography.bodyMedium, fontSize: 11, lineHeight: 15, color: Colors.muted },
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
