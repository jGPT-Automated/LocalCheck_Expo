import * as Haptics from "expo-haptics";
import { router, useFocusEffect } from "expo-router";
import React, { useCallback, useMemo, useState } from "react";
import {
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";

import { AnimatedEntry } from "@/components/AnimatedEntry";
import { BrutalistButton } from "@/components/BrutalistButton";
import { LivePulse } from "@/components/LivePulse";
import { LogoMark } from "@/components/brand/LogoMark";
import { PlayerAvatar } from "@/components/PlayerAvatar";
import { Colors, Radius } from "@/constants/colors";
import { FeedItem } from "@/constants/data";
import { Typography } from "@/constants/typography";
import { useApp } from "@/context/AppContext";
import { useAuth } from "@/context/AuthContext";
import { useCourtCounts, usePresence } from "@/context/CourtPresenceContext";
import { fetchWeeklyActiveCount } from "@/services/checkInService";

/**
 * Home — the local court, live (design mock 5: logo top-left, one accent
 * throughout, elevated smart avatars, flat uncolored activity markers).
 * Roster + counts come exclusively from the shared presence store, so
 * everything on this screen moves together when someone checks in.
 */

const KM_TO_MI = 0.621371;

function feedDotAccent(item: FeedItem): boolean {
  // Accent marks *results*; presence events stay flat — one accent rule.
  return item.type === "game_result" || item.type === "run_result";
}

export function HomeScreen() {
  const {
    localCourt,
    localCourtId,
    checkedInCourtId,
    checkIn,
    checkOut,
    feed,
    runs,
    isFriend,
    refreshCheckedIn,
    refreshFeed,
  } = useApp();
  // Live who's-here + locals for the local court from the shared presence
  // store — realtime events from other users update this without any refresh.
  const { roster, localCount } = usePresence(localCourtId);
  const statIds = useMemo(() => (localCourtId ? [localCourtId] : []), [localCourtId]);
  const liveCounts = useCourtCounts(statIds);
  const { user } = useAuth();
  const { top, bottom } = useSafeAreaInsets();
  const topPad = Platform.OS === "web" ? 67 : top;

  const [weeklyActive, setWeeklyActive] = useState<number | null>(null);

  // Re-sync check-in state + feed + weekly stat every time Home gains focus,
  // so actions taken on other screens show immediately.
  useFocusEffect(
    useCallback(() => {
      refreshCheckedIn();
      refreshFeed();
      if (localCourtId) {
        fetchWeeklyActiveCount(localCourtId).then(setWeeklyActive);
      }
    }, [refreshCheckedIn, refreshFeed, localCourtId])
  );

  const isCheckedIn = !!localCourt && checkedInCourtId === localCourt.id;

  if (!localCourt) {
    return <NoCourtState topPad={topPad} isSignedIn={!!user} />;
  }

  // The stats view counts check-ins the RLS-filtered roster can't see
  // (friends-only / private) — surface those as "hidden" instead of letting
  // the number and the avatars disagree.
  const statsActive = liveCounts[localCourt.id]?.activeCount ?? 0;
  const activeTotal = Math.max(roster.length, statsActive);
  const hiddenCount = Math.max(0, activeTotal - roster.length);
  const approx = hiddenCount > 0 ? "~" : "";

  // Friends first, then by elo — copy before sorting (shared store array).
  const sortedPlayers = [...roster]
    .sort((a, b) => {
      const aFriend = isFriend(a.id) ? 1 : 0;
      const bFriend = isFriend(b.id) ? 1 : 0;
      if (aFriend !== bFriend) return bFriend - aFriend;
      return b.elo - a.elo;
    })
    .slice(0, 6);

  const courtRuns = runs
    .filter((r) => r.courtId === localCourt.id)
    .sort((a, b) => a.startTimeIso.localeCompare(b.startTimeIso));
  const nextRun = courtRuns.find((r) => new Date(r.startTimeIso).getTime() > Date.now() - 60 * 60_000);
  const courtFeed = feed.filter((f) => f.courtId === localCourt.id).slice(0, 6);

  const distanceMi =
    localCourt.distanceKm != null ? `${(localCourt.distanceKm * KM_TO_MI).toFixed(1)} mi` : null;
  const courtMeta = [
    distanceMi,
    localCourt.address || [localCourt.neighborhood, localCourt.city].filter(Boolean).join(", "),
  ]
    .filter(Boolean)
    .join(" · ");

  const handleCheckIn = async () => {
    if (Platform.OS !== "web") {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }
    if (isCheckedIn) {
      await checkOut();
    } else {
      await checkIn(localCourt.id);
      if (Platform.OS !== "web") {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
    }
  };

  return (
    <View style={styles.container}>
      {/* ── Brand header: logo lockup left, live pulse right ── */}
      <View style={[styles.header, { paddingTop: topPad + 12 }]}>
        <View style={styles.brandLockup}>
          <LogoMark size={26} />
          <Text style={styles.brandWordmark}>LOCALCHECK</Text>
        </View>
        {activeTotal > 0 && (
          <View style={styles.headerLive}>
            <Text style={styles.headerLiveText}>
              {approx}
              {activeTotal} ACTIVE
            </Text>
          </View>
        )}
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: Platform.OS === "web" ? 84 : bottom + 96 }}
      >
        {/* ── Hero court card ── */}
        <View style={styles.heroCard}>
          <View style={styles.heroTopRow}>
            <View style={styles.sportChip}>
              <Feather name="globe" size={10} color={Colors.textSecondary} />
              <Text style={styles.sportChipText}>{localCourt.sport}</Text>
            </View>
            {activeTotal > 0 && (
              <View style={styles.liveNow}>
                <LivePulse size={5} color={Colors.accent} style={{ marginRight: 5 }} />
                <Text style={styles.liveNowText}>LIVE NOW</Text>
              </View>
            )}
          </View>

          <Text style={styles.courtName}>{localCourt.name.toUpperCase()}</Text>
          {courtMeta ? <Text style={styles.courtMeta}>{courtMeta}</Text> : null}

          <View style={styles.statRow}>
            <View style={styles.statCell}>
              <Text style={[styles.statValue, styles.statValueAccent]}>
                {approx}
                {activeTotal}
              </Text>
              <Text style={styles.statLabel}>ACTIVE NOW</Text>
            </View>
            <View style={[styles.statCell, styles.statCellBorder]}>
              <Text style={styles.statValue}>{localCount}</Text>
              <Text style={styles.statLabel}>LOCALS</Text>
            </View>
            <View style={[styles.statCell, styles.statCellBorder]}>
              <Text style={styles.statValue}>{courtRuns.length}</Text>
              <Text style={styles.statLabel}>RUNS THIS WK</Text>
            </View>
            <View style={[styles.statCell, styles.statCellBorder]}>
              <Text style={styles.statValue}>{weeklyActive ?? "–"}</Text>
              <Text style={styles.statLabel}>ACTIVE THIS WK</Text>
            </View>
          </View>

          <View style={styles.checkInRow}>
            <BrutalistButton
              label={isCheckedIn ? "CHECKED IN ✓" : "CHECK IN"}
              onPress={handleCheckIn}
              variant={isCheckedIn ? "outline" : "accent"}
              style={styles.checkInBtn}
              testID="home-check-in-btn"
            />
            <Pressable
              style={styles.viewBtn}
              onPress={() => router.push(`/court/${localCourt.id}`)}
              accessibilityLabel="Open court page"
            >
              <Feather name="chevron-right" size={18} color={Colors.textSecondary} />
            </Pressable>
          </View>
        </View>

        {/* ── Who's here ── */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>WHO'S HERE</Text>
            {activeTotal > 0 && (
              <Text style={styles.sectionAccent}>
                {approx}
                {activeTotal} ACTIVE
              </Text>
            )}
          </View>
          <View style={styles.whosHereRow}>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.rosterRow}
              style={{ flex: 1 }}
            >
              {sortedPlayers.map((p) => {
                const friend = isFriend(p.id);
                return (
                  <AnimatedEntry key={p.id}>
                    <Pressable
                      style={styles.rosterItem}
                      onPress={() => router.push(`/player/${p.id}`)}
                    >
                      <View>
                        <PlayerAvatar initials={p.avatar} size={44} />
                        {friend && (
                          <View style={styles.friendBadge}>
                            <Feather name="star" size={7} color={Colors.black} />
                          </View>
                        )}
                      </View>
                      <Text style={styles.rosterName} numberOfLines={1}>
                        {p.name.split(" ")[0]}
                      </Text>
                    </Pressable>
                  </AnimatedEntry>
                );
              })}
              {hiddenCount > 0 && (
                <View style={styles.rosterItem}>
                  <View style={styles.hiddenSquare}>
                    <Text style={styles.hiddenPlus}>+{hiddenCount}</Text>
                  </View>
                  <Text style={styles.hiddenLabel}>hidden</Text>
                </View>
              )}
              {activeTotal === 0 && (
                <Text style={styles.emptyText}>Nobody here yet — be the first.</Text>
              )}
            </ScrollView>
            <Pressable
              style={styles.localsCard}
              onPress={() => router.push(`/court/${localCourt.id}`)}
            >
              <Text style={styles.localsCardCount}>{localCount}</Text>
              <Text style={styles.localsCardLabel}>view all</Text>
            </Pressable>
          </View>
        </View>

        {/* ── Next run ── */}
        {nextRun && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>NEXT RUN</Text>
            </View>
            <Pressable
              style={({ pressed }) => [styles.runStrip, pressed && styles.pressed]}
              onPress={() => router.push(`/run/${nextRun.id}`)}
            >
              <View style={styles.runAccentBar} />
              <View style={styles.runStripBody}>
                <Text style={styles.runTitle}>{nextRun.title}</Text>
                <Text style={styles.runMeta}>
                  {nextRun.date === "TODAY" ? "Today" : nextRun.date} · {nextRun.time} ·{" "}
                  {nextRun.courtName}
                </Text>
              </View>
              <Text style={styles.runCount}>
                <Text style={styles.runCountFilled}>{nextRun.participants.length}</Text>
                <Text style={styles.runCountMax}>/{nextRun.maxPlayers}</Text>
              </Text>
            </Pressable>
          </View>
        )}

        {/* ── Activity feed: flat timeline, accent only on results ── */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>ACTIVITY FEED</Text>
          </View>
          {courtFeed.length === 0 ? (
            <Text style={styles.emptyText}>No activity yet. Be the first.</Text>
          ) : (
            courtFeed.map((item, i) => (
              <View key={item.id} style={styles.feedItem}>
                <View style={styles.feedDotCol}>
                  <View
                    style={[
                      styles.feedDot,
                      feedDotAccent(item) ? styles.feedDotAccent : styles.feedDotFlat,
                    ]}
                  />
                  {i < courtFeed.length - 1 && <View style={styles.feedLine} />}
                </View>
                <View style={styles.feedContent}>
                  <Text style={styles.feedMessage}>{item.message}</Text>
                  <Text style={styles.feedTime}>{item.timestamp}</Text>
                </View>
              </View>
            ))
          )}
        </View>
      </ScrollView>
    </View>
  );
}

function NoCourtState({ topPad, isSignedIn }: { topPad: number; isSignedIn: boolean }) {
  if (isSignedIn) {
    // Signed in but no local court set yet → focused CTA
    return (
      <View style={styles.container}>
        <View style={[styles.header, { paddingTop: topPad + 12 }]}>
          <View style={styles.brandLockup}>
            <LogoMark size={26} />
            <Text style={styles.brandWordmark}>LOCALCHECK</Text>
          </View>
        </View>
        <View style={styles.noCourtContainer}>
          <Feather name="map-pin" size={28} color={Colors.accent} style={styles.noCourtIcon} />
          <Text style={styles.noCourtTitle}>FIND A COURT</Text>
          <Text style={styles.noCourtSub}>
            Pick a court as your home base.{"\n"}Get live check-ins and run updates.
          </Text>
          <Pressable style={styles.findCourtBtn} onPress={() => router.push("/(tabs)/explore")}>
            <Text style={styles.findCourtBtnText}>EXPLORE COURTS →</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  // Not signed in → welcome / landing page
  return (
    <View style={[styles.container, { justifyContent: "space-between" }]}>
      {/* Logo area */}
      <View style={[styles.welcomeTop, { paddingTop: topPad + 40 }]}>
        <Text style={styles.welcomeBrand}>LOCALCHECK</Text>
        <View style={[styles.welcomeAccentBar, { backgroundColor: Colors.accent }]} />
        <Text style={styles.welcomeTagline}>STREET SPORTS.{"\n"}YOUR LOCAL COURT.</Text>
      </View>

      {/* CTAs */}
      <View style={styles.welcomeCtas}>
        <Pressable style={styles.welcomeBtnPrimary} onPress={() => router.push("/auth")}>
          <Text style={styles.welcomeBtnPrimaryText}>SIGN IN</Text>
        </Pressable>
        <Pressable style={styles.welcomeBtnSecondary} onPress={() => router.push("/auth")}>
          <Text style={styles.welcomeBtnSecondaryText}>CREATE ACCOUNT</Text>
        </Pressable>
        <Pressable style={styles.welcomeBtnGhost} onPress={() => router.push("/(tabs)/explore")}>
          <Feather name="map" size={13} color={Colors.muted} />
          <Text style={styles.welcomeBtnGhostText}>EXPLORE COURTS</Text>
        </Pressable>
      </View>

      {/* Footer */}
      <View style={styles.welcomeFooter}>
        <Text style={styles.welcomeFooterText}>
          BASKETBALL · PICKLEBALL · TENNIS
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },

  // ── Brand header ──
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingBottom: 12,
  },
  brandLockup: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  brandWordmark: {
    fontFamily: Typography.heading,
    fontSize: 17,
    color: Colors.text,
    letterSpacing: 2,
  },
  headerLive: {},
  headerLiveText: {
    fontFamily: Typography.bodyBold,
    fontSize: 10,
    color: Colors.accent,
    letterSpacing: 1.5,
  },

  // ── Hero ──
  heroCard: {
    marginHorizontal: 20,
    marginTop: 4,
    padding: 16,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.lg,
    backgroundColor: Colors.surface,
  },
  heroTopRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 14,
  },
  sportChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.sm,
    paddingHorizontal: 9,
    paddingVertical: 5,
  },
  sportChipText: {
    fontFamily: Typography.bodySemiBold,
    fontSize: 9,
    color: Colors.textSecondary,
    letterSpacing: 1.5,
    textTransform: "uppercase" as const,
  },
  liveNow: {
    flexDirection: "row",
    alignItems: "center",
  },
  liveNowText: {
    fontFamily: Typography.bodyBold,
    fontSize: 9,
    color: Colors.accent,
    letterSpacing: 1.5,
  },
  courtName: {
    fontFamily: Typography.heading,
    fontSize: 32,
    color: Colors.text,
    letterSpacing: 0.5,
    lineHeight: 34,
    marginBottom: 4,
  },
  courtMeta: {
    fontFamily: Typography.body,
    fontSize: 12,
    color: Colors.muted,
    marginBottom: 16,
  },
  statRow: {
    flexDirection: "row",
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.sm,
    marginBottom: 14,
  },
  statCell: {
    flex: 1,
    alignItems: "center",
    paddingVertical: 10,
    paddingHorizontal: 2,
  },
  statCellBorder: {
    borderLeftWidth: 1,
    borderLeftColor: Colors.border,
  },
  statValue: {
    fontFamily: Typography.heading,
    fontSize: 17,
    color: Colors.text,
    lineHeight: 20,
  },
  statValueAccent: { color: Colors.accent },
  statLabel: {
    fontFamily: Typography.bodySemiBold,
    fontSize: 7,
    color: Colors.muted,
    letterSpacing: 1,
    marginTop: 3,
    textAlign: "center",
  },
  checkInRow: {
    flexDirection: "row",
    gap: 10,
  },
  checkInBtn: { flex: 1 },
  viewBtn: {
    width: 48,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.sm,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: Colors.surfaceHigh,
  },

  // ── Section ──
  section: {
    paddingHorizontal: 20,
    paddingTop: 22,
  },
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  sectionTitle: {
    fontFamily: Typography.bodySemiBold,
    fontSize: 11,
    color: Colors.textSecondary,
    letterSpacing: 2,
  },
  sectionAccent: {
    fontFamily: Typography.bodyBold,
    fontSize: 9,
    color: Colors.accent,
    letterSpacing: 1.5,
  },

  // ── Who's here ──
  whosHereRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
  },
  rosterRow: { gap: 14, paddingVertical: 2, alignItems: "flex-start" },
  rosterItem: { alignItems: "center", width: 48 },
  rosterName: {
    fontFamily: Typography.bodyMedium,
    fontSize: 10,
    color: Colors.textSecondary,
    marginTop: 6,
  },
  friendBadge: {
    position: "absolute",
    bottom: -3,
    right: -3,
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: Colors.accent,
    borderWidth: 1.5,
    borderColor: Colors.background,
    alignItems: "center",
    justifyContent: "center",
  },
  hiddenSquare: {
    width: 44,
    height: 44,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.border,
    borderStyle: "dashed",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: Colors.surface,
  },
  hiddenPlus: {
    fontFamily: Typography.heading,
    fontSize: 13,
    color: Colors.muted,
  },
  hiddenLabel: {
    fontFamily: Typography.bodyMedium,
    fontSize: 10,
    color: Colors.muted,
    marginTop: 6,
  },
  localsCard: {
    width: 72,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.md,
    backgroundColor: Colors.surface,
    alignItems: "center",
    paddingVertical: 10,
  },
  localsCardCount: {
    fontFamily: Typography.heading,
    fontSize: 20,
    color: Colors.text,
    lineHeight: 24,
  },
  localsCardLabel: {
    fontFamily: Typography.bodyMedium,
    fontSize: 9,
    color: Colors.muted,
    letterSpacing: 0.5,
    marginTop: 2,
  },

  // ── Next run ──
  runStrip: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.sm,
    overflow: "hidden",
  },
  pressed: { backgroundColor: Colors.surfaceHigh },
  runAccentBar: {
    width: 3,
    alignSelf: "stretch",
    backgroundColor: Colors.accent,
  },
  runStripBody: { flex: 1, paddingHorizontal: 14, paddingVertical: 12 },
  runTitle: {
    fontFamily: Typography.heading,
    fontSize: 15,
    color: Colors.text,
    letterSpacing: 0.5,
    marginBottom: 3,
  },
  runMeta: {
    fontFamily: Typography.body,
    fontSize: 11,
    color: Colors.muted,
  },
  runCount: { paddingRight: 14 },
  runCountFilled: {
    fontFamily: Typography.heading,
    fontSize: 20,
    color: Colors.accent,
  },
  runCountMax: {
    fontFamily: Typography.heading,
    fontSize: 13,
    color: Colors.muted,
  },

  // ── Activity feed ──
  feedItem: {
    flexDirection: "row",
    paddingBottom: 16,
  },
  feedDotCol: {
    width: 20,
    alignItems: "center",
  },
  feedDot: {
    width: 9,
    height: 9,
    borderRadius: 5,
    marginTop: 3,
  },
  feedDotAccent: { backgroundColor: Colors.accent },
  feedDotFlat: {
    backgroundColor: "transparent",
    borderWidth: 1.5,
    borderColor: Colors.mutedDark,
  },
  feedLine: {
    flex: 1,
    width: 1,
    backgroundColor: Colors.borderSubtle,
    marginTop: 4,
  },
  feedContent: { flex: 1, paddingLeft: 8 },
  feedMessage: {
    fontFamily: Typography.bodyMedium,
    fontSize: 12,
    color: Colors.text,
    letterSpacing: 0.2,
    lineHeight: 17,
    marginBottom: 3,
  },
  feedTime: {
    fontFamily: Typography.body,
    fontSize: 10,
    color: Colors.muted,
    letterSpacing: 0.5,
  },
  emptyText: {
    fontFamily: Typography.bodyMedium,
    fontSize: 12,
    color: Colors.muted,
    letterSpacing: 0.5,
  },

  // ── No Court / Find Court ──
  noCourtContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 40,
  },
  noCourtIcon: { marginBottom: 16 },
  noCourtTitle: {
    fontFamily: Typography.heading,
    fontSize: 18,
    color: Colors.text,
    letterSpacing: 3,
    marginBottom: 10,
    textAlign: "center",
  },
  noCourtSub: {
    fontFamily: Typography.body,
    fontSize: 13,
    color: Colors.muted,
    textAlign: "center",
    lineHeight: 20,
    marginBottom: 24,
  },
  findCourtBtn: {
    borderWidth: 1,
    borderColor: Colors.accent,
    paddingHorizontal: 24,
    paddingVertical: 12,
  },
  findCourtBtnText: {
    fontFamily: Typography.heading,
    fontSize: 13,
    color: Colors.accent,
    letterSpacing: 2,
  },

  // ── Welcome / Landing ──
  welcomeTop: {
    paddingHorizontal: 28,
    paddingBottom: 24,
  },
  welcomeBrand: {
    fontFamily: Typography.heading,
    fontSize: 42,
    color: Colors.text,
    letterSpacing: 3,
    lineHeight: 46,
    marginBottom: 16,
  },
  welcomeAccentBar: {
    width: 40,
    height: 3,
    marginBottom: 20,
  },
  welcomeTagline: {
    fontFamily: Typography.heading,
    fontSize: 22,
    color: Colors.muted,
    letterSpacing: 1,
    lineHeight: 28,
  },
  welcomeCtas: {
    paddingHorizontal: 28,
    gap: 12,
    paddingBottom: 40,
  },
  welcomeBtnPrimary: {
    backgroundColor: Colors.accent,
    paddingVertical: 16,
    alignItems: "center",
  },
  welcomeBtnPrimaryText: {
    fontFamily: Typography.heading,
    fontSize: 14,
    color: Colors.black,
    letterSpacing: 3,
  },
  welcomeBtnSecondary: {
    backgroundColor: "transparent",
    borderWidth: 1,
    borderColor: Colors.border,
    paddingVertical: 16,
    alignItems: "center",
  },
  welcomeBtnSecondaryText: {
    fontFamily: Typography.heading,
    fontSize: 14,
    color: Colors.text,
    letterSpacing: 3,
  },
  welcomeBtnGhost: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 14,
  },
  welcomeBtnGhostText: {
    fontFamily: Typography.bodyMedium,
    fontSize: 12,
    color: Colors.muted,
    letterSpacing: 2,
  },
  welcomeFooter: {
    paddingBottom: 40,
    alignItems: "center",
  },
  welcomeFooterText: {
    fontFamily: Typography.bodyMedium,
    fontSize: 9,
    color: Colors.mutedDark,
    letterSpacing: 3,
    textTransform: "uppercase" as const,
  },
});
