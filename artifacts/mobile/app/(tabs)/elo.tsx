import { Feather } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React, { useMemo, useState } from "react";
import { Platform, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { PlayerAvatar } from "@/components/PlayerAvatar";
import { ScreenHeader } from "@/components/ScreenHeader";
import { Colors, Radius } from "@/constants/colors";
import { getEloTier } from "@/constants/data";
import { Typography } from "@/constants/typography";
import { useApp } from "@/context/AppContext";
import { useAuth } from "@/context/AuthContext";

type ProfileTab = "activity" | "friends";

function shortDate(value: string): string {
  return new Date(value).toLocaleDateString("en-US", {
    month: "short",
    year: "numeric",
  }).toUpperCase();
}

export default function MeScreen() {
  const router = useRouter();
  const { profile } = useAuth();
  const { currentUser, feed, matches, localCourt, getFriendsList } = useApp();
  const { bottom } = useSafeAreaInsets();
  const [activeTab, setActiveTab] = useState<ProfileTab>("activity");

  const friends = getFriendsList();
  const tier = getEloTier(currentUser.elo);
  const activity = useMemo(
    () => feed.filter((item) => item.playerId === currentUser.id).slice(0, 8),
    [feed, currentUser.id]
  );
  const daysActive = useMemo(() => {
    const joined = new Date(currentUser.memberSince).getTime();
    if (!Number.isFinite(joined)) return 0;
    return Math.max(1, Math.floor((Date.now() - joined) / 86_400_000) + 1);
  }, [currentUser.memberSince]);

  return (
    <View style={styles.screen}>
      <ScreenHeader
        title="ME"
        right={<Pressable
          onPress={() => router.push("/settings")}
          style={styles.headerAction}
          accessibilityRole="button"
          accessibilityLabel="Open settings"
          hitSlop={12}
        >
          <Feather name="settings" size={15} color={Colors.textSecondary} />
        </Pressable>
        }
      />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: Platform.OS === "web" ? 92 : bottom + 104 }}
      >
        <View style={styles.identity}>
          <View style={styles.avatarGlow}>
            <PlayerAvatar initials={currentUser.avatar || "LC"} size={72} />
          </View>
          <View style={styles.identityCopy}>
            <Text style={styles.displayName}>{currentUser.name.toUpperCase()}</Text>
            <Text style={styles.username}>@{profile?.username || "player"}</Text>
            <Text style={styles.memberSince}>MEMBER SINCE {shortDate(currentUser.memberSince)}</Text>
            <View style={styles.metaRow}>
              <View style={styles.metaPill}>
                <Text style={styles.metaPillText}>{tier}</Text>
              </View>
              {localCourt ? (
                <View style={styles.metaPill}>
                  <Feather name="map-pin" size={9} color={Colors.textSecondary} />
                  <Text style={styles.metaPillText} numberOfLines={1}>{localCourt.name}</Text>
                </View>
              ) : null}
            </View>
          </View>
          <View style={styles.eloBlock}>
            <Text style={styles.eloValue}>{currentUser.elo}</Text>
            <Text style={styles.eloLabel}>ELO</Text>
          </View>
        </View>

        <View style={styles.stats}>
          {[
            [currentUser.wins, "WINS"],
            [currentUser.losses, "LOSSES"],
            [currentUser.checkIns, "CHECK-INS"],
            [daysActive, "DAYS ACTIVE"],
          ].map(([value, label], index) => (
            <View key={String(label)} style={[styles.stat, index > 0 && styles.statBorder]}>
              <Text style={styles.statValue}>{value}</Text>
              <Text style={styles.statLabel}>{label}</Text>
            </View>
          ))}
        </View>

        <View style={styles.tabs}>
          <ProfileTabButton label="ACTIVITY" active={activeTab === "activity"} onPress={() => setActiveTab("activity")} />
          <ProfileTabButton label="FRIENDS" active={activeTab === "friends"} onPress={() => setActiveTab("friends")} />
        </View>

        {activeTab === "activity" ? (
          <View style={styles.content}>
            {activity.length > 0 ? (
              activity.map((item, index) => (
                <View key={item.id} style={styles.timelineRow}>
                  <View style={styles.timelineRail}>
                    <View style={[styles.timelineDot, index === 0 && styles.timelineDotActive]} />
                    {index < activity.length - 1 ? <View style={styles.timelineLine} /> : null}
                  </View>
                  <View style={styles.timelineCopy}>
                    <Text style={styles.timelineMessage}>{item.message}</Text>
                    <Text style={styles.timelineTime}>{item.timestamp}</Text>
                  </View>
                </View>
              ))
            ) : matches.length > 0 ? (
              matches.slice(0, 8).map((match) => (
                <View key={match.id} style={styles.matchRow}>
                  <View style={styles.resultBadge}>
                    <Text style={styles.resultText}>{match.result === "WIN" ? "W" : "L"}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.timelineMessage}>{match.courtName}</Text>
                    <Text style={styles.timelineTime}>{match.date} · {match.teamScore}–{match.opposingScore}</Text>
                  </View>
                </View>
              ))
            ) : (
              <EmptyState title="NO ACTIVITY YET" body="Check in, join a run, or log a game to build your history." />
            )}
          </View>
        ) : (
          <View style={styles.content}>
            {friends.length > 0 ? friends.map((friend) => (
              <Pressable
                key={friend.id}
                style={({ pressed }) => [styles.friendRow, pressed && styles.pressed]}
                onPress={() => router.push(`/player/${friend.id}`)}
              >
                <PlayerAvatar initials={friend.avatar} size={42} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.friendName}>{friend.name.toUpperCase()}</Text>
                  <Text style={styles.friendMeta}>{friend.elo} ELO · {friend.tier}</Text>
                </View>
                <Feather name="chevron-right" size={18} color={Colors.muted} />
              </Pressable>
            )) : (
              <EmptyState title="YOUR COURT CREW STARTS HERE" body="Open a player profile to send a friend request." />
            )}
          </View>
        )}
      </ScrollView>
    </View>
  );
}

function ProfileTabButton({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={[styles.tab, active && styles.tabActive]}>
      <Text style={[styles.tabText, active && styles.tabTextActive]}>{label}</Text>
    </Pressable>
  );
}

function EmptyState({ title, body }: { title: string; body: string }) {
  return (
    <View style={styles.empty}>
      <Text style={styles.emptyTitle}>{title}</Text>
      <Text style={styles.emptyBody}>{body}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Colors.background },
  header: {
    minHeight: 104,
    paddingHorizontal: 20,
    paddingBottom: 15,
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-between",
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  headerLockup: { flexDirection: "row", alignItems: "center", gap: 10 },
  headerTitle: { fontFamily: Typography.heading, fontSize: 27, lineHeight: 30, color: Colors.text, letterSpacing: 1.4 },
  headerAction: {
    width: 32,
    height: 32,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.md,
    backgroundColor: Colors.surface,
  },
  identity: { flexDirection: "row", alignItems: "center", paddingHorizontal: 20, paddingVertical: 22, gap: 14 },
  avatarGlow: {
    padding: 2,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(255,85,0,0.72)",
    shadowColor: Colors.accent,
    shadowOpacity: 0.3,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 0 },
  },
  identityCopy: { flex: 1, minWidth: 0 },
  displayName: { fontFamily: Typography.heading, fontSize: 23, lineHeight: 25, color: Colors.text, letterSpacing: 0.5 },
  username: { fontFamily: Typography.body, fontSize: 11, color: Colors.textSecondary, marginTop: 2 },
  memberSince: { fontFamily: Typography.bodyMedium, fontSize: 7, color: Colors.muted, letterSpacing: 1.25, marginTop: 4 },
  metaRow: { flexDirection: "row", gap: 6, marginTop: 9, maxWidth: "100%" },
  metaPill: { maxWidth: 132, flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 7, paddingVertical: 4, borderRadius: 999, backgroundColor: Colors.surfaceHigh },
  metaPillText: { flexShrink: 1, fontFamily: Typography.bodyBold, fontSize: 7, color: Colors.textSecondary, letterSpacing: 0.8 },
  eloBlock: { alignItems: "flex-end", alignSelf: "flex-start", paddingTop: 2 },
  eloValue: { fontFamily: Typography.heading, fontSize: 31, lineHeight: 32, color: Colors.accent },
  eloLabel: { fontFamily: Typography.bodyBold, fontSize: 7, color: Colors.muted, letterSpacing: 1.6 },
  stats: { flexDirection: "row", marginHorizontal: 20, backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border, borderRadius: Radius.md },
  stat: { flex: 1, alignItems: "center", justifyContent: "center", minHeight: 64 },
  statBorder: { borderLeftWidth: 1, borderLeftColor: Colors.border },
  statValue: { fontFamily: Typography.heading, fontSize: 22, lineHeight: 24, color: Colors.text },
  statLabel: { fontFamily: Typography.bodyBold, fontSize: 7, color: Colors.muted, letterSpacing: 1.2, marginTop: 3 },
  tabs: { flexDirection: "row", marginTop: 28, paddingHorizontal: 20, borderBottomWidth: 1, borderBottomColor: Colors.border },
  tab: { minWidth: 92, paddingVertical: 12, marginRight: 7, alignItems: "center", borderBottomWidth: 2, borderBottomColor: "transparent" },
  tabActive: { borderBottomColor: Colors.accent },
  tabText: { fontFamily: Typography.bodyBold, fontSize: 9, letterSpacing: 1.5, color: Colors.muted },
  tabTextActive: { color: Colors.text },
  content: { paddingHorizontal: 20, paddingTop: 17 },
  timelineRow: { flexDirection: "row", minHeight: 60 },
  timelineRail: { width: 20, alignItems: "center" },
  timelineDot: { width: 8, height: 8, borderRadius: 4, marginTop: 5, borderWidth: 1, borderColor: Colors.mutedDark, backgroundColor: Colors.background },
  timelineDotActive: { backgroundColor: Colors.accent, borderColor: Colors.accent },
  timelineLine: { flex: 1, width: 1, backgroundColor: Colors.border, marginVertical: 4 },
  timelineCopy: { flex: 1, paddingLeft: 8, paddingBottom: 15 },
  timelineMessage: { fontFamily: Typography.bodyMedium, fontSize: 12, lineHeight: 17, color: Colors.text },
  timelineTime: { fontFamily: Typography.bodyMedium, fontSize: 8, color: Colors.muted, letterSpacing: 1.2, marginTop: 4, textTransform: "uppercase" },
  matchRow: { flexDirection: "row", alignItems: "center", gap: 12, minHeight: 60, borderBottomWidth: 1, borderBottomColor: Colors.borderSubtle },
  resultBadge: { width: 28, height: 28, borderRadius: Radius.sm, backgroundColor: Colors.surfaceHigh, alignItems: "center", justifyContent: "center" },
  resultText: { fontFamily: Typography.heading, fontSize: 14, color: Colors.text },
  friendRow: { flexDirection: "row", alignItems: "center", gap: 12, minHeight: 66, borderBottomWidth: 1, borderBottomColor: Colors.borderSubtle },
  friendName: { fontFamily: Typography.heading, fontSize: 15, color: Colors.text, letterSpacing: 0.4 },
  friendMeta: { fontFamily: Typography.bodyMedium, fontSize: 8, color: Colors.muted, letterSpacing: 1.1, marginTop: 3 },
  pressed: { opacity: 0.7 },
  empty: { paddingVertical: 44, alignItems: "center", paddingHorizontal: 28 },
  emptyTitle: { fontFamily: Typography.heading, fontSize: 17, color: Colors.text, letterSpacing: 1.1, textAlign: "center" },
  emptyBody: { fontFamily: Typography.body, fontSize: 12, lineHeight: 18, color: Colors.muted, textAlign: "center", marginTop: 7 },
});
