import { router, useLocalSearchParams } from "expo-router";
import React from "react";
import {
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { BrutalistButton } from "@/components/BrutalistButton";
import { LivePulse } from "@/components/LivePulse";
import { PlayerAvatar } from "@/components/PlayerAvatar";
import { RunCard } from "@/components/RunCard";
import { StatBlock } from "@/components/StatBlock";
import { Colors, Radius } from "@/constants/colors";
import { Court, Player, getSportColor } from "@/constants/data";
import { Typography } from "@/constants/typography";
import { useApp } from "@/context/AppContext";
import { fetchActiveCheckIns } from "@/services/checkInService";
import { fetchCourtById } from "@/services/courtService";
import { fetchLocalCount } from "@/services/profileService";

// BACKEND NOTE: court detail → GET /api/v1/courts/:id
// Roster (live) → GET /api/v1/courts/:id/roster
// Upcoming runs → GET /api/v1/courts/:id/runs?status=upcoming
// Check in → POST /api/v1/courts/:id/checkins
// Check out → DELETE /api/v1/courts/:id/checkins/me

export default function CourtProfileScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { courts, runs, checkIn, checkOut, checkedInCourtId, setLocalCourt, localCourtId, localCourt: ctxLocalCourt } =
    useApp();
  const { top, bottom } = useSafeAreaInsets();
  const topPad = Platform.OS === "web" ? 67 : top;

  // Courts list is no longer preloaded; try local cache then fetch from Supabase
  const [court, setCourt] = React.useState<Court | null>(
    courts.find((c) => c.id === id) ?? (ctxLocalCourt?.id === id ? ctxLocalCourt : null)
  );
  const [fetchError, setFetchError] = React.useState(false);
  const [activePlayers, setActivePlayers] = React.useState<Player[]>([]);
  const [localCount, setLocalCount] = React.useState(0);

  React.useEffect(() => {
    if (court) return; // already resolved
    fetchCourtById(String(id)).then((c) => {
      if (c) setCourt(c);
      else setFetchError(true);
    });
  }, [id]);

  React.useEffect(() => {
    if (!id) return;
    Promise.all([fetchActiveCheckIns(String(id)), fetchLocalCount(String(id))]).then(
      ([players, count]) => {
        setActivePlayers(players);
        setLocalCount(count);
      }
    );
  }, [id, checkedInCourtId, localCourtId]);

  const courtRuns = runs.filter((r) => r.courtId === id);
  const isCheckedIn = checkedInCourtId === id;
  const isMyLocal = localCourtId === id;

  if (!court) {
    return (
      <View style={styles.notFound}>
        <Text style={styles.notFoundText}>{fetchError ? "COURT NOT FOUND" : "LOADING…"}</Text>
        {fetchError && <BrutalistButton label="GO BACK" onPress={() => router.back()} variant="outline" />}
      </View>
    );
  }

  const sportColor = getSportColor(court.sport);
  const activeCount = activePlayers.length;
  const occupancyPct = Math.round((activeCount / court.maxCapacity) * 100);

  const courtDetails: { label: string; value: string }[] = [
    { label: "Courts", value: String(court.courtCount ?? 1) },
    { label: "Hoops", value: court.hoopCount != null ? String(court.hoopCount) : "—" },
    { label: "Net Type", value: court.netType ?? "—" },
    { label: "Rim", value: court.rimType ?? "—" },
    { label: "Surface", value: court.surface },
    { label: "Lights", value: court.lights ? "YES" : "NO" },
    { label: "Covered", value: court.covered ? "YES" : "NO" },
    { label: "Water", value: court.waterFountain ? "YES" : "NO" },
    { label: "Max Players", value: String(court.maxCapacity) },
    { label: "Added", value: court.addedDate ?? "—" },
  ];

  return (
    <View style={styles.container}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{
          paddingBottom: (Platform.OS === "web" ? 34 : bottom) + 100,
        }}
      >
        {/* ── Clean Header (no background image) ── */}
        <View style={[styles.hero, { paddingTop: topPad + 12 }]}>
          <View style={[styles.sportAccentBar, { backgroundColor: sportColor }]} />

          {/* Back */}
          <Pressable onPress={() => router.back()} style={styles.backBtn} hitSlop={12}>
            <Text style={styles.backText}>‹ BACK</Text>
          </Pressable>

          {/* Meta row */}
          <View style={styles.heroMeta}>
            <View style={styles.sportTag}>
              <View style={[styles.sportDot, { backgroundColor: sportColor }]} />
              <Text style={[styles.sportText, { color: sportColor }]}>{court.sport}</Text>
            </View>
            {activeCount > 0 && (
              <View style={styles.liveChip}>
                <LivePulse size={4} color={Colors.black} style={{ marginRight: 4 }} />
                <Text style={styles.liveText}>LIVE</Text>
              </View>
            )}
          </View>

          <Text style={styles.heroName}>{court.name.toUpperCase()}</Text>
          <Text style={styles.heroAddress}>
            {court.neighborhood} · {court.city}
          </Text>
          <Text style={styles.heroFullAddress}>{court.address}</Text>
        </View>

        {/* ── Stats Bar ── */}
        <View style={styles.statsBar}>
          <StatBlock value={activeCount} label="On Court" />
          <View style={styles.statDiv} />
          <StatBlock value={`${occupancyPct}%`} label="Full" />
          <View style={styles.statDiv} />
          <StatBlock value={`${court.rating} ★`} label={`${court.ratingCount} ratings`} />
          <View style={styles.statDiv} />
          <StatBlock value={court.maxCapacity} label="Max" />
        </View>

        {/* ── Live Roster ── */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>LIVE ROSTER</Text>
          {activePlayers.length === 0 ? (
            <Text style={styles.emptyText}>NO PLAYERS CHECKED IN YET</Text>
          ) : (
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <View style={styles.rosterRow}>
                {activePlayers.map((player) => (
                  <View key={player.id} style={styles.rosterItem}>
                    <PlayerAvatar initials={player.avatar} size={44} />
                    <Text style={styles.rosterName}>
                      {player.name.split(" ")[0].toUpperCase()}
                    </Text>
                    <Text style={styles.rosterElo}>{player.elo}</Text>
                  </View>
                ))}
              </View>
            </ScrollView>
          )}
        </View>

        {/* ── Upcoming Runs ── */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>UPCOMING RUNS</Text>
          {courtRuns.length === 0 ? (
            <Pressable
              style={({ pressed }) => [styles.hostCTA, pressed && styles.pressed]}
              onPress={() => {/* TODO: navigate to create run */}}
            >
              <View>
                <Text style={styles.hostCTATitle}>BE THE FIRST{"\n"}TO HOST</Text>
                <Text style={styles.hostCTASub}>Set a time. Build the run.</Text>
              </View>
              <Text style={styles.hostCTAArrow}>→</Text>
            </Pressable>
          ) : (
            courtRuns.map((run) => <RunCard key={run.id} run={run} />)
          )}
        </View>

        {/* ── Court Details ── */}
        <View style={styles.sectionFlat}>
          <Text style={styles.sectionTitle}>DETAILS</Text>
          <View style={styles.detailsGrid}>
            {courtDetails.map(({ label, value }) => (
              <View key={label} style={styles.detailRow}>
                <Text style={styles.detailKey}>{label}</Text>
                <Text style={styles.detailVal}>{value}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* ── Set as Local ── */}
        <View style={styles.localSection}>
          <Pressable
            style={[styles.localBtn, isMyLocal && styles.localBtnActive]}
            onPress={() => setLocalCourt(isMyLocal ? null : court.id, court)}
          >
            <Text style={[styles.localBtnText, isMyLocal && styles.localBtnTextActive]}>
              {isMyLocal ? "✕ REMOVE MY LOCAL COURT" : "☆ SET AS MY LOCAL COURT"}
            </Text>
            {!isMyLocal && (
              <Text style={styles.localBtnSub}>
                {localCount} local{localCount !== 1 ? "s" : ""} ·
                {court.status === "community" ? " Community Court" : " Confirmed Court"}
              </Text>
            )}
          </Pressable>
        </View>
      </ScrollView>

      {/* ── Sticky Footer ── */}
      <View
        style={[
          styles.stickyFooter,
          { paddingBottom: (Platform.OS === "web" ? 34 : bottom) + 12 },
        ]}
      >
        <BrutalistButton
          label={isCheckedIn ? "CHECKED IN ✓" : "CHECK IN"}
          onPress={async () => {
            isCheckedIn ? await checkOut() : await checkIn(court.id);
          }}
          variant={isCheckedIn ? "outline" : "accent"}
          style={{ flex: 1 }}
          testID="court-check-in-btn"
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  notFound: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    gap: 20,
    padding: 40,
  },
  notFoundText: {
    fontFamily: Typography.heading,
    fontSize: 24,
    color: Colors.text,
    letterSpacing: 2,
  },

  // ── Hero ──
  hero: {
    paddingHorizontal: 20,
    paddingBottom: 20,
    backgroundColor: Colors.surface,
    borderBottomWidth: 0.5,
    borderBottomColor: Colors.border,
  },
  sportAccentBar: {
    height: 2,
    marginBottom: 16,
    marginHorizontal: -20,
  },
  backBtn: { marginBottom: 14 },
  backText: {
    fontFamily: Typography.heading,
    fontSize: 13,
    color: Colors.muted,
    letterSpacing: 1,
  },
  heroMeta: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 10,
  },
  sportTag: { flexDirection: "row", alignItems: "center", gap: 5 },
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
  liveText: {
    fontFamily: Typography.bodyBold,
    fontSize: 9,
    color: Colors.black,
    letterSpacing: 2,
  },
  heroName: {
    fontFamily: Typography.heading,
    fontSize: 36,
    color: Colors.text,
    letterSpacing: 0.5,
    lineHeight: 38,
    marginBottom: 4,
  },
  heroAddress: {
    fontFamily: Typography.body,
    fontSize: 13,
    color: Colors.muted,
    marginBottom: 2,
  },
  heroFullAddress: {
    fontFamily: Typography.body,
    fontSize: 11,
    color: Colors.mutedDark,
  },

  // ── Stats Bar ──
  statsBar: {
    flexDirection: "row",
    borderBottomWidth: 0.5,
    borderColor: Colors.border,
    paddingVertical: 14,
    backgroundColor: Colors.surface,
  },
  statDiv: { width: 0.5, backgroundColor: Colors.border },

  // ── Section ──
  section: {
    paddingHorizontal: 20,
    paddingTop: 22,
    paddingBottom: 16,
    borderBottomWidth: 0.5,
    borderColor: Colors.border,
  },
  sectionFlat: {
    paddingHorizontal: 20,
    paddingTop: 22,
    paddingBottom: 16,
    borderBottomWidth: 0.5,
    borderColor: Colors.border,
  },
  sectionTitle: {
    fontFamily: Typography.heading,
    fontSize: 12,
    color: Colors.text,
    letterSpacing: 3,
    marginBottom: 14,
    textTransform: "uppercase" as const,
    borderBottomWidth: 0.5,
    borderColor: Colors.border,
    paddingBottom: 8,
  },
  emptyText: {
    fontFamily: Typography.bodyMedium,
    fontSize: 12,
    color: Colors.muted,
    letterSpacing: 1.5,
    textTransform: "uppercase" as const,
    paddingVertical: 8,
  },

  // ── Roster ──
  rosterRow: { flexDirection: "row", gap: 12 },
  rosterItem: { alignItems: "center" },
  rosterName: {
    fontFamily: Typography.bodyBold,
    fontSize: 9,
    color: Colors.text,
    marginTop: 5,
    letterSpacing: 0.5,
  },
  rosterElo: {
    fontFamily: Typography.heading,
    fontSize: 12,
    color: Colors.muted,
    marginTop: 1,
  },

  // ── Host CTA ──
  hostCTA: {
    borderWidth: 0.5,
    borderColor: Colors.border,
    padding: 20,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: Colors.surfaceHigh,
  },
  pressed: { backgroundColor: Colors.surfaceHigh },
  hostCTATitle: {
    fontFamily: Typography.heading,
    fontSize: 20,
    color: Colors.text,
    letterSpacing: 1,
  },
  hostCTASub: {
    fontFamily: Typography.body,
    fontSize: 12,
    color: Colors.muted,
    marginTop: 4,
  },
  hostCTAArrow: {
    fontFamily: Typography.heading,
    fontSize: 28,
    color: Colors.muted,
  },

  // ── Details Grid ──
  detailsGrid: {},
  detailRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 12,
    borderBottomWidth: 0.5,
    borderColor: Colors.border,
  },
  detailKey: {
    fontFamily: Typography.bodyMedium,
    fontSize: 12,
    color: Colors.muted,
  },
  detailVal: {
    fontFamily: Typography.heading,
    fontSize: 14,
    color: Colors.text,
    letterSpacing: 0.5,
  },

  // ── Local Section ──
  localSection: {
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  localBtn: {
    borderWidth: 0.5,
    borderColor: Colors.border,
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: Colors.surface,
  },
  localBtnActive: {
    borderColor: Colors.accent,
    backgroundColor: Colors.accentDim,
  },
  localBtnText: {
    fontFamily: Typography.heading,
    fontSize: 13,
    color: Colors.muted,
    letterSpacing: 1.5,
    marginBottom: 2,
  },
  localBtnTextActive: { color: Colors.accent },
  localBtnSub: {
    fontFamily: Typography.body,
    fontSize: 11,
    color: Colors.mutedDark,
  },

  // ── Footer ──
  stickyFooter: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 20,
    paddingTop: 12,
    backgroundColor: Colors.surface,
    borderTopWidth: 0.5,
    borderColor: Colors.border,
    flexDirection: "row",
  },
});
