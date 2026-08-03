import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useEffect, useState } from "react";
import {
  Alert,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { BrutalistButton } from "@/components/BrutalistButton";
import { DetailHeader, HeaderIconButton } from "@/components/DetailHeader";
import { ProfileScaffold } from "@/components/profile/ProfileScaffold";
import { Colors } from "@/constants/colors";
import {
  MatchResult,
  Player,
} from "@/constants/data";
import { Typography } from "@/constants/typography";
import { useApp } from "@/context/AppContext";
import { fetchGamesByPlayer, fetchHeadToHeadGames } from "@/services/gameService";
import { fetchProfile } from "@/services/profileService";
import { blockUser, ReportReason, reportUser, safetyControlsAvailable } from "@/services/safetyService";

/** Deterministic head-to-head stats from persisted games both users played in. */
function getHeadToHeadStats(sharedMatches: MatchResult[]) {
  const wins = sharedMatches.filter((m) => m.result === "WIN").length;
  const losses = sharedMatches.filter((m) => m.result === "LOSS").length;
  const total = wins + losses;
  const winRate = total > 0 ? Math.round((wins / total) * 100) : 0;
  return { wins, losses, total, winRate, matches: sharedMatches };
}

export default function PlayerProfileScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { currentUser, isFriend, isFriendPending, incomingFriendRequests, acceptFriendRequest, addFriend, removeFriend } =
    useApp();
  const { bottom } = useSafeAreaInsets();

  const [player, setPlayer] = useState<Player | null>(null);
  const [playerMatches, setPlayerMatches] = useState<MatchResult[]>([]);
  const [sharedMatches, setSharedMatches] = useState<MatchResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [showSafetyControls, setShowSafetyControls] = useState(false);

  useEffect(() => {
    let mounted = true;
    void safetyControlsAvailable().then((available) => {
      if (mounted) setShowSafetyControls(available);
    });
    return () => { mounted = false; };
  }, []);

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
      setPlayer(p);
      setPlayerMatches(m);
      setSharedMatches(shared);
      setLoading(false);
    })();
    return () => { mounted = false; };
  }, [id, currentUser.id]);

  if (loading) {
    return (
      <View style={styles.container}>
        <DetailHeader title="PROFILE" onBack={() => router.back()} />
        <Text style={styles.notFound}>LOADING…</Text>
      </View>
    );
  }

  if (!player) {
    return (
      <View style={styles.container}>
        <DetailHeader title="PROFILE" onBack={() => router.back()} />
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
            if (ok) router.back();
            else Alert.alert("Could not block player", "Please try again.");
          },
        },
      ]
    );
  };

  return (
    <ProfileScaffold
      header={(
        <DetailHeader
          title={player.name}
          subtitle={isFriendStatus ? "FRIEND" : isRequestPending ? "REQUESTED" : undefined}
          onBack={() => router.back()}
          right={(
            <HeaderIconButton
              icon={isFriendStatus ? "user-minus" : "user-plus"}
              label={isFriendStatus ? `Remove ${player.name} as a friend` : `Add ${player.name} as a friend`}
              tone={isFriendStatus ? "danger" : "accent"}
              onPress={handleToggleFriend}
            />
          )}
        />
      )}
      player={player}
      supportingText={isFriendStatus ? "FRIEND" : player.sport}
      stats={[
        { key: "wins", value: player.wins, label: "WINS" },
        { key: "losses", value: player.losses, label: "LOSSES" },
        { key: "checkins", value: player.checkIns, label: "CHECK-INS" },
        { key: "games", value: total, label: "GAMES" },
      ]}
      presentation="detail"
      bottomInset={bottom}
    >

        {/* Head-to-Head Section */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>HEAD TO HEAD</Text>
          </View>

          <>
              <View style={styles.h2hGrid}>
                <View style={styles.h2hCell}>
                  <Text style={[styles.h2hVal, { color: Colors.win }]}>{h2h.wins}</Text>
                  <Text style={styles.h2hLbl}>WINS</Text>
                </View>
                <View style={styles.h2hCell}>
                  <Text style={[styles.h2hVal, { color: Colors.loss }]}>{h2h.losses}</Text>
                  <Text style={styles.h2hLbl}>LOSSES</Text>
                </View>
                <View style={styles.h2hCell}>
                  <Text style={styles.h2hVal}>{h2h.winRate}%</Text>
                  <Text style={styles.h2hLbl}>WIN RATE</Text>
                </View>
                <View style={styles.h2hCell}>
                  <Text style={styles.h2hVal}>{h2h.total}</Text>
                  <Text style={styles.h2hLbl}>MATCHED</Text>
                </View>
              </View>

              {h2h.matches.length === 0 && (
                <Text style={styles.h2hEmpty}>
                  No logged games between you and {player.name.toUpperCase()} yet.
                </Text>
              )}

              {h2h.matches.length > 0 && (
                <>
                  <View style={styles.divider} />
                  <Text style={styles.subSectionTitle}>GAMES TOGETHER</Text>
                  {h2h.matches.slice(0, 5).map((m) => (
                    <View key={m.id} style={styles.h2hMatchRow}>
                      <View
                        style={[
                          styles.h2hMatchBar,
                          { backgroundColor: m.result === "WIN" ? Colors.win : Colors.loss },
                        ]}
                      />
                      <View style={styles.h2hMatchContent}>
                        <Text style={styles.h2hMatchCourt}>{m.courtName}</Text>
                        <Text style={styles.h2hMatchMeta}>
                          {m.date} · {m.sport}
                        </Text>
                      </View>
                      <View style={styles.h2hMatchResult}>
                        <Text
                          style={[
                            styles.h2hMatchResultText,
                            { color: m.result === "WIN" ? Colors.win : Colors.loss },
                          ]}
                        >
                          {m.result}
                        </Text>
                        <Text style={styles.h2hMatchScore}>
                          {m.teamScore} — {m.opposingScore}
                        </Text>
                      </View>
                    </View>
                  ))}
                </>
              )}
          </>
        </View>

        {/* Action Buttons */}
        <View style={styles.actionRow}>
          <Pressable
            style={[styles.actionBtn, isFriendStatus && styles.actionBtnDanger]}
            onPress={handleToggleFriend}
          >
            <Ionicons
              name={isFriendStatus ? "person-remove" : "person-add"}
              size={16}
              color={isFriendStatus ? Colors.loss : Colors.text}
            />
            <Text style={[styles.actionBtnText, isFriendStatus && styles.actionBtnTextDanger]}>
              {isFriendStatus
                ? "REMOVE FRIEND"
                : isIncomingRequest
                  ? "ACCEPT REQUEST"
                : isRequestPending
                  ? "REQUESTED"
                  : "ADD FRIEND"}
            </Text>
          </Pressable>
          <BrutalistButton
            label="LOG GAME"
            variant="accent"
            onPress={() =>
              router.push(`/(tabs)/compete?tab=log&opponentId=${player.id}`)
            }
            style={styles.logGameBtn}
            testID="log-game-btn"
          />
        </View>
        {showSafetyControls && <View style={styles.safetyRow}>
          <Pressable
            style={({ pressed }) => [styles.safetyButton, pressed && styles.pressed]}
            onPress={handleReport}
            accessibilityRole="button"
            accessibilityLabel={`Report ${player.name}`}
          >
            <Ionicons name="flag-outline" size={15} color={Colors.muted} />
            <Text style={styles.safetyText}>REPORT</Text>
          </Pressable>
          <Pressable
            style={({ pressed }) => [styles.safetyButton, pressed && styles.pressed]}
            onPress={handleBlock}
            accessibilityRole="button"
            accessibilityLabel={`Block ${player.name}`}
          >
            <Ionicons name="ban-outline" size={15} color={Colors.loss} />
            <Text style={[styles.safetyText, { color: Colors.loss }]}>BLOCK</Text>
          </Pressable>
        </View>}
    </ProfileScaffold>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },

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
    alignItems: "center",
    paddingVertical: 28,
    backgroundColor: Colors.black,
    borderBottomWidth: 0.5,
    borderBottomColor: Colors.border,
  },
  playerName: {
    fontFamily: Typography.heading,
    fontSize: 24,
    color: Colors.white,
    letterSpacing: 1,
    marginTop: 14,
  },
  tierPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderColor: Colors.border,
    marginTop: 8,
  },
  tierDot: { width: 7, height: 7, borderRadius: 3.5 },
  tierLabel: { fontFamily: Typography.heading, fontSize: 12, letterSpacing: 2 },
  eloText: {
    fontFamily: Typography.heading,
    fontSize: 16,
    color: Colors.muted,
    marginTop: 6,
    letterSpacing: 0.5,
  },
  friendBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginTop: 10,
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
  safetyRow: {
    flexDirection: "row",
    gap: 10,
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  safetyButton: {
    minHeight: 44,
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 7,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.surface,
  },
  safetyText: {
    fontFamily: Typography.bodyBold,
    fontSize: 10,
    color: Colors.muted,
    letterSpacing: 1.2,
  },
  pressed: { opacity: 0.65 },

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
