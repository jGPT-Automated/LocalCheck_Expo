import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useEffect, useState } from "react";
import {
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { BrutalistButton } from "@/components/BrutalistButton";
import { PlayerAvatar } from "@/components/PlayerAvatar";
import { Colors } from "@/constants/colors";
import {
  getTierColor,
  MatchResult,
  Player,
} from "@/constants/data";
import { Typography } from "@/constants/typography";
import { useApp } from "@/context/AppContext";
import { fetchGamesByPlayer, fetchHeadToHeadGames } from "@/services/gameService";
import { fetchProfile } from "@/services/profileService";

/** Deterministic head-to-head stats from persisted games both users played in. */
function getHeadToHeadStats(sharedMatches: MatchResult[]) {
  const wins = sharedMatches.filter((m) => m.result === "WIN").length;
  const losses = sharedMatches.filter((m) => m.result === "LOSS").length;
  const total = wins + losses;
  const winRate = total > 0 ? Math.round((wins / total) * 100) : 0;
  return { wins, losses, total, winRate, matches: sharedMatches };
}

function UpgradeModal({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.modalOverlay} onPress={onClose}>
        <View style={styles.upgradeCard}>
          <View style={styles.upgradeHeader}>
            <Ionicons name="lock-closed" size={22} color={Colors.accent} />
            <Text style={styles.upgradeTitle}>LOCALPLUS REQUIRED</Text>
          </View>
          <Text style={styles.upgradeBody}>
            Upgrade to LocalPlus to see your full head-to-head stats, matchup history, and
            filtered games against this player.
          </Text>
          <View style={styles.upgradeFeatures}>
            <View style={styles.featureRow}>
              <Ionicons name="checkmark" size={14} color={Colors.win} />
              <Text style={styles.featureText}>Wins / Losses / Win Rate</Text>
            </View>
            <View style={styles.featureRow}>
              <Ionicons name="checkmark" size={14} color={Colors.win} />
              <Text style={styles.featureText}>Games where you both played</Text>
            </View>
            <View style={styles.featureRow}>
              <Ionicons name="checkmark" size={14} color={Colors.win} />
              <Text style={styles.featureText}>ELO tracking per matchup</Text>
            </View>
          </View>
          <Pressable style={styles.upgradeBtn} onPress={onClose}>
            <Text style={styles.upgradeBtnText}>UPGRADE — $4.99/MO</Text>
          </Pressable>
          <Pressable onPress={onClose} hitSlop={12}>
            <Text style={styles.upgradeSkip}>Not now</Text>
          </Pressable>
        </View>
      </Pressable>
    </Modal>
  );
}

export default function PlayerProfileScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { currentUser, isLocalPlus, isFriend, addFriend, removeFriend } = useApp();
  const { top, bottom } = useSafeAreaInsets();
  const topPad = Platform.OS === "web" ? 67 : top;

  const [showUpgrade, setShowUpgrade] = useState(false);
  const [player, setPlayer] = useState<Player | null>(null);
  const [playerMatches, setPlayerMatches] = useState<MatchResult[]>([]);
  const [sharedMatches, setSharedMatches] = useState<MatchResult[]>([]);
  const [loading, setLoading] = useState(true);

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
  const tierColor = getTierColor(player.tier);
  const total = player.wins + player.losses;
  const winRate = total > 0 ? Math.round((player.wins / total) * 100) : 0;

  // Head-to-head stats from persisted shared games
  const h2h = getHeadToHeadStats(sharedMatches);

  const handleToggleFriend = () => {
    if (isFriendStatus) {
      removeFriend(player.id);
    } else {
      addFriend(player.id);
    }
  };

  const handleViewH2H = () => {
    if (!isLocalPlus) {
      setShowUpgrade(true);
    }
  };

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: topPad + 12 }]}>
        <Pressable onPress={() => router.back()} hitSlop={12}>
          <Ionicons name="arrow-back" size={22} color={Colors.text} />
        </Pressable>
        <Text style={styles.headerTitle}>PROFILE</Text>
        <Pressable onPress={handleToggleFriend} hitSlop={12}>
          <Ionicons
            name={isFriendStatus ? "person-remove" : "person-add"}
            size={20}
            color={isFriendStatus ? Colors.loss : Colors.win}
          />
        </Pressable>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: Platform.OS === "web" ? 84 : bottom + 100 }}
      >
        {/* Profile Hero */}
        <View style={styles.hero}>
          <PlayerAvatar initials={player.avatar} size={72} />
          <Text style={styles.playerName}>{player.name.toUpperCase()}</Text>
          <View style={styles.tierPill}>
            <View style={[styles.tierDot, { backgroundColor: tierColor }]} />
            <Text style={[styles.tierLabel, { color: tierColor }]}>{player.tier}</Text>
          </View>
          <Text style={styles.eloText}>{player.elo} ELO</Text>
          {isFriendStatus && (
            <View style={styles.friendBadge}>
              <Ionicons name="people" size={12} color={Colors.win} />
              <Text style={styles.friendBadgeText}>FRIEND</Text>
            </View>
          )}
        </View>

        {/* Stats Grid */}
        <View style={styles.statsGrid}>
          <View style={styles.statCell}>
            <Text style={[styles.statVal, { color: Colors.win }]}>{player.wins}</Text>
            <Text style={styles.statLbl}>WINS</Text>
          </View>
          <View style={[styles.statCell, styles.statCellBorder]}>
            <Text style={[styles.statVal, { color: Colors.loss }]}>{player.losses}</Text>
            <Text style={styles.statLbl}>LOSSES</Text>
          </View>
          <View style={styles.statCell}>
            <Text style={styles.statVal}>{winRate}%</Text>
            <Text style={styles.statLbl}>WIN RATE</Text>
          </View>
        </View>

        <View style={styles.statsGrid}>
          <View style={styles.statCell}>
            <Text style={styles.statVal}>{player.checkIns}</Text>
            <Text style={styles.statLbl}>CHECK-INS</Text>
          </View>
          <View style={[styles.statCell, styles.statCellBorder]}>
            <Text style={styles.statVal}>{total}</Text>
            <Text style={styles.statLbl}>GAMES</Text>
          </View>
          <View style={styles.statCell}>
            <Text style={[styles.statVal, { color: tierColor }]}>{player.tier}</Text>
            <Text style={styles.statLbl}>TIER</Text>
          </View>
        </View>

        {/* Head-to-Head Section */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>HEAD TO HEAD</Text>
            {!isLocalPlus && (
              <View style={styles.lockBadge}>
                <Ionicons name="lock-closed" size={10} color={Colors.muted} />
              </View>
            )}
          </View>

          {isLocalPlus ? (
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
          ) : (
            <Pressable style={styles.h2hPaywall} onPress={handleViewH2H}>
              <Ionicons name="lock-closed" size={18} color={Colors.muted} />
              <View style={styles.h2hPaywallText}>
                <Text style={styles.h2hPaywallTitle}>HEAD TO HEAD HIDDEN</Text>
                <Text style={styles.h2hPaywallSub}>
                  Upgrade to LocalPlus to see your matchup stats and shared game history
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={16} color={Colors.muted} />
            </Pressable>
          )}
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
              {isFriendStatus ? "REMOVE FRIEND" : "ADD FRIEND"}
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
      </ScrollView>

      <UpgradeModal visible={showUpgrade} onClose={() => setShowUpgrade(false)} />
    </View>
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
