import * as Haptics from "expo-haptics";
import { router } from "expo-router";
import React, { useEffect, useRef, useState } from "react";
import {
  Animated,
  Dimensions,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Colors, Radius } from "@/constants/colors";
import { Court, getSportColor, Player } from "@/constants/data";
import { Typography } from "@/constants/typography";
import { useApp } from "@/context/AppContext";
import { fetchActiveCheckIns } from "@/services/checkInService";
import { BrutalistButton } from "./BrutalistButton";
import { LivePulse } from "./LivePulse";
import { PlayerAvatar } from "./PlayerAvatar";
import { StatBlock } from "./StatBlock";

interface CourtBottomSheetProps {
  court: Court | null;
  onClose: () => void;
}

const SCREEN_HEIGHT = Dimensions.get("window").height;

/**
 * Full-screen court takeover, slid up from the bottom. Shows the same view the
 * home screen gives a local court — hero, live roster, next run, check-in —
 * for ANY court tapped from Explore/Map, without ever changing the home page
 * (home always stays the user's local court).
 */
export function CourtBottomSheet({ court, onClose }: CourtBottomSheetProps) {
  const { checkIn, checkedInCourtId, checkOut, setLocalCourt, localCourtId, runs, isFriend } = useApp();
  const { top, bottom } = useSafeAreaInsets();
  // Real live roster for this court — never render placeholder players
  const [roster, setRoster] = useState<Player[]>([]);
  useEffect(() => {
    let live = true;
    if (court?.id) {
      fetchActiveCheckIns(court.id).then((players) => {
        if (live) setRoster(players);
      });
    } else {
      setRoster([]);
    }
    return () => {
      live = false;
    };
  }, [court?.id, checkedInCourtId]);
  const slideAnim = useRef(new Animated.Value(SCREEN_HEIGHT)).current;
  const backdropOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (court) {
      Animated.parallel([
        Animated.spring(slideAnim, {
          toValue: 0,
          tension: 65,
          friction: 12,
          useNativeDriver: true,
        }),
        Animated.timing(backdropOpacity, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(slideAnim, {
          toValue: SCREEN_HEIGHT,
          duration: 220,
          useNativeDriver: true,
        }),
        Animated.timing(backdropOpacity, {
          toValue: 0,
          duration: 180,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [court]);

  if (!court) return null;

  const isCheckedIn = checkedInCourtId === court.id;
  const isMyLocal = localCourtId === court.id;
  const sportColor = getSportColor(court.sport);
  const activeCount = roster.length;
  const courtRuns = runs.filter((r) => r.courtId === court.id);
  const topPad = Platform.OS === "web" ? 24 : top;

  const handleCheckIn = async () => {
    if (isCheckedIn) {
      await checkOut();
    } else {
      await checkIn(court.id);
      if (Platform.OS !== "web") {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
    }
  };

  return (
    <>
      <Animated.View style={[styles.backdrop, { opacity: backdropOpacity }]}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
      </Animated.View>

      <Animated.View
        style={[styles.container, { transform: [{ translateY: slideAnim }] }]}
      >
        {/* ── Top bar ── */}
        <View style={[styles.topBar, { paddingTop: topPad + 10 }]}>
          <View style={styles.handle} />
          <Pressable onPress={onClose} style={styles.closeBtn} hitSlop={16} testID="court-sheet-close">
            <Text style={styles.closeBtnText}>✕</Text>
          </Pressable>
        </View>

        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: 120 }}
        >
          {/* ── Court Hero (mirrors the home screen's local-court hero) ── */}
          <View style={styles.heroCard}>
            <View style={styles.heroTopRow}>
              <View style={styles.sportTag}>
                <View style={[styles.sportDot, { backgroundColor: sportColor }]} />
                <Text style={[styles.sportText, { color: sportColor }]}>{court.sport}</Text>
              </View>
              {activeCount > 0 && (
                <View style={styles.liveChip}>
                  <LivePulse size={4} color={Colors.black} style={{ marginRight: 4 }} />
                  <Text style={styles.liveChipText}>{activeCount} ON COURT</Text>
                </View>
              )}
            </View>

            <View style={[styles.courtAccentBar, { backgroundColor: sportColor }]} />
            <Text style={styles.courtName}>{court.name.toUpperCase()}</Text>
            <Text style={styles.courtAddress}>
              {court.neighborhood}{court.city ? ` · ${court.city}` : ""}
            </Text>

            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={styles.tagsScroll}
              contentContainerStyle={styles.tagsContent}
            >
              {isMyLocal && (
                <View style={styles.myLocalTag}>
                  <Text style={styles.myLocalTagText}>★ MY LOCAL</Text>
                </View>
              )}
              {court.status === "community" && (
                <View style={styles.communityTag}>
                  <View style={styles.communityDot} />
                  <Text style={styles.communityTagText}>COMMUNITY</Text>
                </View>
              )}
              {court.status === "confirmed" && (
                <View style={styles.confirmedTag}>
                  <View style={styles.confirmedRing} />
                  <Text style={styles.confirmedTagText}>CONFIRMED</Text>
                </View>
              )}
              {court.surface != null && (
                <View style={styles.tag}>
                  <Text style={styles.tagText}>{court.surface}</Text>
                </View>
              )}
              {court.lights && (
                <View style={styles.tag}>
                  <Text style={styles.tagText}>LIGHTS</Text>
                </View>
              )}
              {court.localCount != null && (
                <View style={styles.tag}>
                  <Text style={styles.tagText}>
                    {court.localCount} LOCAL{court.localCount !== 1 ? "S" : ""}
                  </Text>
                </View>
              )}
            </ScrollView>
          </View>

          {/* ── Stats ── */}
          <View style={styles.statsRow}>
            <StatBlock value={activeCount} label="On Court" />
            <View style={styles.statDiv} />
            <StatBlock value={court.ratingCount ?? 0} label="Visits" />
            <View style={styles.statDiv} />
            <StatBlock value={court.localCount ?? 0} label="Locals" />
          </View>

          {/* ── Who's Here ── */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>WHO'S HERE</Text>
              {activeCount > 0 && <Text style={styles.sectionAccent}>{activeCount} ACTIVE</Text>}
            </View>
            {activeCount === 0 ? (
              <Text style={styles.emptyText}>NO PLAYERS CHECKED IN YET</Text>
            ) : (
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.rosterRow}
              >
                {roster.map((p) => {
                  const isFriendStatus = isFriend(p.id);
                  return (
                    <Pressable
                      key={p.id}
                      style={styles.rosterItem}
                      onPress={() => {
                        onClose();
                        router.push(`/player/${p.id}`);
                      }}
                    >
                      <View>
                        <PlayerAvatar initials={p.avatar} size={40} />
                        {isFriendStatus && <View style={styles.friendDot} />}
                      </View>
                      <Text style={styles.rosterName}>{p.name.split(" ")[0].toUpperCase()}</Text>
                      <Text style={styles.rosterElo}>{p.elo}</Text>
                    </Pressable>
                  );
                })}
              </ScrollView>
            )}
          </View>

          {/* ── Next Run at this court ── */}
          {courtRuns.length > 0 && (
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>NEXT RUN</Text>
              </View>
              {courtRuns.slice(0, 2).map((run) => (
                <Pressable
                  key={run.id}
                  style={({ pressed }) => [styles.runRow, pressed && styles.pressed]}
                  onPress={() => {
                    onClose();
                    router.push(`/run/${run.id}`);
                  }}
                >
                  <View style={styles.runRowLeft}>
                    <Text style={styles.runTitle}>{run.title}</Text>
                    <Text style={styles.runMeta}>
                      {run.date} · {run.time}
                    </Text>
                  </View>
                  <Text style={styles.runCount}>
                    {run.participants.length}/{run.maxPlayers}
                  </Text>
                </Pressable>
              ))}
            </View>
          )}

          {/* ── Full profile link ── */}
          <Pressable
            style={({ pressed }) => [styles.profileLink, pressed && styles.pressed]}
            onPress={() => {
              onClose();
              router.push(`/court/${court.id}`);
            }}
          >
            <Text style={styles.profileLinkText}>FULL COURT PROFILE</Text>
            <Text style={styles.profileLinkArrow}>→</Text>
          </Pressable>
        </ScrollView>

        {/* ── Pinned Actions ── */}
        <View style={[styles.actions, { paddingBottom: (Platform.OS === "web" ? 24 : bottom) + 12 }]}>
          <BrutalistButton
            label={isCheckedIn ? "CHECKED IN ✓" : "CHECK IN"}
            onPress={handleCheckIn}
            variant={isCheckedIn ? "outline" : "accent"}
            style={styles.checkInBtn}
            testID="check-in-btn"
          />
          <BrutalistButton
            label={isMyLocal ? "MY LOCAL ★" : "SET LOCAL"}
            onPress={() => setLocalCourt(isMyLocal ? null : court.id, isMyLocal ? undefined : court)}
            variant={isMyLocal ? "accent" : "dark"}
            style={styles.localBtn}
          />
        </View>
      </Animated.View>
    </>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.45)",
    zIndex: 99,
  },
  // Full-screen takeover — the sheet covers the whole screen when open.
  container: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: Colors.background,
    zIndex: 100,
  },
  topBar: {
    backgroundColor: Colors.surface,
    borderBottomWidth: 0.5,
    borderBottomColor: Colors.border,
    paddingBottom: 8,
    alignItems: "center",
  },
  handle: {
    width: 36,
    height: 3,
    backgroundColor: Colors.border,
    borderRadius: 2,
  },
  closeBtn: {
    position: "absolute",
    right: 16,
    bottom: 6,
    padding: 4,
  },
  closeBtnText: {
    fontFamily: Typography.bodyBold,
    fontSize: 16,
    color: Colors.muted,
  },

  // ── Hero (matches HomeScreen's hero card idiom) ──
  heroCard: {
    backgroundColor: Colors.black,
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 16,
    borderBottomWidth: 0.5,
    borderBottomColor: Colors.border,
  },
  heroTopRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  sportTag: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },
  sportDot: { width: 6, height: 6, borderRadius: 3 },
  sportText: {
    fontFamily: Typography.bodyMedium,
    fontSize: 10,
    letterSpacing: 1.5,
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
  },
  courtAccentBar: { width: 40, height: 3, marginBottom: 10 },
  courtName: {
    fontFamily: Typography.heading,
    fontSize: 30,
    color: Colors.white,
    lineHeight: 34,
    letterSpacing: 0.5,
  },
  courtAddress: {
    fontFamily: Typography.body,
    fontSize: 12,
    color: Colors.mutedDark,
    marginTop: 4,
  },
  tagsScroll: { marginTop: 12 },
  tagsContent: { gap: 6 },
  myLocalTag: {
    backgroundColor: Colors.accentDim,
    borderWidth: 0.5,
    borderColor: Colors.accent,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: Radius.xs,
  },
  myLocalTagText: {
    fontFamily: Typography.bodyBold,
    fontSize: 9,
    color: Colors.accent,
    letterSpacing: 1.2,
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
    width: 6,
    height: 6,
    borderRadius: 3,
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

  // ── Stats ──
  statsRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: Colors.surface,
    borderBottomWidth: 0.5,
    borderColor: Colors.border,
    paddingVertical: 14,
  },
  statDiv: { width: 0.5, height: 28, backgroundColor: Colors.border },

  // ── Sections ──
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
    marginBottom: 12,
  },
  sectionTitle: {
    fontFamily: Typography.heading,
    fontSize: 12,
    color: Colors.text,
    letterSpacing: 3,
  },
  sectionAccent: {
    fontFamily: Typography.bodyBold,
    fontSize: 9,
    color: Colors.accent,
    letterSpacing: 1.5,
  },
  emptyText: {
    fontFamily: Typography.bodyMedium,
    fontSize: 11,
    color: Colors.muted,
    letterSpacing: 1,
  },
  rosterRow: { gap: 14 },
  rosterItem: { alignItems: "center", width: 56 },
  friendDot: {
    position: "absolute",
    top: 0,
    right: 0,
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: Colors.win,
    borderWidth: 2,
    borderColor: Colors.background,
  },
  rosterName: {
    fontFamily: Typography.bodyBold,
    fontSize: 9,
    color: Colors.text,
    letterSpacing: 0.5,
    marginTop: 6,
  },
  rosterElo: {
    fontFamily: Typography.heading,
    fontSize: 10,
    color: Colors.muted,
    marginTop: 1,
  },

  // ── Runs ──
  runRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    borderWidth: 0.5,
    borderColor: Colors.border,
    backgroundColor: Colors.surface,
    padding: 14,
    borderRadius: Radius.xs,
    marginBottom: 8,
  },
  pressed: { backgroundColor: Colors.surfaceHigh },
  runRowLeft: { flex: 1 },
  runTitle: {
    fontFamily: Typography.heading,
    fontSize: 14,
    color: Colors.text,
    letterSpacing: 0.3,
  },
  runMeta: {
    fontFamily: Typography.body,
    fontSize: 11,
    color: Colors.muted,
    marginTop: 2,
  },
  runCount: {
    fontFamily: Typography.heading,
    fontSize: 16,
    color: Colors.text,
  },

  // ── Full profile link ──
  profileLink: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginHorizontal: 20,
    marginTop: 20,
    padding: 14,
    borderWidth: 0.5,
    borderColor: Colors.border,
    backgroundColor: Colors.surface,
    borderRadius: Radius.xs,
  },
  profileLinkText: {
    fontFamily: Typography.heading,
    fontSize: 12,
    color: Colors.text,
    letterSpacing: 2,
  },
  profileLinkArrow: {
    fontFamily: Typography.heading,
    fontSize: 16,
    color: Colors.muted,
  },

  // ── Pinned Actions ──
  actions: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: "row",
    gap: 10,
    paddingHorizontal: 20,
    paddingTop: 12,
    backgroundColor: Colors.surface,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  checkInBtn: { flex: 2 },
  localBtn: { flex: 1.5 },
});
