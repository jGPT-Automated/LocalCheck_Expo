import { BottomSheetView } from "@gorhom/bottom-sheet";
import { Feather } from "@expo/vector-icons";
import { BlurView } from "expo-blur";
import { LinearGradient } from "expo-linear-gradient";
import * as Haptics from "expo-haptics";
import { router } from "expo-router";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { AnimatedEntry } from "@/components/AnimatedEntry";
import { BrutalistButton } from "@/components/BrutalistButton";
import { LogoMark } from "@/components/brand/LogoMark";
import { PlayerAvatar } from "@/components/PlayerAvatar";
import { StatBlock } from "@/components/StatBlock";
import { PlayerSummaryRow } from "@/components/ui/PlayerSummaryRow";
import { SportEmblem } from "@/components/ui/SportEmblem";
import { Colors, Radius } from "@/constants/colors";
import { Court, getSportColor } from "@/constants/data";
import { Space } from "@/constants/layout";
import { Typography } from "@/constants/typography";
import { useApp } from "@/context/AppContext";
import { useAuth } from "@/context/AuthContext";
import { usePresence } from "@/context/CourtPresenceContext";
import { useLocalPlus } from "@/hooks/useLocalPlus";
import { useLocalPlusPurchase } from "@/hooks/useLocalPlusPurchase";
import { formatCooldownRemaining, getLocalCourtCooldown } from "@/lib/localCourtCooldown";
import { isInactiveLocal, relativeTime } from "@/lib/localPresence";
import { drawerDetailHeight } from "@/lib/courtDrawerLayout";
import { fetchCourtById } from "@/services/courtService";
import {
  fetchLocalsWithLastCheckIn,
  LocalWithLastCheckIn,
} from "@/services/profileService";

/**
 * Court drawer content, rendered inside the root BottomSheetModal
 * (see CourtSheetHost). Peek layer (40% snap): name, distance, live stats,
 * CHECK IN. Full (92%): WHO'S HERE roster, LOCALS list, pulling-up, runs,
 * in a fixed-height area that never scrolls: anything past it fades out
 * above VIEW ALL, which opens the full court page (or LocalPlus when gated).
 *
 * `onNavigate` dismisses the sheet before any router.push so the pushed
 * screen isn't buried under the modal.
 */
export function CourtSheetContent({
  courtId,
  distanceKm,
  onNavigate,
  onExpand,
  onPeekHeight,
}: {
  courtId: string;
  distanceKm?: number;
  onNavigate: () => void;
  onExpand: () => void;
  onPeekHeight: (height: number) => void;
}) {
  const {
    courts, localCourt, checkIn, checkOut, checkedInCourtId,
    localCourtId, runs, plannedVisits, isFriend, setLocalCourt,
  } = useApp();
  const { bottom } = useSafeAreaInsets();
  const { profile } = useAuth();
  const hasLocalPlus = useLocalPlus();
  const { height: windowHeight } = useWindowDimensions();
  const [peekHeight, setPeekHeight] = useState(0);

  const cached =
    courts.find((c) => c.id === courtId) ??
    (localCourt?.id === courtId ? localCourt : null);
  const [court, setCourt] = useState<Court | null>(cached);
  const [locals, setLocals] = useState<LocalWithLastCheckIn[]>([]);
  const { roster, localCount } = usePresence(courtId || null);

  useEffect(() => {
    if (!courtId) return;
    if (!court) {
      fetchCourtById(courtId).then((c) => c && setCourt(c));
    }
    fetchLocalsWithLastCheckIn(courtId).then(setLocals);
  }, [courtId, roster.length]); // re-pull locals when presence changes

  const go = (path: string) => {
    onNavigate();
    router.push(path as never);
  };

  if (!court) {
    return (
      <View style={styles.loading}>
        <Text style={styles.emptyText}>LOADING…</Text>
      </View>
    );
  }

  const isCheckedIn = checkedInCourtId === court.id;
  const isMyLocal = localCourtId === court.id;
  // Same rule as app/court/[id].tsx's full-page gate — your own local court
  // always stays free, every other court's player-level detail is LocalPlus.
  const gated = !isMyLocal && !hasLocalPlus;
  // Same height for every court, sized to the expanded sheet.
  const detailHeight = drawerDetailHeight({
    windowHeight,
    peekHeight,
    bottomInset: bottom,
    showViewAll: !gated,
  });
  const cooldown = getLocalCourtCooldown(hasLocalPlus, profile?.local_court_changed_at);
  const sportColor = getSportColor(court.sport);
  const activeCount = roster.length;
  const courtRuns = runs.filter((r) => r.courtId === court.id);
  const todayStr = new Date().toDateString();
  const courtVisitsToday = plannedVisits.filter(
    (v) => v.courtId === court.id && new Date(v.plannedAtIso).toDateString() === todayStr
  );
  const distLabel = (() => {
    const km = court.distanceKm ?? distanceKm ?? null;
    return km != null && !Number.isNaN(km) ? `${(km * 0.621371).toFixed(1)} MI` : null;
  })();

  const handleCheckIn = async () => {
    if (isCheckedIn) {
      await checkOut();
      return;
    }
    await checkIn(court.id);
    if (Platform.OS !== "web") {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }
  };

  return (
    <BottomSheetView>
      {/* ── Peek layer: its measured height owns the first sheet detent ── */}
      <View
        onLayout={(event) => {
          const height = event.nativeEvent.layout.height;
          setPeekHeight(height);
          onPeekHeight(height);
        }}
      >
      <View style={styles.peekHeader}>
        <View style={styles.headerCorner}>
          <View style={styles.sportTag}>
            <SportEmblem glow={false} size={13} sport={court.sport} />
            <Text style={[styles.sportText, { color: sportColor }]}>{court.sport}</Text>
          </View>
        </View>
        <View style={styles.headerCornerRight}>
          <Text numberOfLines={1} style={styles.courtAddress}>
            {[court.city || court.neighborhood, distLabel].filter(Boolean).join(" · ")}
          </Text>
          {isMyLocal ? (
            <View style={styles.myLocalTag}>
              <Feather color={Colors.accent} fill={Colors.accent} name="star" size={9} />
              <Text style={styles.myLocalInline}>MY LOCAL</Text>
            </View>
          ) : null}
        </View>
        <View pointerEvents="none" style={styles.centerTitleWrap}>
          <Text style={styles.courtName} numberOfLines={1}>
            {(court.shortName || court.name).toUpperCase()}
          </Text>
          {court.neighborhood && court.neighborhood !== court.city ? (
            <Text numberOfLines={1} style={styles.neighborhood}>{court.neighborhood}</Text>
          ) : null}
        </View>
      </View>

      <View style={styles.statsRow}>
        <StatBlock live={activeCount > 0} value={activeCount} label="On Court" />
        <View style={styles.statDiv} />
        <StatBlock value={localCount} label="Locals" />
        <View style={styles.statDiv} />
        <StatBlock value={court.ratingCount ?? 0} label="Visits" />
      </View>

      <View style={styles.actionsRow}>
        <BrutalistButton
          label={isCheckedIn ? "CHECKED IN" : "CHECK IN"}
          onPress={handleCheckIn}
          variant={isCheckedIn ? "outline" : "accent"}
          style={styles.actionButton}
          testID="check-in-btn"
        />
        <BrutalistButton
          label="VIEW COURT"
          onPress={() => go(gated ? "/localplus" : `/court/${court.id}`)}
          variant="dark"
          style={styles.actionButton}
        />
      </View>

      <Pressable
        style={styles.swipeHint}
        onPress={onExpand}
        accessibilityLabel="Expand for who's here and locals"
      >
        <Text style={styles.swipeHintText}>
          SWIPE UP FOR WHO'S HERE + LOCALS
        </Text>
        <Feather color={Colors.accent} name="chevron-up" size={15} />
      </Pressable>
      </View>

      {/* ── Full layer: fixed height, never scrolls ── */}
      <View style={[styles.detailArea, { height: detailHeight }]}>
      <CourtDrawerGate
        cooldown={cooldown}
        court={court}
        gated={gated}
        onSetLocal={() => void setLocalCourt(court.id, court)}
        onOpenLocalPlus={() => go("/localplus")}
      >
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>WHO'S HERE</Text>
          <Text style={styles.sectionAccent}>{activeCount}</Text>
        </View>
        {activeCount === 0 ? (
          <Text style={styles.emptyText}>NO PLAYERS CHECKED IN YET</Text>
        ) : (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.rosterRow}>
            {roster.map((p) => (
              <AnimatedEntry key={p.id}>
                <Pressable
                  style={styles.rosterItem}
                  onPress={() => go(`/player/${p.id}`)}
                >
                  <View>
                    <PlayerAvatar friend={isFriend(p.id)} initials={p.avatar} name={p.name} playerId={p.id} size={40} />
                  </View>
                  <Text style={styles.rosterName}>{p.name.split(" ")[0].toUpperCase()}</Text>
                  <Text style={styles.rosterElo}>{p.elo}</Text>
                </Pressable>
              </AnimatedEntry>
            ))}
          </ScrollView>
        )}
      </View>

      {/* ── Locals: username list with last check-in ── */}
      <View style={styles.sectionBleed}>
        <View style={[styles.sectionHeader, styles.sectionInset]}>
          <Text style={styles.sectionTitle}>LOCALS</Text>
          <Text style={styles.sectionAccent}>{locals.length}</Text>
        </View>
        {locals.length === 0 ? (
          <Text style={[styles.emptyText, styles.sectionInset]}>
            NO ONE HAS CLAIMED THIS COURT YET
          </Text>
        ) : (
          locals.map(({ player, lastCheckInAt, checkInCount }) => (
            <PlayerSummaryRow
              checkInCount={checkInCount}
              detail={
                lastCheckInAt
                  ? `Last here · ${relativeTime(lastCheckInAt)}`
                  : "No check-ins yet"
              }
              friend={isFriend(player.id)}
              inactive={isInactiveLocal(lastCheckInAt)}
              key={player.id}
              onPress={() => go(`/player/${player.id}`)}
              player={player}
            />
          ))
        )}
      </View>

      {/* ── Pulling up today ── */}
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
              onPress={() => go(`/player/${visit.userId}`)}
            >
              <Text style={styles.visitTime}>{visit.time}</Text>
              <PlayerAvatar initials={visit.player.avatar} name={visit.player.name} playerId={visit.player.id} size={26} />
              <Text style={styles.visitName}>{visit.player.name.split(" ")[0].toUpperCase()}</Text>
              {visit.note != null && (
                <Text style={styles.visitNote} numberOfLines={1}>{visit.note}</Text>
              )}
            </Pressable>
          ))}
        </View>
      )}

      {/* ── Next runs ── */}
      {courtRuns.length > 0 && (
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>NEXT RUN</Text>
          </View>
          {courtRuns.slice(0, 2).map((run) => (
            <Pressable
              key={run.id}
              style={({ pressed }) => [styles.runRow, pressed && styles.pressed]}
              onPress={() => go(`/run/${run.id}`)}
            >
              <View style={{ flex: 1 }}>
                <Text style={styles.runTitle}>{run.title}</Text>
                <Text style={styles.runMeta}>{run.date} · {run.time}</Text>
              </View>
              <Text style={styles.runCount}>
                {run.participants.length}/{run.maxPlayers}
              </Text>
            </Pressable>
          ))}
        </View>
      )}
      </CourtDrawerGate>
      {!gated ? (
        <LinearGradient
          colors={["rgba(0,0,0,0)", Colors.background]}
          pointerEvents="none"
          style={styles.detailFade}
        />
      ) : null}
      </View>

      {!gated ? (
        <Pressable
          accessibilityRole="button"
          onPress={() => go(`/court/${court.id}`)}
          style={({ pressed }) => [styles.viewAll, { marginBottom: bottom + 8 }, pressed && styles.pressed]}
        >
          <Text style={styles.viewAllText}>VIEW ALL</Text>
          <Feather color={Colors.textSecondary} name="chevron-right" size={14} />
        </Pressable>
      ) : null}
    </BottomSheetView>
  );
}

/**
 * Same rule and visual language as app/court/[id].tsx's CourtInsightsGate —
 * real content renders (blurred, non-interactive) underneath a lock panel,
 * flat against the sheet rather than a modal on top of it. This is the
 * drawer version: everyone reaches a court through this swipe-up sheet
 * first, so gating only the full "VIEW COURT" page and not this left the
 * paywall invisible in practice.
 */
function CourtDrawerGate({
  children,
  court,
  cooldown,
  gated,
  onSetLocal,
  onOpenLocalPlus,
}: {
  children: React.ReactNode;
  court: Court;
  cooldown: ReturnType<typeof getLocalCourtCooldown>;
  gated: boolean;
  onSetLocal: () => void;
  /** Fallback when Apple's sheet can't be offered here. Must dismiss this
   * sheet before navigating — see `go()` above. A raw router.push from in
   * here pushes /localplus behind the still-open modal, invisible, and
   * stacks a new one on every repeat tap. */
  onOpenLocalPlus: () => void;
}) {
  // Upgrade opens Apple's purchase sheet for Yearly directly (decision D13).
  // VIEW COURT still goes to the LocalPlus screen.
  const yearly = useLocalPlusPurchase("yearly", gated);
  if (!gated) return <>{children}</>;
  const onUpgrade = () => {
    if (yearly.available) void yearly.buy();
    else onOpenLocalPlus();
  };
  const courtName = court.shortName || court.name;
  return (
    <View style={styles.gateWrap}>
      <View pointerEvents="none" style={styles.gateWrap}>
        {children}
        <BlurView intensity={28} style={StyleSheet.absoluteFill} tint="dark" />
        {/* Soft edges instead of a hard blur line at the top and bottom. */}
        <LinearGradient
          colors={[Colors.background, "rgba(0,0,0,0)"]}
          style={styles.gateFadeTop}
        />
        <LinearGradient
          colors={["rgba(0,0,0,0)", Colors.background]}
          style={styles.gateFadeBottom}
        />
      </View>
      <View style={[styles.gateOverlay, StyleSheet.absoluteFill]}>
        <View style={styles.gateBadge}>
          <LogoMark size={18} />
          <Text style={styles.gateBadgeText}>LOCALPLUS</Text>
        </View>
        <Text style={styles.gateTitle}>SEE WHO PLAYS HERE</Text>
        <Text style={styles.gateSubtitle}>
          Locals, who's on court now, and upcoming runs at {courtName}.
        </Text>
        <Pressable
          accessibilityRole="button"
          disabled={yearly.purchasing}
          onPress={onUpgrade}
          style={({ pressed }) => [styles.gateCta, pressed && styles.pressed]}
        >
          {yearly.purchasing ? (
            <ActivityIndicator color={Colors.black} size="small" />
          ) : (
            <Text style={styles.gateCtaText}>
              {yearly.priceString ? `GET LOCALPLUS · ${yearly.priceString}/YR` : "GET LOCALPLUS"}
            </Text>
          )}
        </Pressable>
        {yearly.priceString ? (
          <Text style={styles.gateTerms}>Renews yearly until you cancel.</Text>
        ) : null}
        <Pressable
          accessibilityRole="button"
          disabled={cooldown.restricted}
          hitSlop={8}
          onPress={onSetLocal}
          style={({ pressed }) => [styles.gateLocalLink, pressed && styles.gateLinkPressed]}
        >
          <Feather
            color={cooldown.restricted ? Colors.mutedDark : Colors.textSecondary}
            name="star"
            size={12}
          />
          <Text style={[styles.gateLocalText, cooldown.restricted && styles.gateLocalTextDisabled]}>
            {cooldown.restricted
              ? `You can switch local courts in ${formatCooldownRemaining(cooldown.remainingMs)}`
              : "Or make it your local court, free"}
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  loading: { alignItems: "center", justifyContent: "center", paddingVertical: 64 },

  peekHeader: {
    minHeight: 94,
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 4,
    justifyContent: "center",
    position: "relative",
  },
  headerCorner: { position: "absolute", left: 20, top: 2, maxWidth: "42%" },
  headerCornerRight: { position: "absolute", right: 20, top: 2, maxWidth: "36%", alignItems: "flex-end", gap: 6 },
  centerTitleWrap: { alignSelf: "center", width: "72%", alignItems: "center", paddingTop: 20 },
  sportTag: { flexDirection: "row", alignItems: "center", gap: 5 },
  sportText: {
    fontFamily: Typography.bodyMedium,
    fontSize: 10,
    letterSpacing: 1.5,
    textTransform: "uppercase" as const,
  },
  myLocalInline: {
    fontFamily: Typography.bodyBold,
    fontSize: 10,
    color: Colors.accent,
    letterSpacing: 1,
  },
  myLocalTag: { marginLeft: 4, flexDirection: "row", alignItems: "center", gap: 4 },
  courtName: {
    fontFamily: Typography.heading,
    fontSize: 26,
    color: Colors.white,
    lineHeight: 30,
    letterSpacing: 0.5,
    textAlign: "center",
  },
  courtAddress: {
    fontFamily: Typography.body,
    fontSize: 12,
    color: Colors.mutedDark,
    textAlign: "right",
  },
  neighborhood: {
    fontFamily: Typography.body,
    fontSize: 11,
    color: Colors.mutedDark,
    marginTop: 2,
    textAlign: "center",
  },

  statsRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: Colors.surface,
    borderTopWidth: 0.5,
    borderBottomWidth: 0.5,
    borderColor: Colors.border,
    paddingVertical: 12,
    marginTop: 12,
  },
  statDiv: { width: 0.5, height: 28, backgroundColor: Colors.border },

  actionsRow: {
    flexDirection: "row",
    gap: 10,
    paddingHorizontal: 20,
    paddingTop: 14,
  },
  actionButton: { flex: 1, minHeight: 48 },
  swipeHint: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 6,
    minHeight: 44,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: Colors.border,
  },
  swipeHintText: {
    fontFamily: Typography.bodyMedium,
    fontSize: 9,
    color: Colors.muted,
    letterSpacing: 2,
  },
  swipeHintArrow: {
    fontFamily: Typography.bodyBold,
    fontSize: 11,
    color: Colors.accent,
  },

  section: {
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 14,
    borderTopWidth: 0.5,
    borderTopColor: Colors.border,
  },
  sectionBleed: {
    paddingTop: 18,
    paddingBottom: 14,
    borderTopWidth: 0.5,
    borderTopColor: Colors.border,
  },
  sectionInset: { paddingHorizontal: 20 },
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

  pressed: { backgroundColor: Colors.surfaceHigh },

  visitRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 8,
    borderBottomWidth: 0.5,
    borderBottomColor: Colors.borderSubtle,
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

  profileLink: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginHorizontal: 20,
    marginVertical: 20,
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

  // ── Court insights gate (LocalPlus paywall) ──
  detailArea: { overflow: "hidden" },
  detailFade: { position: "absolute", left: 0, right: 0, bottom: 0, height: 56 },
  viewAll: {
    minHeight: 44,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: Colors.border,
  },
  viewAllText: {
    fontFamily: Typography.bodyBold,
    fontSize: 11,
    letterSpacing: 1.4,
    color: Colors.textSecondary,
  },
  gateWrap: { flex: 1 },
  gateTerms: {
    marginTop: 8,
    fontFamily: Typography.body,
    fontSize: 10,
    color: Colors.mutedDark,
    textAlign: "center",
  },
  gateOverlay: {
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 32,
  },
  gateFadeTop: { position: "absolute", left: 0, right: 0, top: 0, height: 28 },
  gateFadeBottom: { position: "absolute", left: 0, right: 0, bottom: 0, height: 72 },
  gateBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 12,
  },
  gateBadgeText: {
    fontFamily: Typography.bodyBold,
    fontSize: 11,
    letterSpacing: 2,
    color: Colors.accent,
  },
  gateTitle: {
    fontFamily: Typography.heading,
    fontSize: 22,
    color: Colors.text,
    letterSpacing: 0.6,
    textAlign: "center",
  },
  gateSubtitle: {
    marginTop: 6,
    maxWidth: 280,
    fontFamily: Typography.body,
    fontSize: 13,
    lineHeight: 18,
    color: Colors.textSecondary,
    textAlign: "center",
  },
  gateCta: {
    minHeight: 48,
    alignSelf: "stretch",
    marginTop: 18,
    paddingHorizontal: 24,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: Radius.md,
    backgroundColor: Colors.accent,
  },
  gateCtaText: {
    fontFamily: Typography.heading,
    fontSize: 13,
    letterSpacing: 1.2,
    color: Colors.black,
  },
  gateLocalLink: {
    minHeight: 44,
    marginTop: 6,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingHorizontal: 12,
  },
  gateLinkPressed: { opacity: 0.6 },
  gateLocalText: {
    fontFamily: Typography.bodyMedium,
    fontSize: 12,
    color: Colors.textSecondary,
  },
  gateLocalTextDisabled: { color: Colors.mutedDark },
});
