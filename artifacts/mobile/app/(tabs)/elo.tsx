import { Feather } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React, { useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { PlayerAvatar } from "@/components/PlayerAvatar";
import { HeaderIconButton } from "@/components/DetailHeader";
import { AppTabs } from "@/components/AppTabs";
import { ScreenHeader } from "@/components/ScreenHeader";
import { ProfileScaffold } from "@/components/profile/ProfileScaffold";
import { Colors, Radius } from "@/constants/colors";
import { getEloTier } from "@/constants/data";
import { Typography, TypeScale } from "@/constants/typography";
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
  const {
    currentUser,
    feed,
    matches,
    localCourt,
    getFriendsList,
    incomingFriendRequests,
    acceptFriendRequest,
    removeFriend,
  } = useApp();
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
    <ProfileScaffold
      header={(
        <ScreenHeader
          title={`@${profile?.username || "player"}`}
          titleRole="identity"
          right={(
            <View style={styles.headerActions}>
              <HeaderIconButton
                icon="settings"
                label="Open settings"
                onPress={() => router.push("/settings")}
              />
            </View>
          )}
        />
      )}
      player={{ ...currentUser, tier }}
      username={profile?.username}
      courtName={localCourt?.name}
      supportingText={`MEMBER SINCE ${shortDate(currentUser.memberSince)}`}
      stats={[
        { key: "wins", value: currentUser.wins, label: "WINS" },
        { key: "losses", value: currentUser.losses, label: "LOSSES" },
        { key: "checkins", value: currentUser.checkIns, label: "CHECK-INS" },
        { key: "days", value: daysActive, label: "DAYS" },
      ]}
      presentation="tab"
      bottomInset={bottom}
    >

        <AppTabs
          items={[
            { value: "activity", label: "ACTIVITY" },
            { value: "friends", label: "FRIENDS", badge: incomingFriendRequests.length > 0 },
          ]}
          value={activeTab}
          onChange={setActiveTab}
        />

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
            {incomingFriendRequests.length > 0 ? (
              <View style={styles.requestGroup}>
                <Text style={styles.requestGroupTitle}>FRIEND REQUESTS</Text>
                {incomingFriendRequests.map((player) => (
                  <View key={player.id} style={styles.requestRow}>
                    <Pressable
                      style={styles.requestIdentity}
                      onPress={() => router.push(`/player/${player.id}`)}
                      accessibilityRole="button"
                      accessibilityLabel={`Open ${player.name}'s profile`}
                    >
                      <PlayerAvatar initials={player.avatar} size={38} />
                      <View style={{ flex: 1 }}>
                        <Text style={styles.friendName}>{player.name.toUpperCase()}</Text>
                        <Text style={styles.friendMeta}>{player.elo} ELO</Text>
                      </View>
                    </Pressable>
                    <Pressable
                      style={styles.acceptRequest}
                      onPress={() => void acceptFriendRequest(player.id)}
                      accessibilityRole="button"
                      accessibilityLabel={`Accept ${player.name}'s friend request`}
                    >
                      <Text style={styles.acceptRequestText}>ACCEPT</Text>
                    </Pressable>
                    <Pressable
                      style={styles.declineRequest}
                      onPress={() => void removeFriend(player.id)}
                      accessibilityRole="button"
                      accessibilityLabel={`Decline ${player.name}'s friend request`}
                    >
                      <Feather name="x" size={14} color={Colors.muted} />
                    </Pressable>
                  </View>
                ))}
              </View>
            ) : null}
            {friends.length > 0 ? friends.map((friend) => (
              <Pressable
                key={friend.id}
                style={({ pressed }) => [styles.friendRow, pressed && styles.pressed]}
                onPress={() => router.push(`/player/${friend.id}`)}
                accessibilityRole="button"
                accessibilityLabel={`Open ${friend.name}'s profile`}
              >
                <PlayerAvatar initials={friend.avatar} size={42} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.friendName}>{friend.name.toUpperCase()}</Text>
                  <Text style={styles.friendMeta}>{friend.elo} ELO · {friend.tier}</Text>
                </View>
                <Feather name="chevron-right" size={18} color={Colors.muted} />
              </Pressable>
            )) : incomingFriendRequests.length === 0 ? (
              <EmptyState title="YOUR COURT CREW STARTS HERE" body="Open a player profile to send a friend request." />
            ) : null}
            <Pressable
              style={styles.manageFriends}
              onPress={() => router.push("/friends")}
              accessibilityRole="button"
              accessibilityLabel="Find and manage friends"
            >
              <Text style={styles.manageFriendsText}>FIND & MANAGE FRIENDS</Text>
              <Feather name="arrow-up-right" size={14} color={Colors.accent} />
            </Pressable>
          </View>
        )}
    </ProfileScaffold>
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
  headerActions: { flexDirection: "row", gap: 8 },
  content: { paddingHorizontal: 20, paddingTop: 17 },
  timelineRow: { flexDirection: "row", minHeight: 60 },
  timelineRail: { width: 20, alignItems: "center" },
  timelineDot: { width: 8, height: 8, borderRadius: 4, marginTop: 5, borderWidth: 1, borderColor: Colors.mutedDark, backgroundColor: Colors.background },
  timelineDotActive: { backgroundColor: Colors.accent, borderColor: Colors.accent },
  timelineLine: { flex: 1, width: 1, backgroundColor: Colors.border, marginVertical: 4 },
  timelineCopy: { flex: 1, paddingLeft: 8, paddingBottom: 15 },
  timelineMessage: { fontFamily: Typography.body, ...TypeScale.bodyMedium, color: Colors.text },
  timelineTime: { fontFamily: Typography.bodyMedium, ...TypeScale.label, color: Colors.muted, letterSpacing: 1, marginTop: 3, textTransform: "uppercase" },
  matchRow: { flexDirection: "row", alignItems: "center", gap: 12, minHeight: 60, borderBottomWidth: 1, borderBottomColor: Colors.borderSubtle },
  resultBadge: { width: 28, height: 28, borderRadius: Radius.sm, backgroundColor: Colors.surfaceHigh, alignItems: "center", justifyContent: "center" },
  resultText: { fontFamily: Typography.heading, fontSize: 14, color: Colors.text },
  friendRow: { flexDirection: "row", alignItems: "center", gap: 12, minHeight: 66, borderBottomWidth: 1, borderBottomColor: Colors.borderSubtle },
  friendName: { fontFamily: Typography.headingRegular, ...TypeScale.titleMedium, color: Colors.text },
  friendMeta: { fontFamily: Typography.bodyMedium, ...TypeScale.label, color: Colors.muted, letterSpacing: 0.8, marginTop: 2 },
  requestGroup: { marginBottom: 10 },
  requestGroupTitle: { fontFamily: Typography.bodySemiBold, ...TypeScale.label, color: Colors.accent, letterSpacing: 1.2, marginBottom: 7 },
  requestRow: { minHeight: 58, flexDirection: "row", alignItems: "center", gap: 7, borderBottomWidth: 1, borderBottomColor: Colors.borderSubtle },
  requestIdentity: { flex: 1, minWidth: 0, minHeight: 44, flexDirection: "row", alignItems: "center", gap: 10 },
  acceptRequest: { minHeight: 44, justifyContent: "center", paddingHorizontal: 10, borderRadius: Radius.sm, backgroundColor: Colors.accent },
  acceptRequestText: { fontFamily: Typography.bodyBold, ...TypeScale.label, color: Colors.black, letterSpacing: 0.8 },
  declineRequest: { width: 44, height: 44, alignItems: "center", justifyContent: "center", borderRadius: Radius.sm, borderWidth: 1, borderColor: Colors.border },
  manageFriends: { minHeight: 46, marginTop: 18, paddingHorizontal: 14, flexDirection: "row", alignItems: "center", justifyContent: "space-between", borderRadius: Radius.md, borderWidth: 1, borderColor: Colors.border, backgroundColor: Colors.surface },
  manageFriendsText: { fontFamily: Typography.bodySemiBold, ...TypeScale.label, color: Colors.textSecondary, letterSpacing: 0.9 },
  pressed: { opacity: 0.7 },
  empty: { paddingVertical: 44, alignItems: "center", paddingHorizontal: 28 },
  emptyTitle: { fontFamily: Typography.headingRegular, ...TypeScale.titleMedium, color: Colors.text, letterSpacing: 0.7, textAlign: "center" },
  emptyBody: { fontFamily: Typography.body, ...TypeScale.supporting, color: Colors.muted, textAlign: "center", marginTop: 6 },
});
