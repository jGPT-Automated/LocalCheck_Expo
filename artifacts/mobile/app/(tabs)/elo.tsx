import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React, { useEffect, useRef, useState } from "react";
import {
  Animated,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { MatchRow } from "@/components/MatchRow";
import { PlayerAvatar } from "@/components/PlayerAvatar";
import { Colors } from "@/constants/colors";
import { getTierColor, getEloTier, MatchResult } from "@/constants/data";
import { Typography } from "@/constants/typography";
import { useApp } from "@/context/AppContext";
import { useAuth } from "@/context/AuthContext";

function daysSince(dateStr: string): number {
  const start = new Date(dateStr).getTime();
  return Math.max(0, Math.floor((Date.now() - start) / 86400000));
}

function formatJoinDate(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleDateString("en-US", { month: "short", year: "numeric" }).toUpperCase();
}

function MatchDetailModal({
  match,
  visible,
  onClose,
}: {
  match: MatchResult | null;
  visible: boolean;
  onClose: () => void;
}) {
  if (!match) return null;
  const isWin = match.result === "WIN";
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.modalOverlay} onPress={onClose}>
        <View style={styles.modalCard}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>MATCH DETAIL</Text>
            <Pressable onPress={onClose} hitSlop={12}>
              <Ionicons name="close" size={22} color={Colors.muted} />
            </Pressable>
          </View>
          <View style={[styles.modalResultBadge, { backgroundColor: isWin ? Colors.winDim : Colors.lossDim }]}>
            <Text style={[styles.modalResultText, { color: isWin ? Colors.win : Colors.loss }]}>
              {match.result}
            </Text>
          </View>

          <View style={styles.modalRow}>
            <Text style={styles.modalLabel}>Date</Text>
            <Text style={styles.modalValue}>{match.date}</Text>
          </View>
          <View style={styles.modalRow}>
            <Text style={styles.modalLabel}>Court</Text>
            <Text style={styles.modalValue}>{match.courtName}</Text>
          </View>
          <View style={styles.modalRow}>
            <Text style={styles.modalLabel}>Sport</Text>
            <Text style={styles.modalValue}>{match.sport}</Text>
          </View>
          <View style={styles.modalRow}>
            <Text style={styles.modalLabel}>Score</Text>
            <Text style={styles.modalValue}>
              {match.teamScore} — {match.opposingScore}
            </Text>
          </View>
          <View style={styles.modalRow}>
            <Text style={styles.modalLabel}>ELO Change</Text>
            <Text style={[styles.modalValue, { color: isWin ? Colors.win : Colors.loss }]}>
              {match.eloDelta > 0 ? `+${match.eloDelta}` : match.eloDelta}
            </Text>
          </View>

          <View style={styles.modalDivider} />
          <View style={styles.modalRow}>
            <Text style={styles.modalLabel}>Game Time</Text>
            <Text style={styles.modalValueMuted}>Not recorded</Text>
          </View>
          <View style={styles.modalRow}>
            <Text style={styles.modalLabel}>Weather</Text>
            <Text style={styles.modalValueMuted}>Not recorded</Text>
          </View>
          <View style={styles.modalRow}>
            <Text style={styles.modalLabel}>Opponent</Text>
            <Text style={styles.modalValueMuted}>Not recorded</Text>
          </View>
          <View style={styles.modalRow}>
            <Text style={styles.modalLabel}>Comments</Text>
            <Text style={styles.modalValueMuted}>No comments</Text>
          </View>

          <View style={styles.modalPaywallHint}>
            <Ionicons name="lock-closed" size={12} color={Colors.muted} />
            <Text style={styles.modalPaywallText}>PREMIUM: FULL MATCH HISTORY</Text>
          </View>
        </View>
      </Pressable>
    </Modal>
  );
}

export default function EloScreen() {
  const router = useRouter();
  const { currentUser, matches } = useApp();
  const { user, profile } = useAuth();
  const { top } = useSafeAreaInsets();
  const topPad = Platform.OS === "web" ? 67 : top;

  // Use real profile data when signed in, fall back to AppContext stub
  const displayName = profile?.display_name ?? currentUser.name;
  const elo = profile?.elo_rating ?? currentUser.elo;
  const wins = profile?.wins ?? currentUser.wins;
  const losses = profile?.losses ?? currentUser.losses;
  const memberSince = profile?.created_at ?? currentUser.memberSince;
  const tier = getEloTier(elo);

  const [displayElo, setDisplayElo] = useState(elo - 80);
  const [scrollY, setScrollY] = useState(0);
  const [selectedMatch, setSelectedMatch] = useState<MatchResult | null>(null);
  const [showDetail, setShowDetail] = useState(false);

  const barAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const target = elo;
    const start = target - 80;
    const duration = 900;
    const startTime = Date.now();
    const tick = () => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplayElo(Math.round(start + (target - start) * eased));
      if (progress < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
    Animated.timing(barAnim, { toValue: 1, duration: 1000, delay: 200, useNativeDriver: false }).start();
  }, [elo]);

  const tierColor = getTierColor(tier);
  const total = wins + losses;
  const winRate = total > 0 ? Math.round((wins / total) * 100) : 0;
  const isUnranked = total < 5;
  const memberDays = daysSince(memberSince);

  const tierRanges: Record<string, [number, number]> = {
    BRONZE: [0, 1499], SILVER: [1500, 1699], GOLD: [1700, 1899], PLATINUM: [1900, 2200],
  };
  const [tierMin, tierMax] = tierRanges[tier] ?? [0, 2200];
  const tierPct = Math.min(1, Math.max(0, (elo - tierMin) / (tierMax - tierMin)));
  const tierBarWidth = barAnim.interpolate({ inputRange: [0, 1], outputRange: ["0%", `${tierPct * 100}%`] });

  const isCollapsed = scrollY > 120;

  return (
    <View style={styles.container}>
      {/* Sticky Header */}
      <View
        pointerEvents={isCollapsed ? "auto" : "none"}
        style={[styles.stickyHeader, { paddingTop: topPad + 12, opacity: isCollapsed ? 1 : 0 }]}
      >
        <Text style={styles.stickyName}>{displayName.toUpperCase()}</Text>
        <View style={styles.stickyRight}>
          <Text style={[styles.stickyElo, { color: tierColor }]}>{elo}</Text>
          <Text style={styles.stickyWins}>W {wins} · L {losses} · {winRate}%</Text>
        </View>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={{ paddingBottom: Platform.OS === "web" ? 84 : 100 }}
        showsVerticalScrollIndicator={false}
        scrollEventThrottle={16}
        onScroll={(e) => setScrollY(e.nativeEvent.contentOffset.y)}
      >
        {/* Hero */}
        <View style={[styles.hero, { paddingTop: topPad + 16 }]}>
          <View style={styles.heroTop}>
            <View style={{ flex: 1 }}>
              <Text style={styles.heroName}>{displayName.toUpperCase()}</Text>
              <View style={styles.memberRow}>
                <Text style={styles.memberLabel}>MEMBER SINCE</Text>
                <Text style={styles.memberValue}>{formatJoinDate(memberSince)}</Text>
              </View>
              <View style={styles.memberRow}>
                <Text style={styles.memberLabel}>DAYS ACTIVE</Text>
                <Text style={styles.memberValue}>{memberDays}</Text>
              </View>
            </View>
            <View style={{ flexDirection: "row", gap: 8, alignItems: "flex-start" }}>
              <Pressable style={styles.iconBtn} hitSlop={8} onPress={() => router.push("/friends")}>
                <Ionicons name="people-outline" size={18} color={Colors.muted} />
              </Pressable>
              <Pressable style={styles.iconBtn} hitSlop={8} onPress={() => router.push("/settings")}>
                <Ionicons name="settings-outline" size={18} color={Colors.muted} />
              </Pressable>
            </View>
          </View>

          {isUnranked ? (
            <View style={styles.unranked}>
              <Text style={styles.unrankedNum}>—</Text>
              <Text style={styles.unrankedText}>UNRANKED</Text>
              <Text style={styles.unrankedSub}>PLAY {5 - total} MORE GAMES TO RANK</Text>
            </View>
          ) : (
            <>
              <View style={styles.eloRow}>
                <Text style={styles.eloNumber}>{displayElo}</Text>
                <View style={styles.tierPill}>
                  <View style={[styles.tierDot, { backgroundColor: tierColor }]} />
                  <Text style={[styles.tierLabel, { color: tierColor }]}>{tier}</Text>
                </View>
              </View>
              <View style={styles.tierBarTrack}>
                <Animated.View style={[styles.tierBarFill, { width: tierBarWidth, backgroundColor: tierColor }]} />
              </View>
              <View style={styles.tierBarLabels}>
                <Text style={styles.tierBarMin}>{tierMin}</Text>
                <Text style={styles.tierBarMax}>{tierMax}</Text>
              </View>
            </>
          )}
        </View>

        {/* Stats Grid */}
        <View style={styles.statsGrid}>
          <View style={styles.statCell}>
            <Text style={[styles.statVal, { color: Colors.win }]}>W {wins}</Text>
            <Text style={styles.statLbl}>WINS</Text>
          </View>
          <View style={[styles.statCell, styles.statCellBorder]}>
            <Text style={[styles.statVal, { color: Colors.loss }]}>L {losses}</Text>
            <Text style={styles.statLbl}>LOSSES</Text>
          </View>
          <View style={styles.statCell}>
            <Text style={styles.statVal}>{winRate}%</Text>
            <Text style={styles.statLbl}>WIN RATE</Text>
          </View>
        </View>

        <View style={styles.statsGrid}>
          <View style={styles.statCell}>
            <Text style={styles.statVal}>{profile?.total_court_time_minutes ?? 0}</Text>
            <Text style={styles.statLbl}>CHECK-INS</Text>
          </View>
          <View style={[styles.statCell, styles.statCellBorder]}>
            <Text style={styles.statVal}>{total}</Text>
            <Text style={styles.statLbl}>GAMES</Text>
          </View>
          <View style={styles.statCell}>
            <Text style={[styles.statVal, { color: tierColor }]}>{tier}</Text>
            <Text style={styles.statLbl}>TIER</Text>
          </View>
        </View>

        {/* Recent Matches */}
        <View style={styles.matchSection}>
          <Text style={styles.matchTitle}>RECENT MATCHES</Text>
          {matches.length === 0 ? (
            <Text style={styles.noMatch}>NO MATCHES YET. FIND A RUN.</Text>
          ) : (
            <>
              {matches.slice(0, 10).map((m) => (
                <Pressable
                  key={m.id}
                  onPress={() => {
                    setSelectedMatch(m);
                    setShowDetail(true);
                  }}
                >
                  <MatchRow match={m} />
                </Pressable>
              ))}
              {matches.length > 10 && (
                <View style={styles.paywallOverlay}>
                  <View style={styles.paywallBlur}>
                    {matches.slice(10, 13).map((m) => (
                      <View key={m.id} style={{ opacity: 0.15 }}>
                        <MatchRow match={m} />
                      </View>
                    ))}
                  </View>
                  <View style={styles.paywallBadge}>
                    <Ionicons name="lock-closed" size={14} color={Colors.accent} />
                    <Text style={styles.paywallTitle}>PREMIUM HISTORY</Text>
                    <Text style={styles.paywallSub}>Unlock full match archive</Text>
                  </View>
                </View>
              )}
            </>
          )}
        </View>
      </ScrollView>

      <MatchDetailModal
        match={selectedMatch}
        visible={showDetail}
        onClose={() => setShowDetail(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  scroll: { flex: 1 },

  stickyHeader: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    zIndex: 20,
    backgroundColor: "rgba(13,13,16,0.92)",
    borderBottomWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: 20,
    paddingBottom: 10,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  stickyName: {
    fontFamily: Typography.heading,
    fontSize: 16,
    color: Colors.white,
    letterSpacing: 1,
  },
  stickyRight: { alignItems: "flex-end" },
  stickyElo: {
    fontFamily: Typography.heading,
    fontSize: 18,
    letterSpacing: 0.5,
    lineHeight: 20,
  },
  stickyWins: {
    fontFamily: Typography.bodyMedium,
    fontSize: 9,
    color: Colors.muted,
    letterSpacing: 1,
    marginTop: 2,
  },

  hero: {
    paddingHorizontal: 20,
    paddingBottom: 20,
    backgroundColor: Colors.black,
  },
  heroTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 16,
  },
  heroName: {
    fontFamily: Typography.heading,
    fontSize: 28,
    color: Colors.white,
    letterSpacing: 1,
    lineHeight: 32,
  },
  memberRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 4,
  },
  memberLabel: {
    fontFamily: Typography.bodyMedium,
    fontSize: 9,
    color: Colors.mutedDark,
    letterSpacing: 2,
    textTransform: "uppercase" as const,
  },
  memberValue: {
    fontFamily: Typography.bodyBold,
    fontSize: 11,
    color: Colors.muted,
    letterSpacing: 0.5,
  },
  iconBtn: {
    width: 32,
    height: 32,
    alignItems: "center",
    justifyContent: "center",
  },

  eloRow: { flexDirection: "row", alignItems: "flex-end", gap: 16, marginBottom: 14 },
  eloNumber: {
    fontFamily: Typography.heading,
    fontSize: Platform.OS === "web" ? 64 : 72,
    color: Colors.white,
    lineHeight: Platform.OS === "web" ? 66 : 74,
    letterSpacing: -2,
  },
  tierPill: {
    flexDirection: "row", alignItems: "center", gap: 6,
    borderWidth: 1, paddingHorizontal: 10, paddingVertical: 5,
    borderColor: Colors.border, marginBottom: 8,
  },
  tierDot: { width: 8, height: 8, borderRadius: 4 },
  tierLabel: { fontFamily: Typography.heading, fontSize: 13, letterSpacing: 2 },
  tierBarTrack: { height: 3, backgroundColor: Colors.border, marginBottom: 6 },
  tierBarFill: { height: 3 },
  tierBarLabels: { flexDirection: "row", justifyContent: "space-between" },
  tierBarMin: { fontFamily: Typography.bodyMedium, fontSize: 9, color: Colors.mutedDark, letterSpacing: 1 },
  tierBarMax: { fontFamily: Typography.bodyMedium, fontSize: 9, color: Colors.mutedDark, letterSpacing: 1 },

  unranked: { paddingVertical: 20 },
  unrankedNum: { fontFamily: Typography.heading, fontSize: 72, color: Colors.mutedDark, lineHeight: 68 },
  unrankedText: { fontFamily: Typography.heading, fontSize: 28, color: Colors.white, letterSpacing: 2 },
  unrankedSub: {
    fontFamily: Typography.bodyMedium, fontSize: 11, color: Colors.mutedDark,
    letterSpacing: 2, textTransform: "uppercase" as const, marginTop: 6,
  },

  statsGrid: {
    flexDirection: "row",
    borderBottomWidth: 1, borderColor: Colors.border,
    backgroundColor: Colors.surface,
  },
  statCell: { flex: 1, alignItems: "center", paddingVertical: 18 },
  statCellBorder: { borderLeftWidth: 1, borderRightWidth: 1, borderColor: Colors.border },
  statVal: { fontFamily: Typography.heading, fontSize: 26, color: Colors.text, letterSpacing: 0.5 },
  statLbl: {
    fontFamily: Typography.bodyMedium, fontSize: 9, color: Colors.muted,
    letterSpacing: 2, textTransform: "uppercase" as const, marginTop: 3,
  },

  matchSection: { paddingHorizontal: 20, paddingTop: 20 },
  matchTitle: {
    fontFamily: Typography.heading, fontSize: 16, color: Colors.text,
    letterSpacing: 3, marginBottom: 4, textTransform: "uppercase" as const,
    borderBottomWidth: 1, borderColor: Colors.border, paddingBottom: 10,
  },
  noMatch: {
    fontFamily: Typography.bodyMedium, fontSize: 12, color: Colors.muted,
    letterSpacing: 2, textTransform: "uppercase" as const, paddingVertical: 24,
  },

  paywallOverlay: { position: "relative", marginTop: 4 },
  paywallBlur: {
    overflow: "hidden",
  },
  paywallBadge: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(13,13,16,0.55)",
    gap: 4,
  },
  paywallTitle: {
    fontFamily: Typography.heading,
    fontSize: 13,
    color: Colors.accent,
    letterSpacing: 2,
  },
  paywallSub: {
    fontFamily: Typography.bodyMedium,
    fontSize: 10,
    color: Colors.muted,
    letterSpacing: 1,
  },

  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.75)",
    alignItems: "center",
    justifyContent: "center",
    padding: 20,
  },
  modalCard: {
    width: "100%",
    maxWidth: 360,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 20,
    gap: 10,
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 4,
  },
  modalTitle: {
    fontFamily: Typography.heading,
    fontSize: 14,
    color: Colors.text,
    letterSpacing: 2,
  },
  modalResultBadge: {
    alignSelf: "flex-start",
    paddingHorizontal: 12,
    paddingVertical: 4,
    marginBottom: 6,
  },
  modalResultText: {
    fontFamily: Typography.heading,
    fontSize: 14,
    letterSpacing: 2,
  },
  modalRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  modalLabel: {
    fontFamily: Typography.bodyMedium,
    fontSize: 11,
    color: Colors.muted,
    letterSpacing: 1,
  },
  modalValue: {
    fontFamily: Typography.bodyBold,
    fontSize: 12,
    color: Colors.text,
    letterSpacing: 0.3,
  },
  modalValueMuted: {
    fontFamily: Typography.body,
    fontSize: 12,
    color: Colors.mutedDark,
    letterSpacing: 0.3,
  },
  modalDivider: {
    height: 1,
    backgroundColor: Colors.border,
    marginVertical: 6,
  },
  modalPaywallHint: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    marginTop: 8,
    paddingTop: 10,
    borderTopWidth: 1,
    borderColor: Colors.border,
  },
  modalPaywallText: {
    fontFamily: Typography.bodyMedium,
    fontSize: 9,
    color: Colors.muted,
    letterSpacing: 2,
    textTransform: "uppercase" as const,
  },
});
