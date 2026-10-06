import { Feather } from "@expo/vector-icons";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import React, { useCallback, useEffect, useState } from "react";
import {
  Alert,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { ChallengeSheet } from "@/components/challenge/ChallengeSheet";
import { ActivityRow } from "@/components/ui/ActivityRow";
import { DetailHeader } from "@/components/ui/DetailHeader";
import { GameResultModal } from "@/components/ui/GameResultModal";
import { PlayerQrModal } from "@/components/ui/PlayerQrModal";
import { ProfileHero } from "@/components/ui/ProfileHero";
import { HeadToHeadGameRow } from "@/components/ui/HeadToHeadGameRow";
import { ProfileStats } from "@/components/ui/ProfileStats";
import { StickyActionBar } from "@/components/ui/StickyActionBar";
import { HeadToHeadSummary } from "@/components/ui/HeadToHeadSummary";
import { Colors, Radius } from "@/constants/colors";
import {
  Court,
  type FeedItem,
  Player,
} from "@/constants/data";
import { Layout, Space } from "@/constants/layout";
import { TextStyles, Typography } from "@/constants/typography";
import { useApp } from "@/context/AppContext";
import { fetchHeadToHead } from "@/services/gameService";
import { fetchOpenChallengeWith } from "@/services/challengeService";
import type { Challenge } from "@/lib/challengeModel";
import { type HeadToHeadGame, summarizeHeadToHead } from "@/lib/headToHead";
import { fetchCourtById } from "@/services/courtService";
import { fetchLeaderboard, fetchProfile } from "@/services/profileService";
import { fetchPlayerActivity } from "@/services/feedService";
import { pairVisits } from "@/lib/activityPresentation";
import { fetchPlayerActivityByWeekday } from "@/services/checkInService";
import {
  blockUser,
  type ReportReason,
  reportUser,
  safetyControlsAvailable,
} from "@/services/safetyService";

function shortDate(value: string): string {
  return new Date(value).toLocaleDateString("en-US", {
    month: "short",
    year: "numeric",
  }).toUpperCase();
}

type PlayerProfileTab = "versus" | "activity" | "details";

function ProfileTab({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="tab"
      accessibilityState={{ selected: active }}
      onPress={onPress}
      style={({ pressed }) => [styles.profileTab, active && styles.profileTabActive, pressed && styles.pressed]}
    >
      <Text style={[styles.profileTabText, active && styles.profileTabTextActive]}>{label}</Text>
    </Pressable>
  );
}

function EmptyProfileState({ title, body }: { title: string; body: string }) {
  return (
    <View style={styles.emptyState}>
      <Feather color={Colors.muted} name="activity" size={20} />
      <Text style={styles.emptyTitle}>{title}</Text>
      <Text style={styles.emptyBody}>{body}</Text>
    </View>
  );
}

function DetailRow({ icon, label, value, onPress }: {
  icon: keyof typeof Feather.glyphMap;
  label: string;
  value: string;
  onPress?: () => void;
}) {
  const content = (
    <>
      <View style={styles.detailIcon}><Feather color={Colors.textSecondary} name={icon} size={15} /></View>
      <View style={styles.detailCopy}>
        <Text style={styles.detailLabel}>{label}</Text>
        <Text numberOfLines={1} style={styles.detailValue}>{value}</Text>
      </View>
      {onPress ? <Feather color={Colors.muted} name="chevron-right" size={16} /> : null}
    </>
  );
  return onPress ? (
    <Pressable accessibilityRole="button" onPress={onPress} style={({ pressed }) => [styles.detailRow, pressed && styles.pressed]}>
      {content}
    </Pressable>
  ) : <View style={styles.detailRow}>{content}</View>;
}

const WEEKDAYS = ["M", "T", "W", "T", "F", "S", "S"];

function ActivityHeatmap({ counts }: { counts: number[] }) {
  const max = Math.max(1, ...counts);
  return (
    <View style={styles.detailGroup}>
      <View style={styles.heatmapHeader}>
        <Text style={styles.detailGroupTitle}>COURT ACTIVITY</Text>
        <Text style={styles.heatmapPeriod}>LAST 90 DAYS</Text>
      </View>
      <View style={styles.heatmap}>
        {WEEKDAYS.map((day, index) => {
          const ratio = (counts[index] ?? 0) / max;
          const levelStyle = ratio === 0
            ? styles.heatLevel0
            : ratio < 0.34
              ? styles.heatLevel1
              : ratio < 0.67
                ? styles.heatLevel2
                : styles.heatLevel3;
          return (
            <View key={`${day}-${index}`} style={styles.heatColumn}>
              <View style={[styles.heatCell, levelStyle]} />
              <Text style={styles.heatDay}>{day}</Text>
              <Text style={styles.heatCount}>{counts[index] ?? 0}</Text>
            </View>
          );
        })}
      </View>
    </View>
  );
}

export default function PlayerProfileScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { courts, currentUser, localCourt, isFriend, isFriendPending, incomingFriendRequests, acceptFriendRequest, addFriend, removeFriend } =
    useApp();
  const { top, bottom } = useSafeAreaInsets();
  const topPad = Platform.OS === "web" ? 67 : top;

  const [player, setPlayer] = useState<Player | null>(null);
  const [playerCourt, setPlayerCourt] = useState<Court | null>(null);
  const [activity, setActivity] = useState<FeedItem[]>([]);
  const [sharedGames, setSharedGames] = useState<HeadToHeadGame[]>([]);
  const [weekdayActivity, setWeekdayActivity] = useState<number[]>(Array(7).fill(0));
  const [playerRank, setPlayerRank] = useState<number | null>(null);
  const [courtRank, setCourtRank] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<PlayerProfileTab>("versus");
  const [qrVisible, setQrVisible] = useState(false);
  const [challengeOpen, setChallengeOpen] = useState(false);
  const [openChallenge, setOpenChallenge] = useState<Challenge | null>(null);

  // Re-checked on focus so coming back from the challenge screen updates
  // the button (sent, accepted, called off).
  useFocusEffect(
    useCallback(() => {
      let mounted = true;
      if (currentUser.id && id && currentUser.id !== id) {
        void fetchOpenChallengeWith(currentUser.id, id).then((row) => {
          if (mounted) setOpenChallenge(row);
        });
      }
      return () => {
        mounted = false;
      };
    }, [currentUser.id, id]),
  );
  const [showSafetyControls, setShowSafetyControls] = useState(false);
  const [selectedResult, setSelectedResult] = useState<{
    match: FeedItem["match"];
    sport: FeedItem["sport"];
    courtName?: string;
  } | null>(null);

  useEffect(() => {
    let mounted = true;
    if (currentUser.id && currentUser.id !== id) {
      void safetyControlsAvailable().then((available) => {
        if (mounted) setShowSafetyControls(available);
      });
    } else {
      setShowSafetyControls(false);
    }
    return () => { mounted = false; };
  }, [currentUser.id, id]);

  useEffect(() => {
    let mounted = true;
    (async () => {
      setLoading(true);
      setActiveTab("versus");
      setPlayerRank(null);
      setCourtRank(null);
      const [p, activityItems, shared, activityByDay] = await Promise.all([
        fetchProfile(id),
        fetchPlayerActivity(id, 20),
        currentUser.id && currentUser.id !== id
          ? fetchHeadToHead(currentUser.id, id)
          : Promise.resolve([] as HeadToHeadGame[]),
        fetchPlayerActivityByWeekday(id),
      ]);
      if (!mounted) return;
      const cachedCourt = p?.courtId ? courts.find((court) => court.id === p.courtId) : null;
      const resolvedCourt = p?.courtId && !cachedCourt ? await fetchCourtById(p.courtId) : cachedCourt;
      if (!mounted) return;
      setPlayer(p);
      setPlayerCourt(resolvedCourt ?? null);
      // A profile tells a "visits + games" story, not raw system events.
      setActivity(pairVisits(activityItems));
      setSharedGames(shared);
      setWeekdayActivity(activityByDay);
      setLoading(false);
      const rankingSport = p?.sport ?? resolvedCourt?.sport ?? null;
      if (rankingSport) {
        void fetchLeaderboard("GLOBAL", null, rankingSport).then((rankedPlayers) => {
          if (!mounted) return;
          const rankIndex = rankedPlayers.findIndex((rankedPlayer) => rankedPlayer.id === id);
          setPlayerRank(rankIndex >= 0 ? rankIndex + 1 : null);
        });
      }
      if (rankingSport && p?.courtId) {
        void fetchLeaderboard("LOCAL", p.courtId, rankingSport).then((rankedPlayers) => {
          if (!mounted) return;
          const rankIndex = rankedPlayers.findIndex((rankedPlayer) => rankedPlayer.id === id);
          setCourtRank(rankIndex >= 0 ? rankIndex + 1 : null);
        });
      }
    })();
    return () => { mounted = false; };
  }, [id, currentUser.id, courts]);

  if (loading) {
    return (
      <View style={[styles.container, { paddingTop: topPad + 20, alignItems: "center" }]}>
        <Text style={styles.notFound}>LOADING…</Text>
      </View>
    );
  }

  if (!player) {
    return (
      <View style={[styles.container, { paddingTop: topPad + 20 }]}>
        <Text style={styles.notFound}>PLAYER NOT FOUND</Text>
      </View>
    );
  }

  const isFriendStatus = isFriend(player.id);
  // request_friend creates a *pending* row; showing "ADD FRIEND" again after a
  // successful request is what made this button read as broken.
  const isRequestPending = isFriendPending(player.id);
  const isIncomingRequest = incomingFriendRequests.some((requester) => requester.id === player.id);
  const total = player.wins + player.losses;
  const winRate = total > 0 ? Math.round((player.wins / total) * 100) : 0;
  const h2h = summarizeHeadToHead(sharedGames);
  const courtName = playerCourt?.shortName || playerCourt?.name || null;
  const sportName =
    player.sport === "BASKETBALL" ? "Basketball" : player.sport === "PICKLEBALL" ? "Pickleball" : null;
  const subline = [
    courtName ? (courtRank ? `#${courtRank} at ${courtName}` : courtName) : "No local court",
    sportName,
  ]
    .filter(Boolean)
    .join(" · ");

  const handleToggleFriend = () => {
    if (isIncomingRequest) {
      void acceptFriendRequest(player.id);
      return;
    }
    if (isFriendStatus) {
      // Icon-only button now, so confirm before an accidental unfriend.
      Alert.alert(`Remove ${player.name} as a friend?`, undefined, [
        { text: "Cancel", style: "cancel" },
        { text: "Remove", style: "destructive", onPress: () => removeFriend(player.id) },
      ]);
      return;
    }
    // A pending request is withdrawn through the same remove_friendship RPC.
    if (isRequestPending) removeFriend(player.id);
    else addFriend(player.id);
  };

  const handleChallenge = () => {
    if (openChallenge) {
      router.push(`/challenge/${openChallenge.id}`);
      return;
    }
    if (!isFriendStatus) {
      const first = player.name.split(" ")[0];
      Alert.alert(
        "Challenges are between friends",
        isRequestPending
          ? `Your friend request to ${first} is pending. You can challenge them once they accept.`
          : `Add ${first} as a friend first. Once they accept, you can challenge them.`,
        isRequestPending || isIncomingRequest
          ? [{ text: "OK" }]
          : [
              { text: "Not now", style: "cancel" },
              { text: "Add friend", onPress: () => addFriend(player.id) },
            ],
      );
      return;
    }
    setChallengeOpen(true);
  };

  const challengeCourts = [localCourt, playerCourt]
    .filter((court): court is Court => Boolean(court))
    .filter((court, index, list) => list.findIndex((c) => c.id === court.id) === index)
    .map((court) => ({ id: court.id, name: court.shortName || court.name }));

  const submitReport = async (reason: ReportReason) => {
    const ok = await reportUser(player.id, reason);
    Alert.alert(
      ok ? "Report received" : "Report not sent",
      ok ? "Thanks. LocalCheck will review it." : "Please try again."
    );
  };

  const handleReport = () => {
    Alert.alert(`Report ${player.name}?`, "Choose the closest reason.", [
      { text: "Spam", onPress: () => void submitReport("spam") },
      { text: "Harassment", onPress: () => void submitReport("harassment") },
      { text: "Impersonation", onPress: () => void submitReport("impersonation") },
      { text: "Unsafe behavior", onPress: () => void submitReport("unsafe_behavior") },
      { text: "Cancel", style: "cancel" },
    ]);
  };

  const handleBlock = () => {
    Alert.alert(
      `Block ${player.name}?`,
      "You will no longer see each other's profiles, activity, check-ins, or run invites.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Block",
          style: "destructive",
          onPress: async () => {
            const ok = await blockUser(player.id);
            if (ok) router.canGoBack() ? router.back() : router.replace("/(tabs)");
            else Alert.alert("Could not block player", "Please try again.");
          },
        },
      ]
    );
  };

  return (
    <View style={styles.container}>
      <DetailHeader
        onBack={() => router.canGoBack() ? router.back() : router.replace("/(tabs)")}
        title="PROFILE"
      />

      <ProfileHero
        compact
        courtLabel={playerCourt?.shortName || playerCourt?.name || "No local court"}
        elo={player.elo}
        friend={isFriendStatus}
        initials={player.avatar}
        name={player.name}
        onOpenQr={() => setQrVisible(true)}
        playerId={player.id}
        subline={subline}
        username={player.username}
      />
      <ProfileStats compact metrics={[
        { value: `${player.wins}–${player.losses}`, label: "RECORD" },
        { value: `${winRate}%`, label: "WIN RATE" },
        { value: total, label: "GAMES" },
        { value: player.checkIns, label: "CHECK-INS" },
      ]} />

      <View accessibilityRole="tablist" style={styles.tabs}>
        <ProfileTab label="HEAD TO HEAD" active={activeTab === "versus"} onPress={() => setActiveTab("versus")} />
        <ProfileTab label="ACTIVITY" active={activeTab === "activity"} onPress={() => setActiveTab("activity")} />
        <ProfileTab label="DETAILS" active={activeTab === "details"} onPress={() => setActiveTab("details")} />
      </View>

      <ScrollView
        style={styles.scroll}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 32 }}
      >
        {activeTab === "versus" ? (
          <>
            <HeadToHeadSummary
              me={{ id: currentUser.id, name: currentUser.name, initials: currentUser.avatar }}
              summary={h2h}
              them={{ id: player.id, name: player.name, initials: player.avatar }}
            />
            <View style={styles.gamesTogether}>
              <View style={styles.gamesHeader}>
                <Text style={styles.gamesTitle}>GAMES TOGETHER</Text>
                {sharedGames.length > 0 ? <Text style={styles.gamesHint}>Your result</Text> : null}
              </View>
              {sharedGames.length > 0 ? (
                sharedGames.slice(0, 10).map((game) => (
                  <HeadToHeadGameRow
                    game={game}
                    key={game.id}
                    onPress={() => router.push(`/match/${game.id}`)}
                  />
                ))
              ) : (
                <Text style={styles.gamesEmpty}>
                  No games against {player.name.split(" ")[0]} yet. Log one after you play.
                </Text>
              )}
            </View>
          </>
        ) : activeTab === "activity" ? (
          <View style={styles.activityContent}>
            {activity.length > 0 ? (
              activity.map((item, index) => (
                <ActivityRow
                  isFirst={index === 0}
                  isLast={index === activity.length - 1}
                  item={item}
                  key={item.id}
                  quietRail={item.type === "checkin" || item.type === "checkout"}
                  onActorPress={
                    item.playerId ? () => router.push(`/player/${item.playerId}`) : undefined
                  }
                  onPress={
                    item.type === "game_result" && item.match
                      ? () => setSelectedResult({ match: item.match!, sport: item.sport, courtName: item.courtName })
                      : undefined
                  }
                />
              ))
            ) : (
              <EmptyProfileState title="NO ACTIVITY YET" body="Games and court activity will appear here." />
            )}
          </View>
        ) : (
          <View style={styles.detailsContent}>
            <View style={styles.detailGroup}>
              <View style={styles.detailGroupHeading}>
                <Text style={styles.detailGroupTitle}>PLAYER DETAILS</Text>
              </View>
              <DetailRow icon="calendar" label="MEMBER SINCE" value={shortDate(player.memberSince)} />
              <DetailRow
                icon="map-pin"
                label="LOCAL COURT"
                onPress={playerCourt ? () => router.push(`/court/${playerCourt.id}`) : undefined}
                value={playerCourt?.shortName || playerCourt?.name || "NOT SET"}
              />
              <DetailRow icon="award" label="GLOBAL RANK" value={playerRank ? `#${playerRank}` : "UNRANKED"} />
            </View>
            <ActivityHeatmap counts={weekdayActivity} />
            {showSafetyControls ? (
              <View style={styles.safetySection}>
                <Text style={styles.detailGroupTitle}>SAFETY</Text>
                <View style={styles.safetyRow}>
                  <Pressable accessibilityLabel={`Report ${player.name}`} accessibilityRole="button" onPress={handleReport} style={({ pressed }) => [styles.safetyButton, pressed && styles.safetyButtonPressed]}>
                    <Feather color={Colors.textSecondary} name="flag" size={14} />
                    <Text style={styles.safetyText}>REPORT PLAYER</Text>
                  </Pressable>
                  <Pressable accessibilityLabel={`Block ${player.name}`} accessibilityRole="button" onPress={handleBlock} style={({ pressed }) => [styles.safetyButton, pressed && styles.safetyButtonPressed]}>
                    <Feather color={Colors.loss} name="slash" size={14} />
                    <Text style={[styles.safetyText, styles.safetyDanger]}>BLOCK PLAYER</Text>
                  </Pressable>
                </View>
              </View>
            ) : null}
          </View>
        )}

      </ScrollView>
      <StickyActionBar
        bottomInset={bottom}
        leading={{
          accessibilityLabel: isFriendStatus
            ? "Remove friend"
            : isIncomingRequest
              ? "Accept friend request"
              : isRequestPending
                ? "Cancel friend request"
                : "Add friend",
          icon: isFriendStatus
            ? "user-minus"
            : isIncomingRequest
              ? "user-check"
              : isRequestPending
                ? "user-x"
                : "user-plus",
          onPress: handleToggleFriend,
        }}
        secondary={{
          label: "LOG GAME",
          onPress: () => router.push(`/(tabs)/compete?tab=log&opponentId=${player.id}`),
        }}
        primary={{
          label: openChallenge ? "VIEW CHALLENGE" : "CHALLENGE",
          tone: "light",
          onPress: handleChallenge,
        }}
      />
      {challengeOpen ? (
        <ChallengeSheet
          courts={challengeCourts}
          onClose={() => setChallengeOpen(false)}
          onSent={(challengeId) => {
            setChallengeOpen(false);
            router.push(`/challenge/${challengeId}`);
          }}
          opponent={{ id: player.id, name: player.name }}
          visible={challengeOpen}
        />
      ) : null}
      <PlayerQrModal
        onClose={() => setQrVisible(false)}
        playerId={player.id}
        playerName={player.name}
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

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  scroll: { flex: 1 },
  pressed: { opacity: 0.68 },
  tabs: {
    minHeight: 48,
    flexDirection: "row",
    backgroundColor: Colors.surfaceDark,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.border,
  },
  profileTab: {
    flex: 1,
    minHeight: 48,
    alignItems: "center",
    justifyContent: "center",
    borderBottomWidth: 2,
    borderBottomColor: Colors.surfaceDark,
  },
  profileTabActive: { borderBottomColor: Colors.accent },
  profileTabText: {
    fontFamily: Typography.bodyBold,
    fontSize: 9,
    color: Colors.muted,
    letterSpacing: 1.6,
  },
  profileTabTextActive: { color: Colors.text },
  activityContent: { paddingHorizontal: Layout.screenGutter },
  detailsContent: { padding: Layout.screenGutter, gap: Space.lg },
  detailGroup: {
    overflow: "hidden",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.borderLight,
    borderRadius: Radius.lg,
    backgroundColor: Colors.surface,
  },
  detailGroupTitle: {
    ...TextStyles.label,
    color: Colors.text,
    letterSpacing: 1.2,
  },
  detailGroupHeading: { minHeight: 52, paddingHorizontal: Space.lg, justifyContent: "center", backgroundColor: Colors.surfaceHigh },
  detailRow: {
    minHeight: 62,
    paddingHorizontal: Space.lg,
    flexDirection: "row",
    alignItems: "center",
    gap: Space.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: Colors.border,
  },
  detailIcon: {
    width: 30,
    height: 30,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: Radius.md,
    backgroundColor: Colors.surfaceHigh,
  },
  detailCopy: { flex: 1, minWidth: 0 },
  detailLabel: {
    ...TextStyles.labelSmall,
    color: Colors.muted,
    letterSpacing: 0.6,
  },
  detailValue: {
    marginTop: 3,
    ...TextStyles.listName,
    color: Colors.text,
  },
  heatmapHeader: {
    minHeight: 48,
    paddingHorizontal: Space.lg,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  heatmapPeriod: {
    ...TextStyles.labelSmall,
    color: Colors.muted,
    letterSpacing: 0.4,
  },
  heatmap: {
    paddingHorizontal: Space.lg,
    paddingBottom: Space.lg,
    flexDirection: "row",
    gap: Space.sm,
  },
  heatColumn: { flex: 1, alignItems: "center", gap: 5 },
  heatCell: { width: "100%", maxWidth: 34, height: 34, borderRadius: Radius.md },
  heatLevel0: { backgroundColor: Colors.surfaceHigh },
  heatLevel1: { backgroundColor: Colors.liveQuiet, borderWidth: 1, borderColor: Colors.accentBorder },
  heatLevel2: { backgroundColor: Colors.accentDim, borderWidth: 1, borderColor: Colors.accentBorderStrong },
  heatLevel3: { backgroundColor: Colors.accent },
  heatDay: { ...TextStyles.labelSmall, color: Colors.textSecondary },
  heatCount: { ...TextStyles.caption, color: Colors.muted },
  emptyState: { paddingVertical: Space.xxxl, alignItems: "center" },
  emptyTitle: {
    marginTop: Space.md,
    fontFamily: Typography.bodyBold,
    fontSize: 11,
    color: Colors.text,
    letterSpacing: 1.4,
  },
  emptyBody: {
    maxWidth: 260,
    marginTop: Space.sm,
    fontFamily: Typography.body,
    fontSize: 11,
    lineHeight: 17,
    color: Colors.textSecondary,
    textAlign: "center",
  },

  notFound: {
    fontFamily: Typography.heading,
    fontSize: 18,
    color: Colors.muted,
    textAlign: "center",
    padding: 40,
  },
  safetySection: {
    padding: Space.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.borderLight,
    borderRadius: Radius.lg,
    backgroundColor: Colors.surface,
  },
  safetyIntro: {
    fontFamily: Typography.bodyBold,
    fontSize: 9,
    color: Colors.muted,
    letterSpacing: 1.5,
    marginBottom: 8,
  },
  safetyRow: { flexDirection: "row", gap: 12 },
  safetyButton: {
    flex: 1,
    minHeight: 44,
    marginTop: Space.md,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: Space.sm,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.borderLight,
    borderRadius: Radius.md,
  },
  safetyButtonPressed: { opacity: 0.68 },
  safetyText: {
    fontFamily: Typography.bodyBold,
    fontSize: 10,
    color: Colors.textSecondary,
    letterSpacing: 1.2,
  },
  safetyDanger: { color: Colors.loss },

  gamesTogether: { paddingHorizontal: Layout.screenGutter, paddingTop: Space.xl },
  gamesHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingBottom: Space.sm,
  },
  gamesTitle: {
    fontFamily: Typography.bodyBold,
    fontSize: 12,
    letterSpacing: 2.2,
    color: Colors.text,
  },
  gamesHint: { ...TextStyles.metadata, color: Colors.muted },
  gamesEmpty: { ...TextStyles.metadata, paddingVertical: Space.lg, color: Colors.textSecondary },
});
