import * as Haptics from "expo-haptics";
import { router, useLocalSearchParams } from "expo-router";
import React, { useEffect, useState } from "react";
import {
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { AnimatedEntry } from "@/components/AnimatedEntry";
import { BrutalistButton } from "@/components/BrutalistButton";
import { LivePulse } from "@/components/LivePulse";
import { PlayerAvatar } from "@/components/PlayerAvatar";
import { StatBlock } from "@/components/StatBlock";
import { Colors, Radius } from "@/constants/colors";
import { Court, getSportColor } from "@/constants/data";
import { Typography } from "@/constants/typography";
import { useApp } from "@/context/AppContext";
import { usePresence } from "@/context/CourtPresenceContext";
import { fetchCourtById } from "@/services/courtService";
import {
  fetchLocalsWithLastCheckIn,
  LocalWithLastCheckIn,
} from "@/services/profileService";

/**
 * The court drawer — a native formSheet route (registered in app/_layout.tsx
 * with detents [0.45, 1.0]). Open with:
 *   router.push({ pathname: "/court-sheet", params: { id, distanceKm? } })
 *
 * At the 45% detent you see the peek layer: name, distance, live stats,
 * CHECK IN. Swipe up (native gesture) for the full experience: WHO'S HERE,
 * the LOCALS list (usernames + last check-in), runs, and the profile link.
 * Swipe down dismisses. All sheet physics are the OS's own.
 */
export default function CourtSheetScreen() {
  const { id, distanceKm } = useLocalSearchParams<{ id: string; distanceKm?: string }>();
  const { courts, localCourt, checkIn, checkOut, checkedInCourtId, setLocalCourt, localCourtId, runs, plannedVisits, isFriend } = useApp();
  const { bottom } = useSafeAreaInsets();

  const cached =
    courts.find((c) => c.id === id) ?? (localCourt?.id === id ? localCourt : null);
  const [court, setCourt] = useState<Court | null>(cached);
  const [locals, setLocals] = useState<LocalWithLastCheckIn[]>([]);
  const { roster, localCount } = usePresence(id ? String(id) : null);

  useEffect(() => {
    if (!id) return;
    if (!court) {
      fetchCourtById(String(id)).then((c) => c && setCourt(c));
    }
    fetchLocalsWithLastCheckIn(String(id)).then(setLocals);
  }, [id, roster.length]); // re-pull locals when presence changes

  if (!court) {
    return (
      <View style={[styles.sheet, styles.loading]}>
        <Text style={styles.emptyText}>LOADING…</Text>
      </View>
    );
  }

  const isCheckedIn = checkedInCourtId === court.id;
  const isMyLocal = localCourtId === court.id;
  const sportColor = getSportColor(court.sport);
  const activeCount = roster.length;
  const courtRuns = runs.filter((r) => r.courtId === court.id);
  const todayStr = new Date().toDateString();
  const courtVisitsToday = plannedVisits.filter(
    (v) => v.courtId === court.id && new Date(v.plannedAtIso).toDateString() === todayStr
  );
  const distLabel = (() => {
    const km = court.distanceKm ?? (distanceKm ? Number(distanceKm) : null);
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

  const lastSeenLabel = (iso: string | null) => {
    if (!iso) return "NO CHECK-INS YET";
    const d = new Date(iso);
    const days = Math.floor((Date.now() - d.getTime()) / 86_400_000);
    if (days === 0) return "TODAY";
    if (days === 1) return "YESTERDAY";
    if (days < 7) return `${days}D AGO`;
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric" }).toUpperCase();
  };

  return (
    <View style={styles.sheet}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: bottom + 32 }}
      >
        {/* ── Peek layer: visible at the 45% detent ── */}
        <View style={styles.peekHeader}>
          <View style={{ flex: 1, paddingRight: 12 }}>
            <View style={styles.sportTag}>
              <View style={[styles.sportDot, { backgroundColor: sportColor }]} />
              <Text style={[styles.sportText, { color: sportColor }]}>{court.sport}</Text>
              {distLabel && <Text style={styles.metaDim}> · {distLabel}</Text>}
              {isMyLocal && <Text style={styles.myLocalInline}> · ★ MY LOCAL</Text>}
            </View>
            <Text style={styles.courtName} numberOfLines={2}>{court.name.toUpperCase()}</Text>
            <Text style={styles.courtAddress}>
              {court.neighborhood}{court.city ? ` · ${court.city}` : ""}
            </Text>
          </View>
          {activeCount > 0 && (
            <View style={styles.liveChip}>
              <LivePulse size={4} color={Colors.black} style={{ marginRight: 4 }} />
              <Text style={styles.liveChipText}>LIVE</Text>
            </View>
          )}
        </View>

        <View style={styles.statsRow}>
          <StatBlock value={activeCount} label="On Court" />
          <View style={styles.statDiv} />
          <StatBlock value={localCount} label="Locals" />
          <View style={styles.statDiv} />
          <StatBlock value={court.ratingCount ?? 0} label="Visits" />
        </View>

        <View style={styles.actionsRow}>
          <BrutalistButton
            label={isCheckedIn ? "CHECKED IN ✓" : "CHECK IN"}
            onPress={handleCheckIn}
            variant={isCheckedIn ? "outline" : "accent"}
            style={{ flex: 2 }}
            testID="check-in-btn"
          />
          <BrutalistButton
            label={isMyLocal ? "MY LOCAL ★" : "SET LOCAL"}
            onPress={() => setLocalCourt(isMyLocal ? null : court.id, isMyLocal ? undefined : court)}
            variant={isMyLocal ? "accent" : "dark"}
            style={{ flex: 1.5 }}
          />
        </View>

        <View style={styles.swipeHint}>
          <Text style={styles.swipeHintText}>SWIPE UP FOR WHO'S HERE + LOCALS</Text>
          <Text style={styles.swipeHintArrow}>↑</Text>
        </View>

        {/* ── Full layer ── */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>WHO'S HERE</Text>
            {activeCount > 0 && <Text style={styles.sectionAccent}>{activeCount} ACTIVE</Text>}
          </View>
          {activeCount === 0 ? (
            <Text style={styles.emptyText}>NO PLAYERS CHECKED IN YET</Text>
          ) : (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.rosterRow}>
              {roster.map((p) => (
                <AnimatedEntry key={p.id}>
                  <Pressable
                    style={styles.rosterItem}
                    onPress={() => router.push(`/player/${p.id}`)}
                  >
                    <View>
                      <PlayerAvatar initials={p.avatar} size={40} />
                      {isFriend(p.id) && <View style={styles.friendDot} />}
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
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>LOCALS</Text>
            <Text style={styles.sectionAccent}>{locals.length}</Text>
          </View>
          {locals.length === 0 ? (
            <Text style={styles.emptyText}>NO ONE HAS CLAIMED THIS COURT YET</Text>
          ) : (
            locals.map(({ player, lastCheckInAt }) => (
              <Pressable
                key={player.id}
                style={({ pressed }) => [styles.localRow, pressed && styles.pressed]}
                onPress={() => router.push(`/player/${player.id}`)}
              >
                <PlayerAvatar initials={player.avatar} size={30} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.localName}>{player.name.toUpperCase()}</Text>
                  <Text style={styles.localMeta}>
                    LAST CHECK-IN: {lastSeenLabel(lastCheckInAt)}
                  </Text>
                </View>
                {isFriend(player.id) && <Text style={styles.friendLabel}>FRIEND</Text>}
                <Text style={styles.localElo}>{player.elo}</Text>
              </Pressable>
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
                onPress={() => router.push(`/player/${visit.userId}`)}
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
                onPress={() => router.push(`/run/${run.id}`)}
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

        <Pressable
          style={({ pressed }) => [styles.profileLink, pressed && styles.pressed]}
          onPress={() => router.push(`/court/${court.id}`)}
        >
          <Text style={styles.profileLinkText}>FULL COURT PROFILE</Text>
          <Text style={styles.profileLinkArrow}>→</Text>
        </Pressable>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  sheet: {
    flex: 1,
    backgroundColor: Colors.background,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  loading: { alignItems: "center", justifyContent: "center" },

  peekHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 4,
  },
  sportTag: { flexDirection: "row", alignItems: "center", gap: 5 },
  sportDot: { width: 6, height: 6, borderRadius: 3 },
  sportText: {
    fontFamily: Typography.bodyMedium,
    fontSize: 10,
    letterSpacing: 1.5,
    textTransform: "uppercase" as const,
  },
  metaDim: {
    fontFamily: Typography.bodyMedium,
    fontSize: 10,
    color: Colors.muted,
    letterSpacing: 1,
  },
  myLocalInline: {
    fontFamily: Typography.bodyBold,
    fontSize: 10,
    color: Colors.accent,
    letterSpacing: 1,
  },
  courtName: {
    fontFamily: Typography.heading,
    fontSize: 26,
    color: Colors.white,
    lineHeight: 30,
    letterSpacing: 0.5,
    marginTop: 6,
  },
  courtAddress: {
    fontFamily: Typography.body,
    fontSize: 12,
    color: Colors.mutedDark,
    marginTop: 2,
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
  swipeHint: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 6,
    paddingVertical: 12,
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

  localRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 10,
    borderBottomWidth: 0.5,
    borderBottomColor: Colors.borderSubtle,
    minHeight: 48,
  },
  localName: {
    fontFamily: Typography.bodyBold,
    fontSize: 12,
    color: Colors.text,
    letterSpacing: 0.5,
  },
  localMeta: {
    fontFamily: Typography.bodyMedium,
    fontSize: 9,
    color: Colors.muted,
    letterSpacing: 1,
    marginTop: 2,
  },
  localElo: {
    fontFamily: Typography.heading,
    fontSize: 14,
    color: Colors.textSecondary,
  },
  friendLabel: {
    fontFamily: Typography.bodyBold,
    fontSize: 8,
    color: Colors.win,
    letterSpacing: 1.2,
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
});
