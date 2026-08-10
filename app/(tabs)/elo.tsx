import { Feather } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React, { useEffect, useMemo, useState } from "react";
import { Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { PlayerAvatar } from "@/components/PlayerAvatar";
import { ScreenHeader } from "@/components/ScreenHeader";
import { ActivityRow } from "@/components/ui/ActivityRow";
import { GameResultModal } from "@/components/ui/GameResultModal";
import { PlayerQrModal } from "@/components/ui/PlayerQrModal";
import { ProfileHero } from "@/components/ui/ProfileHero";
import { ProfileStats } from "@/components/ui/ProfileStats";
import { PlayerSummaryRow } from "@/components/ui/PlayerSummaryRow";
import { Colors, Radius } from "@/constants/colors";
import { type FeedItem, type FeedMatchSummary } from "@/constants/data";
import { Typography } from "@/constants/typography";
import { useApp } from "@/context/AppContext";
import { useAuth } from "@/context/AuthContext";
import { useNotifications } from "@/context/NotificationContext";
import { fetchSuggestedPlayers, searchPlayers } from "@/services/profileService";
import type { Player } from "@/constants/data";

type ProfileTab = "activity" | "friends" | "inbox";

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
    isFriend,
  } = useApp();
  const { bottom } = useSafeAreaInsets();
  const { unreadCount, notifications, openNotification, readNotification, readAll } = useNotifications();
  const [activeTab, setActiveTab] = useState<ProfileTab>("activity");
  const [qrVisible, setQrVisible] = useState(false);
  const [friendQuery, setFriendQuery] = useState("");
  const [searchResults, setSearchResults] = useState<Player[]>([]);
  const [suggestedFriends, setSuggestedFriends] = useState<Player[]>([]);
  const [selectedResult, setSelectedResult] = useState<{
    match: FeedMatchSummary;
    sport: FeedItem["sport"];
    courtName?: string;
  } | null>(null);

  const friends = getFriendsList();
  const activity = useMemo(
    () => feed.filter((item) => item.playerId === currentUser.id).slice(0, 8),
    [feed, currentUser.id]
  );
  const daysActive = useMemo(() => {
    const joined = new Date(currentUser.memberSince).getTime();
    if (!Number.isFinite(joined)) return 0;
    return Math.max(1, Math.floor((Date.now() - joined) / 86_400_000) + 1);
  }, [currentUser.memberSince]);

  useEffect(() => {
    if (!localCourt?.id) return setSuggestedFriends([]);
    let cancelled = false;
    void fetchSuggestedPlayers(currentUser.id, localCourt.id).then((players) => {
      if (!cancelled) setSuggestedFriends(players.filter((player) => player.id !== currentUser.id && !isFriend(player.id)).slice(0, 5));
    });
    return () => { cancelled = true; };
  }, [currentUser.id, isFriend, localCourt?.id]);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (friendQuery.trim().length < 2) return setSearchResults([]);
      void searchPlayers(friendQuery).then((players) => setSearchResults(players.filter((player) => player.id !== currentUser.id).slice(0, 5)));
    }, 220);
    return () => clearTimeout(timer);
  }, [currentUser.id, friendQuery]);

  return (
    <View style={styles.screen}>
      <ScreenHeader
        title={currentUser.name}
        right={<View style={styles.headerActions}>
          <Pressable
            onPress={() => router.push("/settings")}
            style={styles.headerAction}
            accessibilityRole="button"
            accessibilityLabel="Open settings"
            hitSlop={12}
          >
            <Feather name="settings" size={15} color={Colors.textSecondary} />
          </Pressable>
        </View>
        }
      />

      <ProfileHero
        courtLabel={localCourt?.shortName || localCourt?.name}
        elo={currentUser.elo}
        headline={`@${profile?.username || currentUser.username || "player"}`}
        initials={currentUser.avatar || "LC"}
        memberSince={shortDate(currentUser.memberSince)}
        name={currentUser.name}
        onOpenQr={() => setQrVisible(true)}
        playerId={currentUser.id}
      />
      <ProfileStats metrics={[
        { value: currentUser.wins, label: "WINS", tone: "win" },
        { value: currentUser.losses, label: "LOSSES", tone: "loss" },
        { value: currentUser.checkIns, label: "CHECK-INS" },
        { value: daysActive, label: "DAYS ACTIVE" },
      ]} />

      <View style={styles.tabs}>
        <ProfileTabButton label="ACTIVITY" active={activeTab === "activity"} onPress={() => setActiveTab("activity")} />
        <ProfileTabButton label="FRIENDS" active={activeTab === "friends"} onPress={() => setActiveTab("friends")} />
        <ProfileTabButton
          badge={unreadCount}
          label="INBOX"
          active={activeTab === "inbox"}
          onPress={() => setActiveTab("inbox")}
        />
      </View>

      <ScrollView
        contentContainerStyle={{ paddingBottom: Platform.OS === "web" ? 92 : bottom + 104 }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        style={styles.tabContent}
      >
        {activeTab === "activity" ? (
          <View style={styles.content}>
            {activity.length > 0 ? (
              activity.map((item, index) => (
                <ActivityRow
                  isFirst={index === 0}
                  isLast={index === activity.length - 1}
                  item={item}
                  key={item.id}
                  onActorPress={item.playerId ? () => router.push(`/player/${item.playerId}`) : undefined}
                  onPress={item.type === "game_result" && item.match
                    ? () => setSelectedResult({ match: item.match!, sport: item.sport, courtName: item.courtName })
                    : item.playerId
                      ? () => router.push(`/player/${item.playerId}`)
                      : undefined}
                />
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
        ) : activeTab === "friends" ? (
          <View style={styles.content}>
            <View style={styles.searchWrap}>
              <Feather color={Colors.muted} name="search" size={15} />
              <TextInput
                accessibilityLabel="Search players by username"
                autoCapitalize="none"
                onChangeText={setFriendQuery}
                placeholder="Search by username"
                placeholderTextColor={Colors.mutedDark}
                style={styles.searchInput}
                value={friendQuery}
              />
            </View>
            {incomingFriendRequests.length > 0 ? (
              <View style={styles.requestGroup}>
                <Text style={styles.requestGroupTitle}>FRIEND REQUESTS</Text>
                {incomingFriendRequests.map((player) => (
                  <View key={player.id} style={styles.requestRow}>
                    <Pressable
                      style={styles.requestIdentity}
                      onPress={() => router.push(`/player/${player.id}`)}
                    >
                      <PlayerAvatar initials={player.avatar} name={player.name} playerId={player.id} size={38} />
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
              <PlayerSummaryRow
                detail={localCourt?.shortName || localCourt?.name || "NO LOCAL COURT"}
                friend
                key={friend.id}
                onPress={() => router.push(`/player/${friend.id}`)}
                player={friend}
              />
            )) : incomingFriendRequests.length === 0 ? (
              <EmptyState title="YOUR COURT CREW STARTS HERE" body="Open a player profile to send a friend request." />
            ) : null}
            {(searchResults.length > 0 ? searchResults : suggestedFriends).length > 0 ? (
              <View style={styles.suggested}>
                <Text style={styles.suggestedTitle}>{searchResults.length > 0 ? "SEARCH RESULTS" : "SUGGESTED FRIENDS"}</Text>
                {(searchResults.length > 0 ? searchResults : suggestedFriends).map((player) => (
                  <PlayerSummaryRow
                    detail={localCourt?.shortName || localCourt?.name || "NO LOCAL COURT"}
                    key={player.id}
                    onPress={() => router.push(`/player/${player.id}`)}
                    player={player}
                  />
                ))}
              </View>
            ) : null}
          </View>
        ) : (
          <View style={styles.content}>
            {unreadCount > 0 ? (
              <Pressable accessibilityRole="button" onPress={() => void readAll()} style={styles.readAll}>
                <Text style={styles.readAllText}>MARK ALL READ</Text>
              </Pressable>
            ) : null}
            {notifications.length > 0 ? notifications.map((notification) => (
              <Pressable key={notification.id} onPress={() => {
                if (notification.type === "friend_request" || notification.type === "friend_accepted") {
                  void readNotification(notification);
                  setActiveTab("friends");
                } else {
                  void openNotification(notification);
                }
              }} style={({ pressed }) => [styles.notificationRow, pressed && styles.pressed]}>
                <View style={[styles.notificationDot, notification.readAt && styles.notificationDotRead]} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.notificationTitle}>{notification.title}</Text>
                  <Text style={styles.notificationBody}>{notification.body}</Text>
                </View>
                <Text style={styles.notificationTime}>{relativeNotificationTime(notification.createdAt)}</Text>
              </Pressable>
            )) : <EmptyState title="YOU'RE ALL CAUGHT UP" body="Friend requests, game reviews, and run invites will appear here." />}
          </View>
        )}
      </ScrollView>
      <PlayerQrModal
        onClose={() => setQrVisible(false)}
        playerId={currentUser.id}
        playerName={currentUser.name}
        visible={qrVisible}
      />
      <GameResultModal
        courtName={selectedResult?.courtName}
        match={selectedResult?.match ?? null}
        onClose={() => setSelectedResult(null)}
        sport={selectedResult?.sport}
        visible={Boolean(selectedResult)}
      />
    </View>
  );
}

function ProfileTabButton({ label, active, onPress, badge = 0 }: { label: string; active: boolean; onPress: () => void; badge?: number }) {
  return (
    <Pressable onPress={onPress} style={[styles.tab, active && styles.tabActive]}>
      <View style={styles.tabLabelRow}>
        <Text style={[styles.tabText, active && styles.tabTextActive]}>{label}</Text>
        {badge > 0 ? <View accessibilityLabel={`${badge} unread notifications`} style={styles.unreadDot} /> : null}
      </View>
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

function relativeNotificationTime(value: string): string {
  const minutes = Math.max(0, Math.floor((Date.now() - new Date(value).getTime()) / 60_000));
  if (minutes < 60) return minutes < 2 ? "NOW" : `${minutes}M`;
  const hours = Math.floor(minutes / 60);
  return hours < 24 ? `${hours}H` : `${Math.floor(hours / 24)}D`;
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Colors.background },
  tabContent: { flex: 1, minHeight: 0 },
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
  headerActions: { flexDirection: "row", gap: 8 },
  notificationBadge: { position: "absolute", top: -4, right: -4, minWidth: 15, height: 15, paddingHorizontal: 3, borderRadius: 8, alignItems: "center", justifyContent: "center", backgroundColor: Colors.accent, borderWidth: 1, borderColor: Colors.background },
  notificationBadgeText: { fontFamily: Typography.bodyBold, fontSize: 7, color: Colors.black },
  identity: { flexDirection: "row", alignItems: "center", paddingHorizontal: 20, paddingVertical: 22, gap: 14 },
  avatarColumn: { alignItems: "center" },
  qrHint: { marginTop: 6, flexDirection: "row", alignItems: "center", gap: 4 },
  qrHintText: { fontFamily: Typography.bodyBold, fontSize: 7, color: Colors.accent, letterSpacing: 1 },
  identityCopy: { flex: 1, minWidth: 0 },
  displayName: { fontFamily: Typography.heading, fontSize: 23, lineHeight: 25, color: Colors.text, letterSpacing: 0.5 },
  username: { fontFamily: Typography.body, fontSize: 11, color: Colors.textSecondary, marginTop: 2 },
  memberSince: { fontFamily: Typography.bodyMedium, fontSize: 7, color: Colors.muted, letterSpacing: 1.25, marginTop: 4 },
  metaRow: { flexDirection: "row", gap: 6, marginTop: 9, maxWidth: "100%" },
  metaPill: { maxWidth: 132, flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 7, paddingVertical: 4, borderRadius: 999, backgroundColor: Colors.surfaceHigh },
  metaPillText: { flexShrink: 1, fontFamily: Typography.bodyBold, fontSize: 7, color: Colors.textSecondary, letterSpacing: 0.8 },
  eloBlock: { width: 70, alignItems: "center", justifyContent: "center" },
  stats: { flexDirection: "row", marginHorizontal: 20, borderTopWidth: 1, borderBottomWidth: 1, borderColor: Colors.borderSubtle },
  stat: { flex: 1, alignItems: "center", justifyContent: "center", minHeight: 64 },
  statBorder: { borderLeftWidth: 1, borderLeftColor: Colors.border },
  statValue: { fontFamily: Typography.heading, fontSize: 22, lineHeight: 24, color: Colors.text },
  statLabel: { fontFamily: Typography.bodyBold, fontSize: 7, color: Colors.muted, letterSpacing: 1.2, marginTop: 3 },
  tabs: { flexDirection: "row", marginTop: 28, paddingHorizontal: 20, borderBottomWidth: 1, borderBottomColor: Colors.border },
  tab: { minWidth: 92, paddingVertical: 12, marginRight: 7, alignItems: "center", borderBottomWidth: 2, borderBottomColor: "transparent" },
  tabActive: { borderBottomColor: Colors.accent },
  tabText: { fontFamily: Typography.bodyBold, fontSize: 9, letterSpacing: 1.5, color: Colors.muted },
  tabTextActive: { color: Colors.text },
  tabLabelRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  unreadDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: Colors.accent },
  content: { paddingHorizontal: 20, paddingTop: 17 },
  timelineRow: { flexDirection: "row", minHeight: 60 },
  timelineRail: { width: 20, alignItems: "center" },
  timelineDot: { width: 8, height: 8, borderRadius: 4, marginTop: 5, borderWidth: 1, borderColor: Colors.mutedDark, backgroundColor: Colors.background },
  timelineDotActive: { backgroundColor: Colors.accent, borderColor: Colors.accent },
  timelineLine: { flex: 1, width: 1, backgroundColor: Colors.border, marginVertical: 4 },
  timelineCopy: { flex: 1, paddingLeft: 8, paddingBottom: 15 },
  timelineMessage: { fontFamily: Typography.bodyExtraLight, fontSize: 12, lineHeight: 17, color: Colors.text },
  timelineTime: { fontFamily: Typography.bodyMedium, fontSize: 8, color: Colors.muted, letterSpacing: 1.2, marginTop: 4, textTransform: "uppercase" },
  matchRow: { flexDirection: "row", alignItems: "center", gap: 12, minHeight: 60, borderBottomWidth: 1, borderBottomColor: Colors.borderSubtle },
  resultBadge: { width: 28, height: 28, borderRadius: Radius.sm, backgroundColor: Colors.surfaceHigh, alignItems: "center", justifyContent: "center" },
  resultText: { fontFamily: Typography.heading, fontSize: 14, color: Colors.text },
  friendRow: { flexDirection: "row", alignItems: "center", gap: 12, minHeight: 66, borderBottomWidth: 1, borderBottomColor: Colors.borderSubtle },
  friendName: { fontFamily: Typography.heading, fontSize: 15, color: Colors.text, letterSpacing: 0.4 },
  friendMeta: { fontFamily: Typography.bodyMedium, fontSize: 8, color: Colors.muted, letterSpacing: 1.1, marginTop: 3 },
  requestGroup: { marginBottom: 10 },
  requestGroupTitle: { fontFamily: Typography.bodySemiBold, fontSize: 8, color: Colors.accent, letterSpacing: 1.5, marginBottom: 7 },
  requestRow: { minHeight: 58, flexDirection: "row", alignItems: "center", gap: 7, borderBottomWidth: 1, borderBottomColor: Colors.borderSubtle },
  requestIdentity: { flex: 1, minWidth: 0, flexDirection: "row", alignItems: "center", gap: 10 },
  acceptRequest: { minHeight: 30, justifyContent: "center", paddingHorizontal: 10, borderRadius: Radius.sm, backgroundColor: Colors.accent },
  acceptRequestText: { fontFamily: Typography.bodyBold, fontSize: 8, color: Colors.black, letterSpacing: 1 },
  declineRequest: { width: 30, height: 30, alignItems: "center", justifyContent: "center", borderRadius: Radius.sm, borderWidth: 1, borderColor: Colors.border },
  searchWrap: { width: "100%", maxWidth: 360, alignSelf: "center", minHeight: 44, marginBottom: 18, paddingHorizontal: 12, flexDirection: "row", alignItems: "center", gap: 9, borderWidth: 1, borderColor: Colors.border, borderRadius: Radius.lg, backgroundColor: Colors.surface },
  searchInput: { flex: 1, minWidth: 0, color: Colors.text, fontFamily: Typography.body, fontSize: 12 },
  suggested: { marginTop: 22 },
  suggestedTitle: { marginBottom: 5, fontFamily: Typography.bodyBold, fontSize: 8, color: Colors.muted, letterSpacing: 1.4 },
  readAll: { minHeight: 36, alignSelf: "flex-end", justifyContent: "center" },
  readAllText: { fontFamily: Typography.bodyBold, fontSize: 8, color: Colors.accent, letterSpacing: 1 },
  notificationRow: { minHeight: 70, flexDirection: "row", alignItems: "center", gap: 11, borderBottomWidth: 1, borderBottomColor: Colors.borderSubtle },
  notificationDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: Colors.accent },
  notificationDotRead: { backgroundColor: Colors.borderLight },
  notificationTitle: { fontFamily: Typography.bodySemiBold, fontSize: 12, color: Colors.text },
  notificationBody: { marginTop: 3, fontFamily: Typography.body, fontSize: 10, lineHeight: 14, color: Colors.textSecondary },
  notificationTime: { fontFamily: Typography.bodyBold, fontSize: 7, color: Colors.muted, letterSpacing: 0.7 },
  pressed: { opacity: 0.7 },
  empty: { paddingVertical: 44, alignItems: "center", paddingHorizontal: 28 },
  emptyTitle: { fontFamily: Typography.heading, fontSize: 17, color: Colors.text, letterSpacing: 1.1, textAlign: "center" },
  emptyBody: { fontFamily: Typography.body, fontSize: 12, lineHeight: 18, color: Colors.muted, textAlign: "center", marginTop: 7 },
});
