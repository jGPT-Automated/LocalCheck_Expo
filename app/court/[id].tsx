import { Feather } from "@expo/vector-icons";
import { router, useLocalSearchParams } from "expo-router";
import React from "react";
import { Platform, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { CourtSchedulePanel } from "@/components/CourtSchedulePanel";
import { CourtArt } from "@/components/court/CourtArt";
import { CourtActivityFeed } from "@/components/court/CourtActivityFeed";
import type { CourtHourPick } from "@/lib/courtActivityModel";
import { CourtGamesPanel } from "@/components/court/CourtGamesPanel";
import { CourtInfoPanel } from "@/components/court/CourtInfoPanel";
import { CourtPlayersPanel } from "@/components/court/CourtPlayersPanel";
import { CourtTabBar, CourtTitleRow, LocalMark } from "@/components/court/CourtParts";
import { GameResultModal } from "@/components/ui/GameResultModal";
import { Colors } from "@/constants/colors";
import type { FeedItem, FeedMatchSummary, Court } from "@/constants/data";
import { Layout, Space } from "@/constants/layout";
import { Typography } from "@/constants/typography";
import { useApp } from "@/context/AppContext";
import { useLocalPlus } from "@/hooks/useLocalPlus";
import { useCourtCounts, usePresence } from "@/context/CourtPresenceContext";
import { useRealtimeHub } from "@/context/RealtimeHubContext";
import { batchHasResource, type RealtimeTopic } from "@/lib/realtimeHub";
import { openCourtInMaps } from "@/lib/openMaps";
import { groupCheckinBursts, pairVisits } from "@/lib/activityPresentation";
import {
  courtHours,
  formatAverageSession,
  formatCourtHours,
  type CourtHours,
} from "@/lib/courtHours";
import { type CourtRecord, fetchCourtById, fetchCourtRecords, fetchCourtWeekSpans } from "@/services/courtService";
import { type CourtPlayer } from "@/lib/courtPlayersModel";
import { fetchFeed } from "@/services/feedService";
import {
  fetchLocalsWithLastCheckIn,
  type LocalWithLastCheckIn,
} from "@/services/profileService";

type CourtTab = "feed" | "schedule" | "players" | "info";
const COURT_TABS = [
  { value: "feed", label: "Feed" },
  { value: "schedule", label: "Schedule" },
  { value: "players", label: "Players" },
  { value: "info", label: "Info" },
] as const;
function courtTab(tab?: string): CourtTab {
  if (tab === "week" || tab === "games" || tab === "schedule") return "schedule";
  return tab === "players" || tab === "info" ? tab : "feed";
}
const COURT_FEED_RESOURCES = ["activity_events", "activity_event_likes"] as const;

export default function CourtProfileScreen() {
  const { id, tab } = useLocalSearchParams<{ id: string; tab?: string }>();
  const {
    courts,
    localCourtId,
    localCourt: contextLocalCourt,
    currentUser,
    setLocalCourt,
    isFriend,
    runs,
  } = useApp();
  const { top, bottom } = useSafeAreaInsets();
  const hasLocalPlus = useLocalPlus();
  const courtId = id ? String(id) : null;
  const [activeTab, setActiveTab] = React.useState<CourtTab>(
    courtTab(tab),
  );
  const [hourPick, setHourPick] = React.useState<CourtHourPick | undefined>();
  const [court, setCourt] = React.useState<Court | null>(
    courts.find((item) => item.id === id) ?? (contextLocalCourt?.id === id ? contextLocalCourt : null),
  );
  const [fetchError, setFetchError] = React.useState(false);
  const [locals, setLocals] = React.useState<LocalWithLastCheckIn[]>([]);
  const [records, setRecords] = React.useState<Record<string, CourtRecord>>({});
  const [courtFeed, setCourtFeed] = React.useState<Awaited<ReturnType<typeof fetchFeed>>>([]);
  const groupedCourtFeed = React.useMemo(
    () => groupCheckinBursts(pairVisits(courtFeed, { splitToday: true })),
    [courtFeed],
  );
  const [week, setWeek] = React.useState<CourtHours>({ hours: 0, sessions: 0 });
  const [selectedResult, setSelectedResult] = React.useState<{
    match: FeedMatchSummary;
    sport: FeedItem["sport"];
    courtName?: string;
  } | null>(null);
  const realtimeHub = useRealtimeHub();
  const { roster, localCount } = usePresence(courtId);
  const countMap = useCourtCounts(court ? [court] : []);

  React.useEffect(() => {
    if (!courtId || court?.id === courtId) return;
    setFetchError(false);
    void fetchCourtById(courtId).then((result) => {
      if (result) setCourt(result);
      else setFetchError(true);
    });
  }, [courtId, court?.id]);

  const courtSport = court?.sport;
  React.useEffect(() => {
    if (!courtId) return;
    let cancelled = false;
    void Promise.all([
      fetchLocalsWithLastCheckIn(courtId, courtSport),
      fetchCourtWeekSpans(courtId),
      fetchCourtRecords(courtId),
    ]).then(([nextLocals, spans, nextRecords]) => {
      if (cancelled) return;
      setLocals(nextLocals);
      setWeek(courtHours(spans));
      setRecords(nextRecords);
    });
    return () => { cancelled = true; };
  }, [courtId, courtSport]);

  const refreshCourtFeed = React.useCallback(async () => {
    if (!courtId) return setCourtFeed([]);
    setCourtFeed((await fetchFeed(courtId, currentUser.id)).slice(0, 50));
  }, [courtId, currentUser.id]);

  React.useEffect(() => {
    void refreshCourtFeed();
  }, [refreshCourtFeed]);

  React.useEffect(() => {
    if (!courtId) return;
    return realtimeHub.subscribe(`court:${courtId}` as RealtimeTopic, (batch) => {
      if (batchHasResource(batch, COURT_FEED_RESOURCES)) void refreshCourtFeed();
    });
  }, [courtId, realtimeHub, refreshCourtFeed]);

  // Full player-level detail is the headline LocalPlus perk — see
  // docs/product/DECISIONS.md. Your own local court always stays free.
  // This full page is a deeper drill-in, not the primary surface (the court
  // drawer is — components/sheet/CourtSheetContent.tsx shows an in-place
  // gate there instead). Redirecting straight to /localplus here, rather
  // than building a second in-page gate, also makes this the single
  // enforcement point for every path that can land on this route — the
  // drawer's VIEW COURT button, a player's LOCAL COURT link, a deep link —
  // so none of them can be gated individually and missed.
  const isMyLocal = court ? localCourtId === court.id : false;
  const gated = court ? !isMyLocal && !hasLocalPlus : false;

  React.useEffect(() => {
    if (gated) router.replace("/localplus");
  }, [gated]);

  if (!court) {
    return (
      <View style={styles.notFound}>
        <Text style={styles.notFoundText}>{fetchError ? "Court not found" : "Loading…"}</Text>
        {fetchError ? (
          <Pressable onPress={() => router.back()} style={styles.retryButton}>
            <Text style={styles.retryText}>GO BACK</Text>
          </Pressable>
        ) : null}
      </View>
    );
  }

  if (gated) return null;

  const statsActive = countMap[court.id]?.activeCount ?? court.activeCount ?? 0;
  const activeCount = Math.max(roster.length, statsActive);
  const hiddenCount = Math.max(0, activeCount - roster.length);
  const hereNowIds = new Set(roster.map((player) => player.id));
  const courtPlayers: CourtPlayer[] = locals.map(({ player, lastCheckInAt, joinedAt, checkInCount }) => ({
    id: player.id,
    name: player.name,
    avatar: player.avatar,
    elo: player.elo,
    wins: records[player.id]?.wins ?? 0,
    losses: records[player.id]?.losses ?? 0,
    checkIns: checkInCount,
    lastCheckInAt,
    joinedAt,
    activeNow: hereNowIds.has(player.id),
  }));
  const privateLocalCount = Math.max(0, localCount - locals.length);
  const now = Date.now();
  const upcomingGames = runs
    .filter((run) => run.courtId === court.id && Date.parse(run.startTimeIso) >= now - 60 * 60_000)
    .sort((a, b) => a.startTimeIso.localeCompare(b.startTimeIso));
  const hoursLabel = formatCourtHours(week.hours);
  const distance = court.distanceKm != null && !Number.isNaN(court.distanceKm)
    ? `${(court.distanceKm * 0.621371).toFixed(1)} mi`
    : null;
  const place = [court.city || court.market || court.neighborhood, distance].filter(Boolean).join(" · ");
  const listPad = Math.max(bottom, 16) + 8;

  const openActivity = (item: FeedItem) => {
    if (item.type === "game_result" && item.match) {
      setSelectedResult({ match: item.match, sport: item.sport, courtName: item.courtName });
    } else if (item.runId) {
      router.push(`/run/${item.runId}`);
    } else if (item.playerId) {
      router.push(`/player/${item.playerId}`);
    }
  };

  return (
    <View style={styles.screen}>
      <View style={[styles.header, { paddingTop: Platform.OS === "web" ? 44 : top }]}>
        <CourtArt faint sport={court.sport} top={(Platform.OS === "web" ? 44 : top) + 22} />
        <View style={styles.navRow}>
          <Pressable
            accessibilityLabel="Back"
            accessibilityRole="button"
            hitSlop={8}
            onPress={() => router.canGoBack() ? router.back() : router.replace("/(tabs)")}
            style={({ pressed }) => [styles.back, pressed && styles.pressed]}
          >
            <Feather color={Colors.text} name="arrow-left" size={22} />
          </Pressable>
          <LocalMark active={isMyLocal} onPress={() => void setLocalCourt(court.id, court)} />
        </View>
        {/* Name left, the live number right (Oct 17 header reference), then
            today's busy times above the tabs so every tab shares them. */}
        <View style={styles.titleRow}>
          <CourtTitleRow
            live={activeCount > 0}
            liveAccessibilityLabel={`${hiddenCount > 0 ? "About " : ""}${activeCount} on court`}
            liveValue={hiddenCount > 0 ? `~${activeCount}` : activeCount}
            name={court.shortName || court.name}
            place={place || undefined}
            size="page"
            sport={court.sport}
          />
        </View>
        <CourtTabBar active={activeTab} onChange={setActiveTab} tabs={COURT_TABS} />
      </View>

      <View style={styles.tabContent}>
        {activeTab === "feed" ? <CourtActivityFeed key={`${court.id}-${hourPick?.dayOffset}-${hourPick?.hour}`}
          court={court} roster={roster} activeCount={activeCount} games={runs.filter((r) => r.courtId === court.id)} events={groupedCourtFeed}
          bottomInset={listPad} onActivity={openActivity} initialPick={hourPick} /> : null}

        {activeTab === "schedule" ? <CourtSchedulePanel bottomInset={listPad} court={court}
          onSelectHour={(pick) => { setHourPick(pick); setActiveTab("feed"); }}>
          <CourtGamesPanel games={upcomingGames} onCreate={() => router.push({ pathname: "/(tabs)/schedule", params: { courtId: court.id, openCreate: "1" } })}
            onOpen={(game) => router.push(`/run/${game.id}`)} />
        </CourtSchedulePanel> : null}

        {activeTab === "players" ? (
          <CourtPlayersPanel
            bottomInset={listPad}
            hiddenLocals={privateLocalCount}
            isFriend={isFriend}
            meId={currentUser.id}
            onPlayer={(playerId) => router.push(`/player/${playerId}`)}
            players={courtPlayers}
          />
        ) : null}

        {activeTab === "info" ? (
          <ScrollView contentContainerStyle={{ paddingBottom: listPad }} showsVerticalScrollIndicator={false}>
            <CourtInfoPanel
              averageSession={formatAverageSession(week)}
              court={court}
              hoursLabel={hoursLabel}
              locals={localCount}
              onDirections={() => void openCourtInMaps(court)}
            />
          </ScrollView>
        ) : null}
      </View>

      <GameResultModal
        courtName={selectedResult?.courtName}
        match={selectedResult?.match ?? null}
        onClose={() => setSelectedResult(null)}
        sport={selectedResult?.sport}
        visible={Boolean(selectedResult)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Colors.background },
  notFound: { flex: 1, alignItems: "center", justifyContent: "center", gap: Space.lg, padding: 30, backgroundColor: Colors.background },
  notFoundText: { fontFamily: Typography.heading, fontSize: 22, color: Colors.text },
  retryButton: { minHeight: 44, paddingHorizontal: Space.xl, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: Colors.border },
  retryText: { fontFamily: Typography.bodyBold, fontSize: 10, color: Colors.text, letterSpacing: 1.2 },
  header: { position: "relative", overflow: "hidden" },
  navRow: { height: 44, paddingLeft: 12, paddingRight: 9, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  back: { width: 38, height: 38, alignItems: "center", justifyContent: "center" },
  titleRow: { paddingTop: 6 },
  tabContent: { flex: 1, minHeight: 0 },
  pressed: { opacity: 0.72 },
});
