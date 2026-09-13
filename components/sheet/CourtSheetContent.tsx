import { BottomSheetScrollView } from "@gorhom/bottom-sheet";
import { Feather } from "@expo/vector-icons";
import { BlurView } from "expo-blur";
import * as Haptics from "expo-haptics";
import { router } from "expo-router";
import React, { useEffect, useState } from "react";
import { Platform, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { AnimatedEntry } from "@/components/AnimatedEntry";
import { BrutalistButton } from "@/components/BrutalistButton";
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
import { formatCooldownRemaining, getLocalCourtCooldown } from "@/lib/localCourtCooldown";
import { isInactiveLocal, relativeTime } from "@/lib/localPresence";
import { fetchCourtById } from "@/services/courtService";
import {
  fetchLocalsWithLastCheckIn,
  LocalWithLastCheckIn,
} from "@/services/profileService";

/**
 * Court drawer content, rendered inside the root BottomSheetModal
 * (see CourtSheetHost). Peek layer (40% snap): name, distance, live stats,
 * CHECK IN. Full (92%): WHO'S HERE roster, LOCALS list, pulling-up, runs.
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
    <BottomSheetScrollView
      showsVerticalScrollIndicator={false}
      contentContainerStyle={{ paddingBottom: bottom + 32 }}
    >
      {/* ── Peek layer: its measured height owns the first sheet detent ── */}
      <View onLayout={(event) => onPeekHeight(event.nativeEvent.layout.height)}>
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
          onPress={() => go(`/court/${court.id}`)}
          variant="dark"
          style={styles.actionButton}
        />
      </View>

      <Pressable
        style={styles.swipeHint}
        onPress={onExpand}
        accessibilityLabel="Expand for who's here and locals"
      >
        <Text style={styles.swipeHintText}>SWIPE UP FOR WHO'S HERE + LOCALS</Text>
        <Feather color={Colors.accent} name="chevron-up" size={15} />
      </Pressable>
      </View>

      {/* ── Full layer ── */}
      <CourtDrawerGate
        cooldown={cooldown}
        court={court}
        gated={gated}
        onSetLocal={() => void setLocalCourt(court.id, court)}
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

    </BottomSheetScrollView>
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
}: {
  children: React.ReactNode;
  court: Court;
  cooldown: ReturnType<typeof getLocalCourtCooldown>;
  gated: boolean;
  onSetLocal: () => void;
}) {
  if (!gated) return <>{children}</>;
  return (
    <View style={styles.gateWrap}>
      <View pointerEvents="none" style={styles.gateWrap}>
        {children}
        <BlurView intensity={22} style={StyleSheet.absoluteFill} tint="dark" />
      </View>
      <View style={[styles.gateOverlay, StyleSheet.absoluteFill]}>
        <View style={styles.gateIconRing}>
          <Feather color={Colors.accent} name="lock" size={20} />
        </View>
        <Text style={styles.gateTitle}>UNLOCK WITH LOCALPLUS</Text>
        <Text style={styles.gateSubtitle}>
          See who's here, the full locals list, and the schedule at{" "}
          {court.shortName || court.name} — not only your own court.
        </Text>
        <Pressable
          accessibilityRole="button"
          onPress={() => router.push("/localplus")}
          style={({ pressed }) => [styles.gateCta, pressed && styles.pressed]}
        >
          <Text style={styles.gateCtaText}>UPGRADE TO LOCALPLUS</Text>
        </Pressable>
        <View style={styles.gateDividerRow}>
          <View style={styles.gateDividerLine} />
          <Text style={styles.gateDividerText}>OR</Text>
          <View style={styles.gateDividerLine} />
        </View>
        <Pressable
          accessibilityRole="button"
          disabled={cooldown.restricted}
          onPress={onSetLocal}
          style={({ pressed }) => [
            styles.gateSecondary,
            cooldown.restricted && styles.gateSecondaryDisabled,
            pressed && styles.pressed,
          ]}
        >
          <Feather
            color={cooldown.restricted ? Colors.muted : Colors.text}
            name="star"
            size={13}
          />
          <Text
            style={[
              styles.gateSecondaryText,
              cooldown.restricted && styles.gateSecondaryTextDisabled,
            ]}
          >
            SET AS LOCAL COURT
          </Text>
        </Pressable>
        {cooldown.restricted ? (
          <Text style={styles.gateCooldownText}>
            You can change your local court in{" "}
            {formatCooldownRemaining(cooldown.remainingMs)}.
          </Text>
        ) : null}
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
  headerCorner: { position: "absolute", left: 20, top: 12, maxWidth: "42%" },
  headerCornerRight: { position: "absolute", right: 20, top: 12, maxWidth: "36%", alignItems: "flex-end", gap: 6 },
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
  gateWrap: { minHeight: 340 },
  gateOverlay: {
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 36,
  },
  gateIconRing: {
    width: 56,
    height: 56,
    marginBottom: 14,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 28,
    borderWidth: 1,
    borderColor: Colors.accentBorder,
    backgroundColor: Colors.accentGhost,
  },
  gateTitle: {
    fontFamily: Typography.heading,
    fontSize: 16,
    color: Colors.text,
    letterSpacing: 1,
    textAlign: "center",
  },
  gateSubtitle: {
    marginTop: 8,
    maxWidth: 280,
    fontFamily: Typography.body,
    fontSize: 12,
    lineHeight: 17,
    color: Colors.muted,
    textAlign: "center",
  },
  gateCta: {
    minHeight: 46,
    minWidth: 220,
    marginTop: 20,
    paddingHorizontal: 24,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: Radius.md,
    backgroundColor: Colors.accent,
  },
  gateCtaText: {
    fontFamily: Typography.heading,
    fontSize: 12,
    letterSpacing: 1.2,
    color: Colors.black,
  },
  gateDividerRow: {
    minWidth: 220,
    marginTop: 16,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  gateDividerLine: { flex: 1, height: StyleSheet.hairlineWidth, backgroundColor: Colors.border },
  gateDividerText: {
    fontFamily: Typography.bodyBold,
    fontSize: 9,
    color: Colors.mutedDark,
    letterSpacing: 1.4,
  },
  gateSecondary: {
    minHeight: 44,
    minWidth: 220,
    marginTop: 16,
    paddingHorizontal: 20,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.md,
  },
  gateSecondaryDisabled: { opacity: 0.5 },
  gateSecondaryText: {
    fontFamily: Typography.bodyBold,
    fontSize: 10,
    letterSpacing: 1.2,
    color: Colors.text,
  },
  gateSecondaryTextDisabled: { color: Colors.muted },
  gateCooldownText: {
    marginTop: 10,
    fontFamily: Typography.bodyMedium,
    fontSize: 10,
    color: Colors.mutedDark,
    textAlign: "center",
  },
});
