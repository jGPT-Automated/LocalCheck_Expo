import * as Haptics from "expo-haptics";
import { LinearGradient } from "expo-linear-gradient";
import { router, useFocusEffect } from "expo-router";
import React, { useCallback, useState } from "react";
import {
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather, MaterialCommunityIcons } from "@expo/vector-icons";

import { AnimatedEntry } from "@/components/AnimatedEntry";
import { LogoMark } from "@/components/brand/LogoMark";
import { PlayerAvatar } from "@/components/PlayerAvatar";
import { ScreenHeader } from "@/components/ScreenHeader";
import { Colors, Radius } from "@/constants/colors";
import { Court, FeedItem, getCourtIdentityColor } from "@/constants/data";
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
const PICKLEBALL_HOLES = [
  { top: 3, left: 5 },
  { top: 6, left: 2 },
  { top: 7, right: 2 },
  { bottom: 3, left: 5 },
] as const;

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
  const liveCounts = useCourtCounts(localCourt ? [localCourt] : []);
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
      <ScreenHeader
        title="LOCALCHECK"
        wordmark
        right={activeTotal > 0 ? (
          <View style={styles.headerLive}>
            <Text style={styles.headerLiveText}>
              {approx}
              {activeTotal} ACTIVE
            </Text>
          </View>
        ) : undefined}
      />

      {/* Home uses a full-width court section. Compact cards stay in Explore and Map. */}
      <HomeCourtSection
        court={{ ...localCourt, neighborhood: courtMeta }}
        activeTotal={activeTotal}
        activeApprox={approx}
        localCount={localCount}
        runCount={courtRuns.length}
        weeklyActive={weeklyActive}
        isCheckedIn={isCheckedIn}
        onCheckIn={() => void handleCheckIn()}
        onView={() => router.push(`/court/${localCourt.id}`)}
      />

      {/* The local-court summary and planning context stay fixed. Only the feed scrolls. */}
      <View style={styles.fixedContext}>
        {/* ── Who's here ── */}
        <View style={styles.peopleSection}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>WHO'S HERE</Text>
            <Pressable
              style={styles.viewAllInline}
              onPress={() => router.push(`/court/${localCourt.id}`)}
              accessibilityRole="button"
              accessibilityLabel={`View all ${localCount} locals at ${localCourt.name}`}
            >
              <Text style={styles.viewAllInlineText}>VIEW ALL</Text>
              <Text style={styles.viewAllInlineCount}>{localCount}</Text>
              <Feather name="chevron-right" size={13} color={Colors.muted} />
            </Pressable>
          </View>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.rosterRow}
          >
            {sortedPlayers.map((p) => {
              const friend = isFriend(p.id);
              return (
                <AnimatedEntry key={p.id}>
                  <Pressable
                    style={styles.rosterItem}
                    onPress={() => router.push(`/player/${p.id}`)}
                    accessibilityRole="button"
                    accessibilityLabel={p.name}
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
                      {p.name}
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
        </View>

        {/* ── Next run ── */}
        {nextRun && (
          <View style={styles.nextRunSection}>
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
      </View>

      {/* ── Activity feed: this is the only vertically scrolling Home section. ── */}
      <View style={styles.feedSection}>
        <View style={styles.feedSectionHeader}>
          <Text style={styles.sectionTitle}>ACTIVITY FEED</Text>
        </View>
        <ScrollView
          style={styles.feedScroll}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: Platform.OS === "web" ? 88 : bottom + 96 }}
        >
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
        </ScrollView>
      </View>
    </View>
  );
}

function SportBallMark({ sport, color }: { sport: Court["sport"]; color: string }) {
  if (sport === "PICKLEBALL") {
    return (
      <View style={[styles.pickleballMark, { borderColor: color }]}>
        {PICKLEBALL_HOLES.map((hole, index) => (
          <View key={index} style={[styles.pickleballHole, hole, { backgroundColor: color }]} />
        ))}
      </View>
    );
  }

  return (
    <MaterialCommunityIcons
      name={sport === "BASKETBALL" ? "basketball" : "tennis-ball"}
      size={16}
      color={color}
    />
  );
}

function HomeCourtSection({
  court,
  activeTotal,
  activeApprox,
  localCount,
  runCount,
  weeklyActive,
  isCheckedIn,
  onCheckIn,
  onView,
}: {
  court: Court;
  activeTotal: number;
  activeApprox: string;
  localCount: number;
  runCount: number;
  weeklyActive: number | null;
  isCheckedIn: boolean;
  onCheckIn: () => void;
  onView: () => void;
}) {
  const identityColor = getCourtIdentityColor(court.sport);
  const stats = [
    { label: "ACTIVE NOW", value: `${activeApprox}${activeTotal}`, live: activeTotal > 0 },
    { label: "LOCALS", value: localCount },
    { label: "RUNS", value: runCount },
    { label: "THIS WEEK", value: weeklyActive ?? "–" },
  ];

  return (
    <LinearGradient
      colors={[Colors.surface, "#121216", Colors.surfaceDark]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={styles.homeCourtSection}
    >
      <View
        pointerEvents="none"
        style={[styles.homeCourtShader, { backgroundColor: `${identityColor}0A` }]}
      />
      <View style={styles.homeCourtTopline}>
        <View style={styles.homeSportIdentity}>
          <SportBallMark sport={court.sport} color={identityColor} />
          <Text style={styles.homeSportLabel}>{court.sport}</Text>
        </View>
        <View style={styles.homeLocalBadge}>
          <Text style={styles.homeLocalBadgeText}>MY LOCAL COURT</Text>
        </View>
      </View>

      <Pressable onPress={onView} accessibilityRole="button" accessibilityLabel={`Open ${court.name}`}>
        <Text style={styles.homeCourtName} numberOfLines={2}>{court.name}</Text>
        <Text style={styles.homeCourtMeta} numberOfLines={1}>
          {court.neighborhood || court.address || court.market || "Court details"}
        </Text>
      </Pressable>

      <View style={styles.homeStatsRow}>
        {stats.map((stat, index) => (
          <React.Fragment key={stat.label}>
            {index > 0 ? <View style={styles.homeStatDivider} /> : null}
            <View style={styles.homeStatBlock}>
              <Text style={[styles.homeStatValue, stat.live && styles.homeStatValueLive]}>
                {stat.value}
              </Text>
              <Text style={styles.homeStatLabel}>{stat.label}</Text>
            </View>
          </React.Fragment>
        ))}
      </View>

      <View style={styles.homeActionRow}>
        <Pressable
          style={({ pressed }) => [
            styles.homeCheckInButton,
            isCheckedIn && styles.homeCheckInButtonActive,
            pressed && styles.homeActionPressed,
          ]}
          onPress={onCheckIn}
          accessibilityRole="button"
          accessibilityLabel={isCheckedIn ? `Check out of ${court.name}` : `Check in to ${court.name}`}
        >
          <Text style={[styles.homeCheckInText, isCheckedIn && styles.homeCheckInTextActive]}>
            {isCheckedIn ? "CHECKED IN ✓" : "CHECK IN"}
          </Text>
        </Pressable>
        <Pressable
          style={({ pressed }) => [styles.homeViewButton, pressed && styles.homeActionPressed]}
          onPress={onView}
          accessibilityRole="button"
          accessibilityLabel={`View ${court.name}`}
        >
          <Feather name="chevron-right" size={19} color={Colors.textSecondary} />
        </Pressable>
      </View>
    </LinearGradient>
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

  // ── Full-width Home court summary ──
  homeCourtSection: {
    minHeight: 184,
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 11,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    overflow: "hidden",
  },
  homeCourtShader: {
    position: "absolute",
    width: 210,
    height: 210,
    borderRadius: 105,
    right: -72,
    top: -92,
  },
  homeCourtTopline: {
    minHeight: 22,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  homeSportIdentity: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
  },
  pickleballMark: {
    width: 16,
    height: 16,
    borderRadius: 8,
    borderWidth: 1,
    opacity: 0.82,
  },
  pickleballHole: {
    position: "absolute",
    width: 2,
    height: 2,
    borderRadius: 1,
    opacity: 0.82,
  },
  homeSportLabel: {
    fontFamily: Typography.bodyMedium,
    fontSize: 8,
    color: Colors.textSecondary,
    letterSpacing: 1.7,
  },
  homeLocalBadge: {
    borderWidth: 1,
    borderColor: Colors.borderLight,
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 4,
    backgroundColor: "rgba(9,9,11,0.58)",
  },
  homeLocalBadgeText: {
    fontFamily: Typography.bodySemiBold,
    fontSize: 7,
    color: Colors.textSecondary,
    letterSpacing: 1.2,
  },
  homeCourtName: {
    maxWidth: "88%",
    marginTop: 6,
    fontFamily: Typography.headingRegular,
    fontSize: 20,
    lineHeight: 22,
    color: Colors.text,
    letterSpacing: 0.15,
    textTransform: "uppercase" as const,
  },
  homeCourtMeta: {
    maxWidth: "80%",
    marginTop: 2,
    fontFamily: Typography.body,
    fontSize: 10,
    color: Colors.muted,
  },
  homeStatsRow: {
    minHeight: 38,
    marginTop: 7,
    flexDirection: "row",
    alignItems: "stretch",
    borderTopWidth: 1,
    borderTopColor: Colors.borderSubtle,
  },
  homeStatBlock: {
    minWidth: 0,
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 3,
  },
  homeStatValue: {
    fontFamily: Typography.headingRegular,
    fontSize: 19,
    lineHeight: 20,
    color: Colors.text,
    textAlign: "center",
    fontVariant: ["tabular-nums"],
  },
  homeStatValueLive: { color: Colors.accent },
  homeStatLabel: {
    marginTop: 2,
    fontFamily: Typography.bodySemiBold,
    fontSize: 7,
    color: Colors.muted,
    letterSpacing: 1,
    textAlign: "center",
  },
  homeStatDivider: {
    width: 1,
    height: 28,
    alignSelf: "center",
    backgroundColor: Colors.borderSubtle,
  },
  homeActionRow: {
    minHeight: 38,
    marginTop: 7,
    marginHorizontal: 12,
    flexDirection: "row",
    gap: 8,
  },
  homeCheckInButton: {
    flex: 1,
    minHeight: 38,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: Radius.sm,
    backgroundColor: Colors.accent,
    shadowColor: Colors.accent,
    shadowOpacity: 0.28,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  homeCheckInButtonActive: {
    backgroundColor: Colors.surfaceHigh,
    borderWidth: 1,
    borderColor: Colors.borderLight,
    shadowOpacity: 0,
    elevation: 0,
  },
  homeCheckInText: {
    fontFamily: Typography.bodyBold,
    fontSize: 10,
    color: Colors.black,
    letterSpacing: 1.7,
  },
  homeCheckInTextActive: { color: Colors.text },
  homeViewButton: {
    width: 42,
    minHeight: 38,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: Radius.sm,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.surfaceHigh,
  },
  homeActionPressed: { opacity: 0.8 },

  // ── Section ──
  fixedContext: { backgroundColor: Colors.background },
  peopleSection: {
    minHeight: 94,
    paddingHorizontal: 20,
    paddingTop: 13,
    paddingBottom: 10,
    backgroundColor: Colors.surfaceDark,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderSubtle,
  },
  nextRunSection: {
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderSubtle,
  },
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    minHeight: 18,
    marginBottom: 8,
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
  viewAllInline: {
    minHeight: 28,
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingLeft: 8,
  },
  viewAllInlineText: {
    fontFamily: Typography.bodySemiBold,
    fontSize: 8,
    color: Colors.muted,
    letterSpacing: 1.1,
  },
  viewAllInlineCount: {
    fontFamily: Typography.headingRegular,
    fontSize: 13,
    color: Colors.textSecondary,
    fontVariant: ["tabular-nums"],
  },

  // ── Who's here ──
  rosterRow: { gap: 14, paddingVertical: 2, alignItems: "flex-start" },
  rosterItem: { alignItems: "center", width: 52 },
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
  feedSection: {
    flex: 1,
    minHeight: 0,
    paddingTop: 12,
    backgroundColor: Colors.background,
  },
  feedSectionHeader: {
    minHeight: 24,
    justifyContent: "center",
    paddingHorizontal: 20,
    paddingBottom: 8,
  },
  feedScroll: {
    flex: 1,
    minHeight: 0,
    paddingHorizontal: 20,
  },
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
