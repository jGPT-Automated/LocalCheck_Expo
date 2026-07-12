import * as Haptics from "expo-haptics";
import { router } from "expo-router";
import React, { useRef, useState } from "react";
import {
  Animated,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";

import { BrutalistButton } from "@/components/BrutalistButton";
import { LivePulse } from "@/components/LivePulse";
import { PlayerAvatar } from "@/components/PlayerAvatar";
import { Colors, Radius } from "@/constants/colors";
import { getSportColor } from "@/constants/data";
import { Typography } from "@/constants/typography";
import { useApp } from "@/context/AppContext";
import { useAuth } from "@/context/AuthContext";


function getSportShort(sport?: string | null): string {
  if (!sport) return "";
  if (sport === "BASKETBALL") return "BB";
  if (sport === "PICKLEBALL") return "PB";
  return sport.slice(0, 2);
}

const COLLAPSE_THRESHOLD = 100;

export function HomeScreen() {
  const { localCourt, localCourtId, checkedInCourtId, checkIn, checkOut, feed, runs, isFriend, activePlayers, localPlayers, isLoading } = useApp();
  const { user } = useAuth();
  const { top, bottom } = useSafeAreaInsets();
  const topPad = Platform.OS === "web" ? 67 : top;

  const scrollY = useRef(new Animated.Value(0)).current;
  const [isCollapsed, setIsCollapsed] = useState(false);

  const isCheckedIn = checkedInCourtId === localCourt?.id;

  if (!localCourt) {
    return <NoCourtState topPad={topPad} isSignedIn={!!user} />;
  }

  const sportColor = getSportColor(localCourt.sport);
  const sportShort = getSportShort(localCourt.sport);

  const rawPlayers = activePlayers;
  const sortedPlayers = rawPlayers
    .sort((a, b) => {
      const aFriend = isFriend(a.id) ? 1 : 0;
      const bFriend = isFriend(b.id) ? 1 : 0;
      if (aFriend !== bFriend) return bFriend - aFriend;
      return b.elo - a.elo;
    })
    .slice(0, 8);
  const activeCount = activePlayers.length;
  const overflowCount = Math.max(0, activeCount - sortedPlayers.length);
  const courtRuns = runs.filter((r) => r.courtId === localCourt.id);
  const courtFeed = feed.filter((f) => f.courtId === localCourt.id).slice(0, 5);
  const localCount = localPlayers.length;

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

  const collapsedOpacity = scrollY.interpolate({
    inputRange: [COLLAPSE_THRESHOLD - 20, COLLAPSE_THRESHOLD + 20],
    outputRange: [0, 1],
    extrapolate: "clamp",
  });

  const expandedOpacity = scrollY.interpolate({
    inputRange: [0, COLLAPSE_THRESHOLD - 20],
    outputRange: [1, 0],
    extrapolate: "clamp",
  });

  return (
    <View style={styles.container}>
      {/* ── Sticky Collapsed Header (appears on scroll) ── */}
      <Animated.View
        style={[styles.collapsedHeader, { paddingTop: topPad, opacity: collapsedOpacity }]}
        pointerEvents={isCollapsed ? "auto" : "none"}
      >
        <Text style={styles.collapsedCourtName} numberOfLines={1}>
          {localCourt.name.toUpperCase()}
        </Text>
        {activeCount > 0 ? (
          <View style={styles.collapsedCenter}>
            <LivePulse size={4} color={Colors.accent} style={{ marginRight: 4 }} />
            <Text style={styles.collapsedActiveCount}>{activeCount}</Text>
          </View>
        ) : (
          <View style={styles.collapsedCenter} />
        )}
        <View style={styles.collapsedRight}>
          {sportShort ? (
            <View style={[styles.collapsedSportTag, { borderColor: sportColor }]}>
              <Text style={[styles.collapsedSportText, { color: sportColor }]}>{sportShort}</Text>
            </View>
          ) : null}
        </View>
      </Animated.View>

      {/* ── Expanded Top Header ── */}
      <Animated.View
        style={[styles.header, { paddingTop: topPad + 12, opacity: expandedOpacity }]}
      >
        <View>
          <Text style={styles.headerEyebrow}>LOCALCHECK</Text>
          <Text style={styles.headerBrand}>HOME</Text>
        </View>
      </Animated.View>

      <Animated.ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: Platform.OS === "web" ? 84 : bottom + 96 }}
        scrollEventThrottle={16}
        onScroll={Animated.event(
          [{ nativeEvent: { contentOffset: { y: scrollY } } }],
          {
            useNativeDriver: true,
            listener: (e: any) => {
              const y = e.nativeEvent.contentOffset.y;
              setIsCollapsed(y > COLLAPSE_THRESHOLD);
            },
          }
        )}
      >
        {/* ── Court Hero ── */}
        <View style={styles.heroCard}>
          <View style={styles.heroTopRow}>
            <View style={styles.sportTag}>
              <View style={[styles.sportDot, { backgroundColor: sportColor }]} />
              <Text style={[styles.sportText, { color: sportColor }]}>{localCourt.sport}</Text>
            </View>
            {activeCount > 0 && (
              <View style={styles.liveChip}>
                <LivePulse size={4} color={Colors.black} style={{ marginRight: 4 }} />
                <Text style={styles.liveChipText}>{activeCount} ON COURT</Text>
              </View>
            )}
          </View>

          <View style={[styles.courtAccentBar, { backgroundColor: sportColor }]} />
          <Text style={styles.courtName}>{localCourt.name.toUpperCase()}</Text>
          <Text style={styles.courtAddress}>
            {localCourt.neighborhood} · {localCourt.city}
          </Text>

          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.tagsScroll}
            contentContainerStyle={styles.tagsContent}
          >
            {localCourt.status === "community" && (
              <View style={styles.communityTag}>
                <View style={styles.communityDot} />
                <Text style={styles.communityTagText}>COMMUNITY COURT</Text>
              </View>
            )}
            {localCourt.status === "confirmed" && (
              <View style={styles.confirmedTag}>
                <View style={styles.confirmedRing} />
                <Text style={styles.confirmedTagText}>CONFIRMED</Text>
              </View>
            )}
            {localCourt.surface != null && (
              <View style={styles.tag}>
                <Text style={styles.tagText}>{localCourt.surface}</Text>
              </View>
            )}
            {localCourt.lights && (
              <View style={styles.tag}>
                <Text style={styles.tagText}>LIGHTS</Text>
              </View>
            )}
            {localCourt.covered && (
              <View style={styles.tag}>
                <Text style={styles.tagText}>COVERED</Text>
              </View>
            )}
            <View style={styles.tag}>
              <Text style={styles.tagText}>
                {localCount} LOCAL{localCount !== 1 ? "S" : ""}
              </Text>
            </View>
          </ScrollView>
        </View>

        {/* ── Check In ── */}
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
          >
            <Text style={styles.viewBtnText}>VIEW</Text>
          </Pressable>
        </View>

        {/* ── Who's Here ── */}
        {activeCount > 0 && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>WHO'S HERE</Text>
              <Text style={styles.sectionAccent}>{activeCount} ACTIVE</Text>
            </View>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.rosterRow}
            >
              {sortedPlayers.map((p) => {
                const isFriendStatus = isFriend(p.id);
                return (
                  <Pressable
                    key={p.id}
                    style={styles.rosterItem}
                    onPress={() => router.push(`/player/${p.id}`)}
                  >
                    <View>
                      <PlayerAvatar initials={p.avatar} size={40} />
                      {isFriendStatus && (
                        <View style={styles.friendDot} />
                      )}
                    </View>
                    <Text style={[styles.rosterName, isFriendStatus && styles.rosterNameFriend]}>
                      {p.avatar}
                    </Text>
                    <Text style={styles.rosterElo}>{p.elo}</Text>
                    {isFriendStatus && (
                      <Text style={styles.friendLabel}>FRIEND</Text>
                    )}
                  </Pressable>
                );
              })}
              {overflowCount > 0 && (
                <View style={styles.rosterItem}>
                  <View style={styles.rosterMore}>
                    <Text style={styles.rosterMoreText}>+{overflowCount}</Text>
                  </View>
                </View>
              )}
            </ScrollView>
          </View>
        )}


        {/* ── Upcoming Run ── */}
        {courtRuns.length > 0 && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>NEXT RUN</Text>
            </View>
            {courtRuns.slice(0, 1).map((run) => (
              <Pressable
                key={run.id}
                style={({ pressed }) => [styles.runCard, pressed && styles.pressed]}
                onPress={() => router.push(`/run/${run.id}`)}
              >
                <View style={styles.runCardLeft}>
                  <Text style={styles.runTitle}>{run.title}</Text>
                  <Text style={styles.runMeta}>
                    {run.date} · {run.time} · {run.skillLevel}
                  </Text>
                </View>
                <View style={styles.runPlayers}>
                  <Text style={styles.runPlayerCount}>
                    {run.teamA.filter(Boolean).length + run.teamB.filter(Boolean).length}
                    <Text style={styles.runPlayerMax}>/{run.maxPlayers}</Text>
                  </Text>
                  <Text style={styles.runPlayersLabel}>IN</Text>
                </View>
              </Pressable>
            ))}
          </View>
        )}

        {/* ── Recent Activity ── */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>RECENT ACTIVITY</Text>
          </View>
          {courtFeed.length === 0 ? (
            <Text style={styles.emptyText}>No activity yet. Be the first.</Text>
          ) : (
            courtFeed.map((item) => {
              const isWin =
                item.message.includes("WON") || item.message.includes("WIN");
              const isLoss =
                item.message.includes("LOST") || item.message.includes("LOSS");
              const barColor = isWin
                ? Colors.win
                : isLoss
                ? Colors.loss
                : Colors.accent;
              return (
                <View key={item.id} style={styles.feedItem}>
                  <View style={[styles.feedBar, { backgroundColor: barColor }]} />
                  <View style={styles.feedContent}>
                    <Text style={styles.feedMessage}>{item.message}</Text>
                    <Text style={styles.feedTime}>{item.timestamp}</Text>
                  </View>
                </View>
              );
            })
          )}
        </View>
      </Animated.ScrollView>
    </View>
  );
}

function NoCourtState({ topPad, isSignedIn }: { topPad: number; isSignedIn: boolean }) {
  if (isSignedIn) {
    // Signed in but no local court set yet → focused CTA
    return (
      <View style={styles.container}>
        <View style={[styles.header, { paddingTop: topPad + 12 }]}>
          <View>
            <Text style={styles.headerEyebrow}>LOCALCHECK</Text>
            <Text style={styles.headerBrand}>HOME</Text>
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

  // ── Collapsed sticky header ──
  collapsedHeader: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    zIndex: 20,
    backgroundColor: "rgba(13,13,16,0.94)",
    borderBottomWidth: 0.5,
    borderBottomColor: Colors.border,
    paddingHorizontal: 20,
    paddingBottom: 10,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  collapsedCourtName: {
    fontFamily: Typography.heading,
    fontSize: 14,
    color: Colors.white,
    letterSpacing: 0.5,
    flex: 1,
  },
  collapsedCenter: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },
  collapsedActiveCount: {
    fontFamily: Typography.heading,
    fontSize: 16,
    color: Colors.accent,
    letterSpacing: 0.5,
  },
  collapsedRight: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-end",
    gap: 8,
  },
  collapsedWeather: {
    fontFamily: Typography.bodyMedium,
    fontSize: 11,
    color: Colors.muted,
  },
  collapsedSportTag: {
    borderWidth: 1,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  collapsedSportText: {
    fontFamily: Typography.heading,
    fontSize: 10,
    letterSpacing: 1,
  },

  // ── Expanded header ──
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-end",
    paddingHorizontal: 20,
    paddingBottom: 14,
    backgroundColor: Colors.surface,
    borderBottomWidth: 0.5,
    borderBottomColor: Colors.border,
  },
  headerEyebrow: {
    fontFamily: Typography.bodyBold,
    fontSize: 9,
    color: Colors.accent,
    letterSpacing: 2.5,
    textTransform: "uppercase" as const,
    marginBottom: 3,
  },
  headerBrand: {
    fontFamily: Typography.heading,
    fontSize: 32,
    color: Colors.text,
    letterSpacing: 0.5,
    lineHeight: 34,
  },
  weatherText: {
    fontFamily: Typography.bodyMedium,
    fontSize: 12,
    color: Colors.muted,
    paddingBottom: 4,
  },

  // ── Hero ──
  heroCard: {
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 14,
    borderBottomWidth: 0.5,
    borderBottomColor: Colors.border,
    backgroundColor: Colors.surface,
  },
  heroTopRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 10,
  },
  sportTag: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },
  sportDot: { width: 6, height: 6, borderRadius: 3 },
  sportText: {
    fontFamily: Typography.bodyBold,
    fontSize: 10,
    letterSpacing: 2,
    textTransform: "uppercase" as const,
  },
  liveChip: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: Colors.accent,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: Radius.xs,
  },
  liveChipText: {
    fontFamily: Typography.bodyBold,
    fontSize: 9,
    color: Colors.black,
    letterSpacing: 1.5,
    textTransform: "uppercase" as const,
  },
  courtAccentBar: {
    height: 2,
    width: 32,
    marginBottom: 8,
    borderRadius: 1,
  },
  courtName: {
    fontFamily: Typography.heading,
    fontSize: 30,
    color: Colors.text,
    letterSpacing: 0.5,
    lineHeight: 32,
    marginBottom: 4,
  },
  courtAddress: {
    fontFamily: Typography.body,
    fontSize: 13,
    color: Colors.muted,
    marginBottom: 14,
  },
  tagsScroll: { marginBottom: 2 },
  tagsContent: { gap: 6 },
  tag: {
    borderWidth: 0.5,
    borderColor: Colors.border,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: Radius.xs,
  },
  tagText: {
    fontFamily: Typography.bodyMedium,
    fontSize: 9,
    color: Colors.muted,
    letterSpacing: 1,
    textTransform: "uppercase" as const,
  },
  communityTag: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    borderWidth: 0.5,
    borderColor: Colors.textSecondary,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: Radius.xs,
  },
  communityDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: Colors.textSecondary,
  },
  communityTagText: {
    fontFamily: Typography.bodyBold,
    fontSize: 9,
    color: Colors.textSecondary,
    letterSpacing: 1.2,
    textTransform: "uppercase" as const,
  },
  confirmedTag: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    borderWidth: 0.5,
    borderColor: "rgba(255,255,255,0.3)",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: Radius.xs,
  },
  confirmedRing: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    borderWidth: 1.5,
    borderColor: "rgba(255,255,255,0.5)",
  },
  confirmedTagText: {
    fontFamily: Typography.bodyBold,
    fontSize: 9,
    color: Colors.muted,
    letterSpacing: 1.2,
    textTransform: "uppercase" as const,
  },

  // ── Check In ──
  checkInRow: {
    flexDirection: "row",
    gap: 10,
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: 0.5,
    borderBottomColor: Colors.border,
  },
  checkInBtn: { flex: 3 },
  viewBtn: {
    flex: 1,
    borderWidth: 0.5,
    borderColor: Colors.border,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: Colors.surface,
  },
  viewBtnText: {
    fontFamily: Typography.heading,
    fontSize: 13,
    color: Colors.muted,
    letterSpacing: 1.5,
  },

  // ── Section ──
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
  sectionAccent: {
    fontFamily: Typography.bodyBold,
    fontSize: 10,
    color: Colors.accent,
    letterSpacing: 1.5,
    textTransform: "uppercase" as const,
  },

  // ── Roster ──
  rosterRow: { gap: 12, paddingVertical: 2 },
  rosterItem: { alignItems: "center" },
  rosterName: {
    fontFamily: Typography.bodyBold,
    fontSize: 9,
    color: Colors.text,
    marginTop: 5,
    letterSpacing: 0.5,
  },
  rosterNameFriend: {
    color: Colors.win,
  },
  rosterElo: {
    fontFamily: Typography.heading,
    fontSize: 11,
    color: Colors.muted,
    marginTop: 1,
  },
  friendDot: {
    position: "absolute" as any,
    bottom: -1,
    right: -1,
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: Colors.win,
    borderWidth: 1.5,
    borderColor: Colors.background,
  },
  friendLabel: {
    fontFamily: Typography.bodyBold,
    fontSize: 7,
    color: Colors.win,
    letterSpacing: 1,
    marginTop: 2,
  },
  rosterMore: {
    width: 40,
    height: 40,
    borderWidth: 0.5,
    borderColor: Colors.border,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: Radius.xs,
    marginTop: 0,
  },
  rosterMoreText: {
    fontFamily: Typography.heading,
    fontSize: 11,
    color: Colors.muted,
  },

  // ── Court Details ──
  detailsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    borderWidth: 0.5,
    borderColor: Colors.border,
  },
  detailCell: {
    width: "50%",
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderBottomWidth: 0.5,
    borderBottomColor: Colors.border,
  },
  detailCellRight: {
    borderLeftWidth: 0.5,
    borderLeftColor: Colors.border,
  },
  detailCellLast: {
    borderBottomWidth: 0,
  },
  detailValue: {
    fontFamily: Typography.heading,
    fontSize: 14,
    color: Colors.text,
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  detailLabel: {
    fontFamily: Typography.bodyMedium,
    fontSize: 9,
    color: Colors.muted,
    letterSpacing: 1.5,
    textTransform: "uppercase" as const,
  },

  // ── Run Card ──
  runCard: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    borderWidth: 0.5,
    borderColor: Colors.border,
    padding: 14,
    backgroundColor: Colors.surface,
  },
  pressed: { backgroundColor: Colors.surfaceHigh },
  runCardLeft: { flex: 1 },
  runTitle: {
    fontFamily: Typography.heading,
    fontSize: 16,
    color: Colors.text,
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  runMeta: {
    fontFamily: Typography.bodyMedium,
    fontSize: 11,
    color: Colors.muted,
    letterSpacing: 0.5,
  },
  runPlayers: { alignItems: "center", paddingLeft: 14 },
  runPlayerCount: {
    fontFamily: Typography.heading,
    fontSize: 22,
    color: Colors.text,
    lineHeight: 24,
  },
  runPlayerMax: {
    fontFamily: Typography.heading,
    fontSize: 14,
    color: Colors.muted,
  },
  runPlayersLabel: {
    fontFamily: Typography.bodyMedium,
    fontSize: 8,
    color: Colors.muted,
    letterSpacing: 1.5,
    textTransform: "uppercase" as const,
    marginTop: 2,
  },

  // ── Activity Feed ──
  feedItem: {
    flexDirection: "row",
    paddingVertical: 12,
    borderBottomWidth: 0.5,
    borderBottomColor: Colors.border,
  },
  feedBar: {
    width: 2.5,
    marginRight: 12,
    borderRadius: 1,
  },
  feedContent: { flex: 1 },
  feedMessage: {
    fontFamily: Typography.bodyMedium,
    fontSize: 12,
    color: Colors.text,
    letterSpacing: 0.2,
    lineHeight: 18,
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
    letterSpacing: 1,
    textTransform: "uppercase" as const,
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
