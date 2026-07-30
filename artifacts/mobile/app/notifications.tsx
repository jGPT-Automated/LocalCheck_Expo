import { Feather } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React from "react";
import { ActivityIndicator, Alert, Platform, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

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
};

function timeAgo(value: string): string {
  const seconds = Math.max(0, Math.floor((Date.now() - new Date(value).getTime()) / 1000));
  if (seconds < 60) return "JUST NOW";
  if (seconds < 3600) return `${Math.floor(seconds / 60)} MIN AGO`;
  if (seconds < 86_400) return `${Math.floor(seconds / 3600)} HRS AGO`;
  return `${Math.floor(seconds / 86_400)} DAYS AGO`;
}

export default function NotificationsScreen() {
  const router = useRouter();
  const { top, bottom } = useSafeAreaInsets();
  const {
    notifications,
    unreadCount,
    isLoading,
    pushEnabled,
    openNotification,
    readAll,
    enablePush,
  } = useNotifications();
  const topPad = Platform.OS === "web" ? 67 : top;

  const turnOnPush = async () => {
    const result = await enablePush();
    if (!result.ok) Alert.alert("Alerts are not on", result.message ?? "Please try again.");
  };

  return (
    <View style={styles.screen}>
      <View style={[styles.header, { paddingTop: topPad + 10 }]}>
        <Pressable onPress={() => router.back()} style={styles.headerButton} hitSlop={12}>
          <Feather name="chevron-left" size={20} color={Colors.text} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>NOTIFICATIONS</Text>
          <Text style={styles.subtitle}>{unreadCount > 0 ? `${unreadCount} NEW` : "YOU'RE CAUGHT UP"}</Text>
        </View>
        {unreadCount > 0 ? (
          <Pressable onPress={() => void readAll()} hitSlop={10}>
            <Text style={styles.readAll}>READ ALL</Text>
          </Pressable>
        ) : <View style={{ width: 56 }} />}
      </View>

      <ScrollView contentContainerStyle={{ padding: 18, paddingBottom: bottom + 40 }}>
        {!pushEnabled ? (
          <Pressable style={styles.pushCard} onPress={() => void turnOnPush()}>
            <View style={styles.pushIcon}><Feather name="bell" size={16} color={Colors.accent} /></View>
            <View style={{ flex: 1 }}>
              <Text style={styles.pushTitle}>TURN ON PHONE ALERTS</Text>
              <Text style={styles.pushBody}>Get run invites and score reviews when LocalCheck is closed.</Text>
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
            <Text style={styles.emptyBody}>Friend requests, run invites, and score reviews will appear here.</Text>
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
              <Feather name={ICONS[item.type]} size={16} color={!item.readAt ? Colors.accent : Colors.textSecondary} />
            </View>
            <View style={{ flex: 1 }}>
              <View style={styles.rowTitleLine}>
                <Text style={styles.rowTitle}>{item.title}</Text>
                {!item.readAt ? <View style={styles.dot} /> : null}
              </View>
              <Text style={styles.rowBody}>{item.body}</Text>
              <Text style={styles.time}>{timeAgo(item.createdAt)}</Text>
            </View>
            {item.path ? <Feather name="chevron-right" size={17} color={Colors.mutedDark} /> : null}
          </Pressable>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Colors.background },
  header: { minHeight: 94, paddingHorizontal: 16, paddingBottom: 13, flexDirection: "row", alignItems: "flex-end", gap: 12, borderBottomWidth: 1, borderBottomColor: Colors.border },
  headerButton: { width: 34, height: 34, alignItems: "center", justifyContent: "center", borderRadius: 17, backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border },
  title: { fontFamily: Typography.heading, fontSize: 19, color: Colors.text, letterSpacing: 1 },
  subtitle: { fontFamily: Typography.bodyBold, fontSize: 7, color: Colors.muted, letterSpacing: 1.4, marginTop: 3 },
  readAll: { fontFamily: Typography.bodyBold, fontSize: 8, color: Colors.accent, letterSpacing: 1.1, paddingBottom: 10 },
  pushCard: { flexDirection: "row", alignItems: "center", gap: 12, padding: 14, marginBottom: 14, borderWidth: 1, borderColor: "rgba(255,85,0,0.36)", borderRadius: Radius.md, backgroundColor: Colors.accentDim },
  pushIcon: { width: 34, height: 34, alignItems: "center", justifyContent: "center", borderRadius: 17, backgroundColor: Colors.surface },
  pushTitle: { fontFamily: Typography.bodyBold, fontSize: 10, color: Colors.text, letterSpacing: 0.7 },
  pushBody: { fontFamily: Typography.body, fontSize: 10, lineHeight: 15, color: Colors.textSecondary, marginTop: 3 },
  row: { minHeight: 82, flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 13, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: Colors.borderSubtle },
  rowUnread: { backgroundColor: "rgba(255,85,0,0.035)" },
  icon: { width: 36, height: 36, borderRadius: Radius.sm, alignItems: "center", justifyContent: "center", backgroundColor: Colors.surfaceHigh, borderWidth: 1, borderColor: Colors.border },
  iconUnread: { borderColor: "rgba(255,85,0,0.48)" },
  rowTitleLine: { flexDirection: "row", alignItems: "center", gap: 7 },
  rowTitle: { fontFamily: Typography.bodyBold, fontSize: 10, color: Colors.text, letterSpacing: 0.65 },
  rowBody: { fontFamily: Typography.body, fontSize: 11, lineHeight: 16, color: Colors.textSecondary, marginTop: 4 },
  time: { fontFamily: Typography.bodyMedium, fontSize: 7, color: Colors.muted, letterSpacing: 1, marginTop: 6 },
  dot: { width: 5, height: 5, borderRadius: 3, backgroundColor: Colors.accent },
  pressed: { opacity: 0.68 },
  empty: { alignItems: "center", paddingHorizontal: 34, paddingTop: 80 },
  emptyTitle: { fontFamily: Typography.heading, fontSize: 16, color: Colors.text, letterSpacing: 0.9, marginTop: 15 },
  emptyBody: { fontFamily: Typography.body, fontSize: 11, lineHeight: 17, color: Colors.muted, textAlign: "center", marginTop: 7 },
});
