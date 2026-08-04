import { Feather } from "@expo/vector-icons";
import { router, useLocalSearchParams } from "expo-router";
import React from "react";
import { Platform, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { BrutalistButton } from "@/components/BrutalistButton";
import { CourtListItem } from "@/components/CourtListItem";
import { AppTabs } from "@/components/AppTabs";
import { CourtSchedulePanel } from "@/components/CourtSchedulePanel";
import { DetailHeader } from "@/components/DetailHeader";
import { PlayerAvatar } from "@/components/PlayerAvatar";
import { RunCard } from "@/components/RunCard";
import { Colors, Radius } from "@/constants/colors";
import { Court } from "@/constants/data";
import { Typography } from "@/constants/typography";
import { useApp } from "@/context/AppContext";
import { useCourtCounts, usePresence } from "@/context/CourtPresenceContext";
import { useRealtimeHub } from "@/context/RealtimeHubContext";
import { batchHasResource, RealtimeTopic } from "@/lib/realtimeHub";
import { fetchCourtById } from "@/services/courtService";
import { fetchFeed } from "@/services/feedService";
import {
  fetchLeaderboard,
  fetchLocalsWithLastCheckIn,
  LocalWithLastCheckIn,
} from "@/services/profileService";

type CourtTab = "feed" | "locals" | "schedule" | "details";
const COURT_FEED_RESOURCES = ["activity_events", "activity_event_likes"] as const;

export default function CourtProfileScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const {
    courts,
    runs,
    checkIn,
    checkOut,
    checkedInCourtId,
    setLocalCourt,
    localCourtId,
    localCourt: contextLocalCourt,
    isFriend,
  } = useApp();
  const { bottom } = useSafeAreaInsets();
  const [activeTab, setActiveTab] = React.useState<CourtTab>("feed");
  const [court, setCourt] = React.useState<Court | null>(
    courts.find((item) => item.id === id) ?? (contextLocalCourt?.id === id ? contextLocalCourt : null)
  );
  const [fetchError, setFetchError] = React.useState(false);
  const [locals, setLocals] = React.useState<LocalWithLastCheckIn[]>([]);
  const [courtFeed, setCourtFeed] = React.useState<Awaited<ReturnType<typeof fetchFeed>>>([]);
  const [rankedIds, setRankedIds] = React.useState<Set<string>>(new Set());
  const courtId = id ? String(id) : null;
  const realtimeHub = useRealtimeHub();
  const { roster, localCount } = usePresence(courtId);
  const countMap = useCourtCounts(court ? [court] : []);

  React.useEffect(() => {
    if (!courtId || court?.id === courtId) return;
    setFetchError(false);
    fetchCourtById(courtId).then((result) => {
      if (result) setCourt(result);
      else setFetchError(true);
    });
  }, [courtId, court?.id]);

  React.useEffect(() => {
    if (!courtId) {
      setLocals([]);
      return;
    }
    let cancelled = false;
    fetchLocalsWithLastCheckIn(courtId).then((result) => {
      if (!cancelled) setLocals(result);
    });
    return () => {
      cancelled = true;
    };
  }, [courtId]);

  const courtFeedRequestRef = React.useRef(0);
  const refreshCourtFeed = React.useCallback(async () => {
    if (!courtId) {
      setCourtFeed([]);
      return;
    }
    const requestId = ++courtFeedRequestRef.current;
    const items = await fetchFeed(courtId);
    if (requestId === courtFeedRequestRef.current) setCourtFeed(items.slice(0, 30));
  }, [courtId]);

  React.useEffect(() => {
    void refreshCourtFeed();
    return () => {
      courtFeedRequestRef.current += 1;
    };
  }, [refreshCourtFeed]);

  // Court Details owns the exact court it is showing. Subscribe only while
  // this screen is mounted, then refetch that court's authoritative feed.
  React.useEffect(() => {
    if (!courtId) return;
    return realtimeHub.subscribe(`court:${courtId}` as RealtimeTopic, (batch) => {
      if (batchHasResource(batch, COURT_FEED_RESOURCES)) void refreshCourtFeed();
    });
  }, [courtId, realtimeHub, refreshCourtFeed]);

  // Use the same local top-10 leaderboard contract as Compete. A visible
  // court roster must never manufacture a rank from only the people on screen.
  React.useEffect(() => {
    if (!court) {
      setRankedIds(new Set());
      return;
    }
    let cancelled = false;
    fetchLeaderboard("LOCAL", court.id, court.sport).then((players) => {
      if (!cancelled) setRankedIds(new Set(players.slice(0, 10).map((player) => player.id)));
    });
    return () => {
      cancelled = true;
    };
  }, [court?.id, court?.sport]);

  if (!court) {
    return (
      <View style={styles.screen}>
        <DetailHeader title="COURT" onBack={() => router.back()} />
        <View style={styles.notFound}>
          <Text style={styles.notFoundText}>{fetchError ? "COURT NOT FOUND" : "LOADING…"}</Text>
          {fetchError ? <BrutalistButton label="GO BACK" onPress={() => router.back()} variant="outline" /> : null}
        </View>
      </View>
    );
  }

  const courtRuns = runs
    .filter((run) => run.courtId === court.id && new Date(run.startTimeIso).getTime() >= Date.now())
    .sort((a, b) => a.startTimeIso.localeCompare(b.startTimeIso));
  const statsActive = countMap[court.id]?.activeCount ?? court.activeCount ?? 0;
  const activeCount = Math.max(roster.length, statsActive);
  const hiddenCount = Math.max(0, activeCount - roster.length);
  const isCheckedIn = checkedInCourtId === court.id;
  const isMyLocal = localCourtId === court.id;
  const details = getCourtDetails(court);
  const hereNowIds = new Set(roster.map((player) => player.id));
  const visibleLocals = locals.filter(({ player }) => !hereNowIds.has(player.id));
  const privateLocalCount = Math.max(0, localCount - locals.length);
  const courtMetrics = getCourtMetrics(court);

  const handleCheckIn = async () => {
    if (isCheckedIn) await checkOut();
    else await checkIn(court.id);
  };

  return (
    <View style={styles.screen}>
      <DetailHeader title={court.name} onBack={() => router.back()} />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: Platform.OS === "web" ? 92 : bottom + 108 }}
      >
        <View style={styles.cardWrap}>
          <CourtListItem
            court={{ ...court, activeCount, localCount }}
            featured
            isLocalCourt={isMyLocal}
            isCheckedIn={isCheckedIn}
            onCheckIn={() => void handleCheckIn()}
            stats={[
              { label: "ACTIVE NOW", value: hiddenCount > 0 ? `~${activeCount}` : activeCount, live: activeCount > 0 },
              { label: "LOCALS", value: localCount },
              { label: "VISITS", value: court.ratingCount ?? 0 },
              { label: "RUNS", value: courtRuns.length },
            ]}
          />
        </View>

        <AppTabs
          items={([
            { value: "feed", label: "FEED" },
            { value: "locals", label: "LOCALS" },
            { value: "schedule", label: "SCHEDULE" },
            { value: "details", label: "DETAILS" },
          ] as const)}
          value={activeTab}
          onChange={setActiveTab}
        />

        {activeTab === "feed" ? (
          <View style={styles.section}>
            {courtFeed.length > 0 ? courtFeed.map((item, index) => (
              <View key={item.id} style={styles.timelineRow}>
                <View style={styles.timelineRail}>
                  <View style={[styles.timelineDot, index === 0 && styles.timelineDotActive]} />
                  {index < courtFeed.length - 1 ? <View style={styles.timelineLine} /> : null}
                </View>
                <View style={styles.timelineCopy}>
                  <Text style={styles.timelineMessage}>{item.message}</Text>
                  <Text style={styles.timelineTime}>{item.timestamp}</Text>
                </View>
              </View>
            )) : (
              <EmptyState title="NO COURT ACTIVITY YET" body="The first check-in or game here will start the feed." />
            )}
          </View>
        ) : null}

        {activeTab === "locals" ? (
          <View>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>HERE NOW · {activeCount}</Text>
            </View>
            <View style={styles.section}>
              {roster.length > 0 ? roster.map((player) => (
                <Pressable
                  key={player.id}
                  style={({ pressed }) => [styles.personRow, pressed && styles.pressed]}
                  onPress={() => router.push(`/player/${player.id}`)}
                >
                  <PlayerAvatar
                    initials={player.avatar}
                    size={42}
                    ranked={rankedIds.has(player.id)}
                    friend={isFriend(player.id)}
                  />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.personName}>{player.name.toUpperCase()}</Text>
                    <Text style={styles.personMeta}>ACTIVE NOW{rankedIds.has(player.id) ? " · RANKED" : ""}</Text>
                  </View>
                  <Text style={styles.personElo}>{player.elo}</Text>
                </Pressable>
              )) : (
                <EmptyState title="NOBODY PUBLICLY CHECKED IN" body="Private check-ins still count toward the live total without exposing the player." />
              )}
              {hiddenCount > 0 ? (
                <Text style={styles.hiddenNote}>+{hiddenCount} PRIVATE {hiddenCount === 1 ? "PLAYER" : "PLAYERS"} INCLUDED IN THE LIVE COUNT</Text>
              ) : null}
            </View>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>LOCALS · {localCount}</Text>
            </View>
            <View style={styles.section}>
              {visibleLocals.length > 0 ? visibleLocals.map(({ player, lastCheckInAt }) => (
                <Pressable
                  key={player.id}
                  style={({ pressed }) => [styles.personRow, pressed && styles.pressed]}
                  onPress={() => router.push(`/player/${player.id}`)}
                >
                  <PlayerAvatar
                    initials={player.avatar}
                    size={42}
                    ranked={rankedIds.has(player.id)}
                    friend={isFriend(player.id)}
                  />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.personName}>{player.name.toUpperCase()}</Text>
                    <Text style={[styles.personMeta, styles.personMetaQuiet]}>
                      {lastCheckInAt ? `LAST HERE ${relativeTime(lastCheckInAt)}` : "LOCAL PLAYER"}
                    </Text>
                  </View>
                  <Text style={styles.personElo}>{player.elo}</Text>
                </Pressable>
              )) : (
                <Text style={styles.bodyCopy}>No visible local profiles yet.</Text>
              )}
              {privateLocalCount > 0 ? (
                <Text style={styles.hiddenNote}>+{privateLocalCount} PRIVATE {privateLocalCount === 1 ? "LOCAL" : "LOCALS"} INCLUDED IN THE COUNT</Text>
              ) : null}
            </View>
          </View>
        ) : null}

        {activeTab === "schedule" ? (
          <View>
            <CourtSchedulePanel court={court} />

            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>UPCOMING RUNS</Text>
            </View>
            <View style={styles.runSection}>
              {courtRuns.length > 0 ? courtRuns.map((run) => <RunCard key={run.id} run={run} />) : (
                <Pressable
                  style={({ pressed }) => [styles.hostRun, pressed && styles.pressed]}
                  onPress={() => router.push({
                    pathname: "/(tabs)/schedule",
                    params: { courtId: court.id, openCreate: "1" },
                  })}
                >
                  <View>
                    <Text style={styles.hostRunTitle}>BE THE FIRST TO HOST</Text>
                    <Text style={styles.hostRunBody}>Set a time. Build the run.</Text>
                  </View>
                  <Feather name="arrow-up-right" size={18} color={Colors.textSecondary} />
                </Pressable>
              )}
            </View>
          </View>
        ) : null}

        {activeTab === "details" ? (
          <View>
            {courtMetrics.length > 0 ? (
              <View style={styles.metricGrid}>
                {courtMetrics.map((metric) => (
                  <View key={metric.label} style={styles.metricCell}>
                    <Feather name={metric.icon} size={15} color={Colors.accent} />
                    <Text style={styles.metricValue}>{metric.value}</Text>
                    <Text style={styles.metricLabel}>{metric.label}</Text>
                  </View>
                ))}
              </View>
            ) : null}

            {details.length > 0 ? (
              <>
                <View style={styles.sectionHeader}>
                  <Text style={styles.sectionTitle}>COURT DETAILS</Text>
                </View>
                <View style={styles.detailList}>
                  {details.map((detail) => (
                    <View key={detail.label} style={styles.detailRow}>
                      <Text style={styles.detailLabel}>{detail.label}</Text>
                      <Text style={styles.detailValue}>{detail.value}</Text>
                    </View>
                  ))}
                </View>
              </>
            ) : null}

            <View style={styles.localActionWrap}>
              <Pressable
                style={[styles.localAction, isMyLocal && styles.localActionActive]}
                onPress={() => void setLocalCourt(isMyLocal ? null : court.id, court)}
              >
                <Feather name={isMyLocal ? "check" : "map-pin"} size={16} color={isMyLocal ? Colors.black : Colors.text} />
                <Text style={[styles.localActionText, isMyLocal && styles.localActionTextActive]}>
                  {isMyLocal ? "MY LOCAL COURT" : "SET AS MY LOCAL COURT"}
                </Text>
              </Pressable>
            </View>
          </View>
        ) : null}
      </ScrollView>
    </View>
  );
}

function EmptyState({ title, body }: { title: string; body: string }) {
  return (
    <View style={styles.empty}>
      <Text style={styles.emptyTitle}>{title}</Text>
      <Text style={styles.emptyBody}>{body}</Text>
    </View>
  );
}

function relativeTime(value: string): string {
  const elapsed = Date.now() - new Date(value).getTime();
  if (!Number.isFinite(elapsed) || elapsed < 0) return "RECENTLY";
  const minutes = Math.floor(elapsed / 60_000);
  if (minutes < 60) return minutes <= 1 ? "JUST NOW" : `${minutes} MIN AGO`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} HR${hours === 1 ? "" : "S"} AGO`;
  const days = Math.floor(hours / 24);
  return `${days} DAY${days === 1 ? "" : "S"} AGO`;
}

function getCourtDetails(court: Court): Array<{ label: string; value: string }> {
  return [
    court.address ? { label: "ADDRESS", value: court.address } : null,
    court.market ? { label: "MARKET", value: court.market } : null,
    court.surface ? { label: "SURFACE", value: court.surface } : null,
    court.netType ? { label: "NET", value: court.netType } : null,
    court.rimType ? { label: "RIM", value: court.rimType } : null,
    court.waterFountain != null ? { label: "WATER", value: court.waterFountain ? "YES" : "NO" } : null,
    court.status ? { label: "SOURCE", value: court.status === "confirmed" ? "CONFIRMED COURT" : "COMMUNITY COURT" } : null,
  ].filter((item): item is { label: string; value: string } => item !== null);
}

function getCourtMetrics(
  court: Court
): Array<{
  label: string;
  value: string;
  icon: React.ComponentProps<typeof Feather>["name"];
}> {
  const metrics: Array<{
    label: string;
    value: string;
    icon: React.ComponentProps<typeof Feather>["name"];
  }> = [];
  if (court.courtCount != null) metrics.push({ label: "COURTS", value: String(court.courtCount), icon: "grid" });
  if (court.hoopCount != null) metrics.push({ label: "HOOPS", value: String(court.hoopCount), icon: "circle" });
  if (court.covered != null) metrics.push({ label: "COVERED", value: court.covered ? "YES" : "NO", icon: "umbrella" });
  if (court.lights != null) metrics.push({ label: "LIGHTS", value: court.lights ? "YES" : "NO", icon: "sun" });
  return metrics;
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Colors.background },
  notFound: { flex: 1, alignItems: "center", justifyContent: "center", gap: 18, padding: 30, backgroundColor: Colors.background },
  notFoundText: { fontFamily: Typography.heading, fontSize: 22, color: Colors.text, letterSpacing: 1.2 },
  cardWrap: { paddingTop: 10 },
  tabs: { flexDirection: "row", marginTop: 10, paddingHorizontal: 16, borderBottomWidth: 1, borderBottomColor: Colors.border },
  tab: { flex: 1, alignItems: "center", paddingVertical: 13, borderBottomWidth: 2, borderBottomColor: "transparent" },
  tabActive: { borderBottomColor: Colors.accent },
  tabText: { fontFamily: Typography.bodyBold, fontSize: 9, color: Colors.muted, letterSpacing: 1.5 },
  tabTextActive: { color: Colors.text },
  section: { paddingHorizontal: 20, paddingTop: 18, paddingBottom: 22 },
  sectionHeader: { paddingHorizontal: 20, paddingTop: 20, paddingBottom: 9, borderBottomWidth: 1, borderBottomColor: Colors.borderSubtle },
  sectionTitle: { fontFamily: Typography.bodyBold, fontSize: 9, color: Colors.textSecondary, letterSpacing: 1.9 },
  timelineRow: { flexDirection: "row", minHeight: 60 },
  timelineRail: { width: 20, alignItems: "center" },
  timelineDot: { width: 8, height: 8, borderRadius: 4, marginTop: 5, borderWidth: 1, borderColor: Colors.mutedDark, backgroundColor: Colors.background },
  timelineDotActive: { borderColor: Colors.accent, backgroundColor: Colors.accent },
  timelineLine: { flex: 1, width: 1, backgroundColor: Colors.border, marginVertical: 4 },
  timelineCopy: { flex: 1, paddingLeft: 8, paddingBottom: 15 },
  timelineMessage: { fontFamily: Typography.bodyMedium, fontSize: 12, lineHeight: 17, color: Colors.text },
  timelineTime: { fontFamily: Typography.bodyMedium, fontSize: 8, color: Colors.muted, letterSpacing: 1.1, marginTop: 4, textTransform: "uppercase" },
  personRow: { minHeight: 65, flexDirection: "row", alignItems: "center", gap: 12, borderBottomWidth: 1, borderBottomColor: Colors.borderSubtle },
  personName: { fontFamily: Typography.heading, fontSize: 15, color: Colors.text, letterSpacing: 0.4 },
  personMeta: { fontFamily: Typography.bodyBold, fontSize: 7, color: Colors.accent, letterSpacing: 1.2, marginTop: 3 },
  personMetaQuiet: { color: Colors.muted },
  personElo: { fontFamily: Typography.heading, fontSize: 16, color: Colors.textSecondary },
  hiddenNote: { fontFamily: Typography.bodyBold, fontSize: 8, lineHeight: 13, color: Colors.muted, letterSpacing: 1.1, marginTop: 14 },
  bodyCopy: { fontFamily: Typography.body, fontSize: 12, lineHeight: 18, color: Colors.muted },
  runSection: { paddingHorizontal: 16, paddingTop: 14, paddingBottom: 8 },
  hostRun: { minHeight: 82, padding: 16, flexDirection: "row", alignItems: "center", justifyContent: "space-between", backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border, borderRadius: Radius.md },
  hostRunTitle: { fontFamily: Typography.heading, fontSize: 18, color: Colors.text, letterSpacing: 0.5 },
  hostRunBody: { fontFamily: Typography.body, fontSize: 11, color: Colors.muted, marginTop: 4 },
  metricGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8, paddingHorizontal: 20, paddingTop: 22 },
  metricCell: { width: "48%", minHeight: 92, padding: 13, justifyContent: "flex-end", borderWidth: 1, borderColor: Colors.border, borderRadius: Radius.md, backgroundColor: Colors.surface },
  metricValue: { fontFamily: Typography.heading, fontSize: 22, color: Colors.text, marginTop: 9 },
  metricLabel: { fontFamily: Typography.bodyBold, fontSize: 8, color: Colors.muted, letterSpacing: 1.4, marginTop: 2 },
  detailList: { paddingHorizontal: 20 },
  detailRow: { minHeight: 50, flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 20, borderBottomWidth: 1, borderBottomColor: Colors.borderSubtle },
  detailLabel: { fontFamily: Typography.bodyBold, fontSize: 8, color: Colors.muted, letterSpacing: 1.4 },
  detailValue: { flex: 1, textAlign: "right", fontFamily: Typography.bodyMedium, fontSize: 11, color: Colors.textSecondary },
  localActionWrap: { paddingHorizontal: 20, paddingTop: 24 },
  localAction: { minHeight: 48, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 9, borderWidth: 1, borderColor: Colors.border, borderRadius: Radius.sm, backgroundColor: Colors.surface },
  localActionActive: { backgroundColor: Colors.accent, borderColor: Colors.accent },
  localActionText: { fontFamily: Typography.heading, fontSize: 11, color: Colors.text, letterSpacing: 1.4 },
  localActionTextActive: { color: Colors.black },
  empty: { paddingVertical: 42, alignItems: "center", paddingHorizontal: 24 },
  emptyTitle: { fontFamily: Typography.heading, fontSize: 17, color: Colors.text, textAlign: "center", letterSpacing: 0.8 },
  emptyBody: { fontFamily: Typography.body, fontSize: 12, lineHeight: 18, color: Colors.muted, textAlign: "center", marginTop: 7 },
  pressed: { opacity: 0.72 },
});
