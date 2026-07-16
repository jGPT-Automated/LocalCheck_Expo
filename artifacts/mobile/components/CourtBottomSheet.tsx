import * as Haptics from "expo-haptics";
import { router } from "expo-router";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  Animated,
  Dimensions,
  Modal,
  PanResponder,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Colors, Radius } from "@/constants/colors";
import { Court, getSportColor } from "@/constants/data";
import { Typography } from "@/constants/typography";
import { useApp } from "@/context/AppContext";
import { usePresence } from "@/context/CourtPresenceContext";
import { AnimatedEntry } from "./AnimatedEntry";
import { BrutalistButton } from "./BrutalistButton";
import { LivePulse } from "./LivePulse";
import { PlayerAvatar } from "./PlayerAvatar";
import { StatBlock } from "./StatBlock";

interface CourtBottomSheetProps {
  court: Court | null;
  onClose: () => void;
}

const SCREEN_HEIGHT = Dimensions.get("window").height;
const PEEK_HEIGHT = Math.min(360, Math.round(SCREEN_HEIGHT * 0.42));
const SNAP_FULL = 0;
const SNAP_PEEK = SCREEN_HEIGHT - PEEK_HEIGHT;
const SNAP_CLOSED = SCREEN_HEIGHT;

type SheetMode = "peek" | "full";

function clamp(v: number, lo: number, hi: number) {
  return Math.min(hi, Math.max(lo, v));
}

/**
 * Gesture-driven court drawer (see DESIGN.md §5/§6).
 *
 * Tap a court → PEEK (~40% screen): name, distance, on-court + locals counts,
 * CHECK IN, swipe-up affordance. Swipe up — or check in — and it expands to
 * the FULL view (roster, pulling-up-today, runs, details), the same experience
 * home gives a local court. Drag is interruptible with velocity handoff; the
 * sheet renders in a Modal so its actions can never sit behind the tab bar.
 */
export function CourtBottomSheet({ court, onClose }: CourtBottomSheetProps) {
  const { checkIn, checkedInCourtId, checkOut, setLocalCourt, localCourtId, runs, plannedVisits, isFriend } = useApp();
  const { top, bottom } = useSafeAreaInsets();

  // Keep our own copy so the exit animation can play after the parent clears
  // `court`. Content updates in place when the same sheet shows a new court.
  const [renderedCourt, setRenderedCourt] = useState<Court | null>(court);
  const [mode, setMode] = useState<SheetMode>("peek");
  const modeRef = useRef<SheetMode>("peek");
  modeRef.current = mode;

  const { roster, localCount: liveLocalCount } = usePresence(renderedCourt?.id);

  const translateY = useRef(new Animated.Value(SNAP_CLOSED)).current;
  const dragStartY = useRef(SNAP_CLOSED);
  const closingRef = useRef(false);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  const snapTo = useCallback(
    (target: number, velocity = 0) => {
      if (target === SNAP_FULL) setMode("full");
      else if (target === SNAP_PEEK) setMode("peek");
      Animated.spring(translateY, {
        toValue: target,
        velocity,
        tension: 68,
        friction: 11,
        useNativeDriver: true,
      }).start();
    },
    [translateY]
  );

  const animateClosed = useCallback(
    (velocity = 0, notifyParent = true) => {
      if (closingRef.current) return;
      closingRef.current = true;
      Animated.timing(translateY, {
        toValue: SNAP_CLOSED,
        duration: 200,
        useNativeDriver: true,
      }).start(() => {
        closingRef.current = false;
        setRenderedCourt(null);
        setMode("peek");
        if (notifyParent) onCloseRef.current();
      });
    },
    [translateY]
  );

  // Open / switch / external close.
  const prevIdRef = useRef<string | null>(null);
  useEffect(() => {
    const id = court?.id ?? null;
    if (id && id !== prevIdRef.current) {
      setRenderedCourt(court);
      if (prevIdRef.current === null) {
        // Fresh open → land on PEEK.
        setMode("peek");
        translateY.setValue(SNAP_CLOSED);
        snapTo(SNAP_PEEK);
      }
      // Same sheet, different court → keep current mode/position.
    } else if (id && court) {
      // Same court, refreshed object (live count overlays) → update content only.
      setRenderedCourt(court);
    } else if (!id && prevIdRef.current !== null && renderedCourt) {
      animateClosed(0, false);
    }
    prevIdRef.current = id;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [court]);

  // Release chooses the snap the gesture is "throwing" toward: project the
  // position ~150ms ahead using release velocity, then take the nearest snap.
  const settle = useCallback(
    (pos: number, vy: number) => {
      const projected = pos + vy * 150;
      const targets = [SNAP_FULL, SNAP_PEEK, SNAP_CLOSED];
      const target = targets.reduce((best, t) =>
        Math.abs(t - projected) < Math.abs(best - projected) ? t : best
      );
      if (target === SNAP_CLOSED) animateClosed(vy);
      else snapTo(target, vy);
    },
    [animateClosed, snapTo]
  );

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onMoveShouldSetPanResponder: (_evt, g) =>
        Math.abs(g.dy) > 8 && Math.abs(g.dy) > Math.abs(g.dx) * 1.2,
      onPanResponderGrant: () => {
        // Interruptible: grab the sheet wherever it currently is.
        translateY.stopAnimation((v) => {
          dragStartY.current = v;
        });
      },
      onPanResponderMove: (_evt, g) => {
        translateY.setValue(clamp(dragStartY.current + g.dy, SNAP_FULL, SNAP_CLOSED));
      },
      onPanResponderRelease: (_evt, g) => {
        const pos = clamp(dragStartY.current + g.dy, SNAP_FULL, SNAP_CLOSED);
        settle(pos, g.vy * 1000); // px/s
      },
    })
  ).current;

  const backdropOpacity = translateY.interpolate({
    inputRange: [SNAP_FULL, SNAP_PEEK, SNAP_CLOSED],
    outputRange: [1, 0.65, 0],
  });

  if (!renderedCourt) {
    return null;
  }
  const c = renderedCourt;

  const isCheckedIn = checkedInCourtId === c.id;
  const isMyLocal = localCourtId === c.id;
  const sportColor = getSportColor(c.sport);
  const activeCount = roster.length;
  const courtRuns = runs.filter((r) => r.courtId === c.id);
  const todayStr = new Date().toDateString();
  const courtVisitsToday = plannedVisits.filter(
    (v) => v.courtId === c.id && new Date(v.plannedAtIso).toDateString() === todayStr
  );
  const topPad = Platform.OS === "web" ? 24 : top;
  const distanceLabel =
    c.distanceKm != null ? `${(c.distanceKm * 0.621371).toFixed(1)} MI` : null;

  const handleCheckIn = async () => {
    if (isCheckedIn) {
      await checkOut();
      return;
    }
    await checkIn(c.id);
    if (Platform.OS !== "web") {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }
    // Checking in commits you to this court — open the full experience.
    if (modeRef.current === "peek") snapTo(SNAP_FULL);
  };

  const goTo = (path: string) => {
    animateClosed();
    router.push(path as never);
  };

  return (
    <Modal
      visible
      transparent
      animationType="none"
      statusBarTranslucent
      onRequestClose={() => animateClosed()}
    >
      <Animated.View style={[styles.backdrop, { opacity: backdropOpacity }]}>
        <Pressable style={StyleSheet.absoluteFill} onPress={() => animateClosed()} />
      </Animated.View>

      <Animated.View
        style={[styles.container, { transform: [{ translateY }] }]}
        {...(mode === "peek" ? panResponder.panHandlers : {})}
      >
        {/* ── Grab bar (always draggable) ── */}
        <View
          style={[styles.topBar, mode === "full" && { paddingTop: topPad + 10 }]}
          {...panResponder.panHandlers}
        >
          <View style={styles.handle} />
          {mode === "full" && (
            <Pressable onPress={() => animateClosed()} style={styles.closeBtn} hitSlop={16} testID="court-sheet-close">
              <Text style={styles.closeBtnText}>✕</Text>
            </Pressable>
          )}
        </View>

        {mode === "peek" ? (
          /* ── PEEK: high-level card ── */
          <View style={[styles.peekBody, { paddingBottom: (Platform.OS === "web" ? 24 : bottom) + 10 }]}>
            <View style={styles.peekHeader}>
              <View style={{ flex: 1, paddingRight: 12 }}>
                <View style={styles.sportTag}>
                  <View style={[styles.sportDot, { backgroundColor: sportColor }]} />
                  <Text style={[styles.sportText, { color: sportColor }]}>{c.sport}</Text>
                  {distanceLabel && <Text style={styles.peekDistance}> · {distanceLabel}</Text>}
                </View>
                <Text style={styles.peekName} numberOfLines={2}>{c.name.toUpperCase()}</Text>
              </View>
              {activeCount > 0 && (
                <View style={styles.liveChip}>
                  <LivePulse size={4} color={Colors.black} style={{ marginRight: 4 }} />
                  <Text style={styles.liveChipText}>LIVE</Text>
                </View>
              )}
            </View>

            <View style={styles.peekStatsRow}>
              <View style={styles.peekStat}>
                <Text style={[styles.peekStatValue, activeCount > 0 && { color: Colors.accent }]}>
                  {activeCount}
                </Text>
                <Text style={styles.peekStatLabel}>ON COURT</Text>
              </View>
              <View style={styles.statDiv} />
              <View style={styles.peekStat}>
                <Text style={styles.peekStatValue}>{liveLocalCount}</Text>
                <Text style={styles.peekStatLabel}>LOCALS</Text>
              </View>
              <View style={styles.statDiv} />
              <View style={styles.peekStat}>
                <Text style={styles.peekStatValue}>{c.ratingCount ?? 0}</Text>
                <Text style={styles.peekStatLabel}>VISITS</Text>
              </View>
            </View>

            <BrutalistButton
              label={isCheckedIn ? "CHECKED IN ✓" : "CHECK IN"}
              onPress={handleCheckIn}
              variant={isCheckedIn ? "outline" : "accent"}
              testID="check-in-btn"
            />
            <Pressable onPress={() => snapTo(SNAP_FULL)} hitSlop={10} style={styles.peekMore}>
              <Text style={styles.peekMoreText}>SWIPE UP FOR DETAILS</Text>
              <Text style={styles.peekMoreArrow}>↑</Text>
            </Pressable>
          </View>
        ) : (
          /* ── FULL: the whole court experience ── */
          <>
            <ScrollView
              showsVerticalScrollIndicator={false}
              contentContainerStyle={{ paddingBottom: 140 }}
            >
              {/* ── Court Hero (mirrors the home screen's local-court hero) ── */}
              <View style={styles.heroCard}>
                <View style={styles.heroTopRow}>
                  <View style={styles.sportTag}>
                    <View style={[styles.sportDot, { backgroundColor: sportColor }]} />
                    <Text style={[styles.sportText, { color: sportColor }]}>{c.sport}</Text>
                    {distanceLabel && <Text style={styles.peekDistance}> · {distanceLabel}</Text>}
                  </View>
                  {activeCount > 0 && (
                    <View style={styles.liveChip}>
                      <LivePulse size={4} color={Colors.black} style={{ marginRight: 4 }} />
                      <Text style={styles.liveChipText}>{activeCount} ON COURT</Text>
                    </View>
                  )}
                </View>

                <View style={[styles.courtAccentBar, { backgroundColor: sportColor }]} />
                <Text style={styles.courtName}>{c.name.toUpperCase()}</Text>
                <Text style={styles.courtAddress}>
                  {c.neighborhood}{c.city ? ` · ${c.city}` : ""}
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
                  {c.status === "community" && (
                    <View style={styles.communityTag}>
                      <View style={styles.communityDot} />
                      <Text style={styles.communityTagText}>COMMUNITY</Text>
                    </View>
                  )}
                  {c.status === "confirmed" && (
                    <View style={styles.confirmedTag}>
                      <View style={styles.confirmedRing} />
                      <Text style={styles.confirmedTagText}>CONFIRMED</Text>
                    </View>
                  )}
                  {c.surface != null && (
                    <View style={styles.tag}>
                      <Text style={styles.tagText}>{c.surface}</Text>
                    </View>
                  )}
                  {c.lights && (
                    <View style={styles.tag}>
                      <Text style={styles.tagText}>LIGHTS</Text>
                    </View>
                  )}
                  <View style={styles.tag}>
                    <Text style={styles.tagText}>
                      {liveLocalCount} LOCAL{liveLocalCount !== 1 ? "S" : ""}
                    </Text>
                  </View>
                </ScrollView>
              </View>

              {/* ── Stats ── */}
              <View style={styles.statsRow}>
                <StatBlock value={activeCount} label="On Court" />
                <View style={styles.statDiv} />
                <StatBlock value={c.ratingCount ?? 0} label="Visits" />
                <View style={styles.statDiv} />
                <StatBlock value={liveLocalCount} label="Locals" />
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
                        <AnimatedEntry key={p.id}>
                          <Pressable
                            style={styles.rosterItem}
                            onPress={() => goTo(`/player/${p.id}`)}
                          >
                            <View>
                              <PlayerAvatar initials={p.avatar} size={40} />
                              {isFriendStatus && <View style={styles.friendDot} />}
                            </View>
                            <Text style={styles.rosterName}>{p.name.split(" ")[0].toUpperCase()}</Text>
                            <Text style={styles.rosterElo}>{p.elo}</Text>
                          </Pressable>
                        </AnimatedEntry>
                      );
                    })}
                  </ScrollView>
                )}
              </View>

              {/* ── Pulling Up Today (planned presence) ── */}
              {courtVisitsToday.length > 0 && (
                <View style={styles.section}>
                  <View style={styles.sectionHeader}>
                    <Text style={styles.sectionTitle}>PULLING UP TODAY</Text>
                    <Text style={styles.sectionAccent}>{courtVisitsToday.length} COMING</Text>
                  </View>
                  {courtVisitsToday.map((visit) => (
                    <Pressable
                      key={visit.id}
                      style={styles.visitRow}
                      onPress={() => goTo(`/player/${visit.userId}`)}
                    >
                      <Text style={styles.visitTime}>{visit.time}</Text>
                      <PlayerAvatar initials={visit.player.avatar} size={26} />
                      <Text style={styles.visitName}>{visit.player.name.split(" ")[0].toUpperCase()}</Text>
                      {visit.note != null && (
                        <Text style={styles.visitNote} numberOfLines={1}>{visit.note}</Text>
                      )}
                    </Pressable>
                  ))}
                </View>
              )}

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
                      onPress={() => goTo(`/run/${run.id}`)}
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
                onPress={() => goTo(`/court/${c.id}`)}
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
                onPress={() => setLocalCourt(isMyLocal ? null : c.id, isMyLocal ? undefined : c)}
                variant={isMyLocal ? "accent" : "dark"}
                style={styles.localBtn}
              />
            </View>
          </>
        )}
      </Animated.View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.45)",
  },
  // Full-screen-height sheet; translateY positions it at peek/full/closed.
  container: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: Colors.background,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  topBar: {
    backgroundColor: Colors.surface,
    borderBottomWidth: 0.5,
    borderBottomColor: Colors.border,
    paddingTop: 10,
    paddingBottom: 8,
    alignItems: "center",
  },
  handle: {
    width: 36,
    height: 4,
    backgroundColor: Colors.muted,
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

  // ── Peek ──
  peekBody: {
    paddingHorizontal: 20,
    paddingTop: 14,
    gap: 14,
  },
  peekHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
  },
  peekName: {
    fontFamily: Typography.heading,
    fontSize: 24,
    color: Colors.white,
    lineHeight: 28,
    letterSpacing: 0.5,
    marginTop: 6,
  },
  peekDistance: {
    fontFamily: Typography.bodyMedium,
    fontSize: 10,
    color: Colors.muted,
    letterSpacing: 1,
  },
  peekStatsRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: Colors.surface,
    borderWidth: 0.5,
    borderColor: Colors.border,
    borderRadius: Radius.xs,
    paddingVertical: 12,
  },
  peekStat: { flex: 1, alignItems: "center" },
  peekStatValue: {
    fontFamily: Typography.heading,
    fontSize: 26,
    color: Colors.text,
    lineHeight: 28,
  },
  peekStatLabel: {
    fontFamily: Typography.bodyMedium,
    fontSize: 9,
    color: Colors.muted,
    letterSpacing: 1.5,
    marginTop: 2,
  },
  peekMore: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 6,
    paddingVertical: 4,
  },
  peekMoreText: {
    fontFamily: Typography.bodyMedium,
    fontSize: 10,
    color: Colors.muted,
    letterSpacing: 2,
  },
  peekMoreArrow: {
    fontFamily: Typography.bodyBold,
    fontSize: 12,
    color: Colors.accent,
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

  // ── Pulling Up ──
  visitRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 8,
    borderBottomWidth: 0.5,
    borderBottomColor: Colors.border,
  },
  visitTime: {
    fontFamily: Typography.heading,
    fontSize: 14,
    color: Colors.text,
    width: 48,
    fontVariant: ["tabular-nums"] as any,
  },
  visitName: {
    fontFamily: Typography.bodyBold,
    fontSize: 11,
    color: Colors.text,
    letterSpacing: 0.5,
  },
  visitNote: {
    flex: 1,
    fontFamily: Typography.body,
    fontSize: 10,
    color: Colors.muted,
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
