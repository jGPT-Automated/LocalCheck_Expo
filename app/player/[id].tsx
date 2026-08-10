import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useEffect, useState } from "react";
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

import { DetailHeader } from "@/components/ui/DetailHeader";
import { PlayerQrModal } from "@/components/ui/PlayerQrModal";
import { ProfileHero } from "@/components/ui/ProfileHero";
import { ProfileStats } from "@/components/ui/ProfileStats";
import { StickyActionBar } from "@/components/ui/StickyActionBar";
import { HeadToHeadSummary } from "@/components/ui/HeadToHeadSummary";
import { Colors } from "@/constants/colors";
import {
  Court,
  MatchResult,
  Player,
} from "@/constants/data";
import { Typography } from "@/constants/typography";
import { useApp } from "@/context/AppContext";
import { fetchGamesByPlayer, fetchHeadToHeadGames } from "@/services/gameService";
import { fetchCourtById } from "@/services/courtService";
import { fetchProfile } from "@/services/profileService";
import {
  blockUser,
  type ReportReason,
  reportUser,
  safetyControlsAvailable,
} from "@/services/safetyService";

/** Deterministic head-to-head stats from persisted games both users played in. */
function getHeadToHeadStats(sharedMatches: MatchResult[]) {
  const wins = sharedMatches.filter((m) => m.result === "WIN").length;
  const losses = sharedMatches.filter((m) => m.result === "LOSS").length;
  const total = wins + losses;
  const winRate = total > 0 ? Math.round((wins / total) * 100) : 0;
  return { wins, losses, total, winRate, matches: sharedMatches };
}

function shortDate(value: string): string {
  return new Date(value).toLocaleDateString("en-US", {
    month: "short",
    year: "numeric",
  }).toUpperCase();
}

export default function PlayerProfileScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { courts, currentUser, isFriend, isFriendPending, incomingFriendRequests, acceptFriendRequest, addFriend, removeFriend } =
    useApp();
  const { top, bottom } = useSafeAreaInsets();
  const topPad = Platform.OS === "web" ? 67 : top;

  const [player, setPlayer] = useState<Player | null>(null);
  const [playerCourt, setPlayerCourt] = useState<Court | null>(null);
  const [playerMatches, setPlayerMatches] = useState<MatchResult[]>([]);
  const [sharedMatches, setSharedMatches] = useState<MatchResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [qrVisible, setQrVisible] = useState(false);
  const [showSafetyControls, setShowSafetyControls] = useState(false);

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
      const [p, m, shared] = await Promise.all([
        fetchProfile(id),
        fetchGamesByPlayer(id),
        currentUser.id && currentUser.id !== id
          ? fetchHeadToHeadGames(currentUser.id, id)
          : Promise.resolve([] as MatchResult[]),
      ]);
      if (!mounted) return;
      const cachedCourt = p?.courtId ? courts.find((court) => court.id === p.courtId) : null;
      const resolvedCourt = p?.courtId && !cachedCourt ? await fetchCourtById(p.courtId) : cachedCourt;
      if (!mounted) return;
      setPlayer(p);
      setPlayerCourt(resolvedCourt ?? null);
      setPlayerMatches(m);
      setSharedMatches(shared);
      setLoading(false);
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
  // Head-to-head stats from persisted shared games
  const h2h = getHeadToHeadStats(sharedMatches);

  const handleToggleFriend = () => {
    if (isIncomingRequest) {
      void acceptFriendRequest(player.id);
      return;
    }
    // A pending request is withdrawn through the same remove_friendship RPC.
    if (isFriendStatus || isRequestPending) {
      removeFriend(player.id);
    } else {
      addFriend(player.id);
    }
  };

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

      <ScrollView
        style={styles.scroll}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 24 }}
      >
        <ProfileHero
          courtLabel={playerCourt?.shortName || playerCourt?.name || "No local court"}
          elo={player.elo}
          friend={isFriendStatus}
          initials={player.avatar}
          memberSince={shortDate(player.memberSince)}
          name={player.name}
          onOpenQr={() => setQrVisible(true)}
          playerId={player.id}
          username={player.username}
        />
        <ProfileStats metrics={[
          { value: player.wins, label: "WINS", tone: "win" },
          { value: player.losses, label: "LOSSES", tone: "loss" },
          { value: player.checkIns, label: "CHECK-INS" },
          { value: total, label: "GAMES" },
        ]} />

        <HeadToHeadSummary
          losses={h2h.losses}
          matched={h2h.total}
          opponentName={player.name}
          winRate={h2h.winRate}
          wins={h2h.wins}
        />

        {h2h.matches.length > 0 ? (
          <View style={styles.section}>
            <Text style={styles.subSectionTitle}>GAMES TOGETHER</Text>
            {h2h.matches.slice(0, 5).map((m) => (
              <View key={m.id} style={styles.h2hMatchRow}>
                <View style={[styles.h2hMatchBar, { backgroundColor: m.result === "WIN" ? Colors.win : Colors.loss }]} />
                <View style={styles.h2hMatchContent}>
                  <Text style={styles.h2hMatchCourt}>{m.courtName}</Text>
                  <Text style={styles.h2hMatchMeta}>{m.date} · {m.sport}</Text>
                </View>
                <View style={styles.h2hMatchResult}>
                  <Text style={[styles.h2hMatchResultText, { color: m.result === "WIN" ? Colors.win : Colors.loss }]}>{m.result}</Text>
                  <Text style={styles.h2hMatchScore}>{m.teamScore} — {m.opposingScore}</Text>
                </View>
              </View>
            ))}
          </View>
        ) : null}

        {showSafetyControls ? (
          <View style={styles.safetySection}>
            <Text style={styles.safetyIntro}>SAFETY</Text>
            <View style={styles.safetyRow}>
              <Pressable
                accessibilityLabel={`Report ${player.name}`}
                accessibilityRole="button"
                onPress={handleReport}
                style={({ pressed }) => [styles.safetyButton, pressed && styles.safetyButtonPressed]}
              >
                <Text style={styles.safetyText}>REPORT</Text>
              </Pressable>
              <Pressable
                accessibilityLabel={`Block ${player.name}`}
                accessibilityRole="button"
                onPress={handleBlock}
                style={({ pressed }) => [styles.safetyButton, pressed && styles.safetyButtonPressed]}
              >
                <Text style={[styles.safetyText, styles.safetyDanger]}>BLOCK</Text>
              </Pressable>
            </View>
          </View>
        ) : null}

      </ScrollView>
      <StickyActionBar
        bottomInset={bottom}
        primary={{
          label: "LOG GAME",
          icon: "edit-3",
          onPress: () => router.push(`/(tabs)/compete?tab=log&opponentId=${player.id}`),
        }}
        secondary={{
          label: isFriendStatus
            ? "REMOVE FRIEND"
            : isIncomingRequest
              ? "ACCEPT REQUEST"
              : isRequestPending
                ? "CANCEL REQUEST"
                : "ADD FRIEND",
          icon: isFriendStatus ? "user-minus" : "user-plus",
          onPress: handleToggleFriend,
        }}
      />
      <PlayerQrModal
        onClose={() => setQrVisible(false)}
        playerId={player.id}
        playerName={player.name}
        visible={qrVisible}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  scroll: { flex: 1 },

  // Header
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingBottom: 14,
    backgroundColor: Colors.surface,
    borderBottomWidth: 0.5,
    borderBottomColor: Colors.border,
  },
  headerTitle: {
    fontFamily: Typography.heading,
    fontSize: 14,
    color: Colors.text,
    letterSpacing: 3,
  },
  notFound: {
    fontFamily: Typography.heading,
    fontSize: 18,
    color: Colors.muted,
    textAlign: "center",
    padding: 40,
  },

  // Hero
  hero: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    paddingHorizontal: 20,
    paddingVertical: 22,
    backgroundColor: Colors.black,
    borderBottomWidth: 0.5,
    borderBottomColor: Colors.border,
  },
  avatarColumn: { alignItems: "center" },
  heroCopy: { flex: 1, minWidth: 0 },
  qrHint: { marginTop: 7, flexDirection: "row", alignItems: "center", gap: 4 },
  qrHintText: { fontFamily: Typography.bodyBold, fontSize: 7, color: Colors.accent, letterSpacing: 1 },
  playerName: {
    fontFamily: Typography.heading,
    fontSize: 24,
    color: Colors.white,
    letterSpacing: 1,
  },
  playerHandle: {
    marginTop: 3,
    fontFamily: Typography.bodyMedium,
    fontSize: 8,
    color: Colors.muted,
    letterSpacing: 1.2,
  },
  heroMeta: { marginTop: 8, flexDirection: "row", alignItems: "center", gap: 7 },
  tierPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderColor: Colors.border,
  },
  tierDot: { width: 7, height: 7, borderRadius: 3.5 },
  tierLabel: { fontFamily: Typography.heading, fontSize: 12, letterSpacing: 2 },
  friendBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: Colors.win,
  },
  friendBadgeText: {
    fontFamily: Typography.bodyBold,
    fontSize: 9,
    color: Colors.win,
    letterSpacing: 1.5,
  },

  // Stats
  statsGrid: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.surface,
  },
  statCell: { flex: 1, alignItems: "center", paddingVertical: 18 },
  statCellBorder: { borderLeftWidth: 1, borderRightWidth: 1, borderColor: Colors.border },
  statVal: {
    fontFamily: Typography.heading,
    fontSize: 26,
    color: Colors.text,
    letterSpacing: 0.5,
  },
  statLbl: {
    fontFamily: Typography.bodyMedium,
    fontSize: 9,
    color: Colors.muted,
    letterSpacing: 2,
    textTransform: "uppercase" as const,
    marginTop: 3,
  },

  // Section
  section: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 16,
    borderBottomWidth: 0.5,
    borderBottomColor: Colors.border,
  },
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 14,
  },
  sectionTitle: {
    fontFamily: Typography.heading,
    fontSize: 12,
    color: Colors.text,
    letterSpacing: 3,
    textTransform: "uppercase" as const,
  },
  lockBadge: {
    padding: 4,
    borderWidth: 0.5,
    borderColor: Colors.border,
  },
  divider: {
    height: 1,
    backgroundColor: Colors.border,
    marginVertical: 14,
  },
  subSectionTitle: {
    fontFamily: Typography.heading,
    fontSize: 10,
    color: Colors.muted,
    letterSpacing: 2,
    textTransform: "uppercase" as const,
    marginBottom: 10,
  },
  safetySection: {
    paddingHorizontal: 20,
    paddingVertical: 18,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: Colors.border,
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
    minHeight: 44,
    justifyContent: "center",
    paddingRight: 18,
  },
  safetyButtonPressed: { opacity: 0.68 },
  safetyText: {
    fontFamily: Typography.bodyBold,
    fontSize: 10,
    color: Colors.textSecondary,
    letterSpacing: 1.2,
  },
  safetyDanger: { color: Colors.loss },

  // H2H Grid
  h2hGrid: {
    flexDirection: "row",
    borderWidth: 0.5,
    borderColor: Colors.border,
  },
  h2hCell: {
    flex: 1,
    alignItems: "center",
    paddingVertical: 14,
    borderRightWidth: 0.5,
    borderColor: Colors.border,
  },
  h2hVal: {
    fontFamily: Typography.heading,
    fontSize: 22,
    color: Colors.text,
    letterSpacing: 0.5,
  },
  h2hLbl: {
    fontFamily: Typography.bodyMedium,
    fontSize: 8,
    color: Colors.muted,
    letterSpacing: 2,
    textTransform: "uppercase" as const,
    marginTop: 3,
  },

  h2hEmpty: {
    fontFamily: Typography.bodyMedium,
    fontSize: 11,
    color: Colors.muted,
    marginTop: 12,
    lineHeight: 16,
  },

  // H2H Paywall
  h2hPaywall: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 16,
    borderWidth: 0.5,
    borderColor: Colors.border,
    backgroundColor: Colors.surface,
  },
  h2hPaywallText: { flex: 1 },
  h2hPaywallTitle: {
    fontFamily: Typography.heading,
    fontSize: 12,
    color: Colors.text,
    letterSpacing: 1,
    marginBottom: 3,
  },
  h2hPaywallSub: {
    fontFamily: Typography.bodyMedium,
    fontSize: 11,
    color: Colors.muted,
    lineHeight: 16,
  },

  // H2H Match rows
  h2hMatchRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 10,
    borderBottomWidth: 0.5,
    borderBottomColor: Colors.border,
  },
  h2hMatchBar: { width: 2.5, height: 32, marginRight: 10, borderRadius: 1 },
  h2hMatchContent: { flex: 1 },
  h2hMatchCourt: {
    fontFamily: Typography.bodyBold,
    fontSize: 12,
    color: Colors.text,
    letterSpacing: 0.3,
  },
  h2hMatchMeta: {
    fontFamily: Typography.bodyMedium,
    fontSize: 10,
    color: Colors.muted,
    marginTop: 2,
  },
  h2hMatchResult: { alignItems: "flex-end" },
  h2hMatchResultText: {
    fontFamily: Typography.heading,
    fontSize: 12,
    letterSpacing: 1,
  },
  h2hMatchScore: {
    fontFamily: Typography.bodyMedium,
    fontSize: 10,
    color: Colors.muted,
    marginTop: 2,
  },

  // Action Buttons
  actionRow: {
    flexDirection: "row",
    gap: 12,
    paddingHorizontal: 20,
    paddingVertical: 20,
  },
  actionBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 14,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.surface,
  },
  logGameBtn: {
    flex: 1,
  },
  actionBtnDanger: {
    borderColor: Colors.loss,
  },
  actionBtnText: {
    fontFamily: Typography.heading,
    fontSize: 12,
    color: Colors.text,
    letterSpacing: 2,
  },
  actionBtnTextDanger: {
    color: Colors.loss,
  },

  // Upgrade Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.75)",
    alignItems: "center",
    justifyContent: "center",
    padding: 20,
  },
  upgradeCard: {
    width: "100%",
    maxWidth: 340,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 20,
    gap: 12,
    alignItems: "center",
  },
  upgradeHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 4,
  },
  upgradeTitle: {
    fontFamily: Typography.heading,
    fontSize: 14,
    color: Colors.accent,
    letterSpacing: 2,
  },
  upgradeBody: {
    fontFamily: Typography.bodyMedium,
    fontSize: 12,
    color: Colors.textSecondary,
    textAlign: "center",
    lineHeight: 18,
  },
  upgradeFeatures: {
    width: "100%",
    gap: 8,
    paddingVertical: 8,
  },
  featureRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  featureText: {
    fontFamily: Typography.bodyMedium,
    fontSize: 12,
    color: Colors.text,
  },
  upgradeBtn: {
    backgroundColor: Colors.accent,
    paddingHorizontal: 24,
    paddingVertical: 12,
    width: "100%",
    alignItems: "center",
    marginTop: 4,
  },
  upgradeBtnText: {
    fontFamily: Typography.heading,
    fontSize: 12,
    color: Colors.black,
    letterSpacing: 2,
  },
  upgradeSkip: {
    fontFamily: Typography.bodyMedium,
    fontSize: 12,
    color: Colors.muted,
    marginTop: 4,
  },
});
