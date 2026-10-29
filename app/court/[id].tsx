import { Feather } from "@expo/vector-icons";
import { router, useLocalSearchParams } from "expo-router";
import React from "react";
import { Platform, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { CourtSchedulePanel } from "@/components/CourtSchedulePanel";
import { CourtArt } from "@/components/court/CourtArt";
import { CourtBusyChart } from "@/components/court/CourtBusyChart";
import { CourtGamesPanel } from "@/components/court/CourtGamesPanel";
import { CourtInfoPanel } from "@/components/court/CourtInfoPanel";
import { CourtPlayersPanel } from "@/components/court/CourtPlayersPanel";
import { CourtTabBar, FilterChips, LiveDot, SportLabel } from "@/components/court/CourtParts";
import { ActivityRow } from "@/components/ui/ActivityRow";
import { GameResultModal } from "@/components/ui/GameResultModal";
import { PersonTile } from "@/components/ui/PersonTile";
import { Colors, Radius } from "@/constants/colors";
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

type CourtTab = "live" | "games" | "players" | "week" | "info";
type FeedFilter = "all" | "games" | "checkins";
const COURT_TABS = [
  { value: "live", label: "Live" },
  { value: "games", label: "Games" },
  { value: "players", label: "Players" },
  { value: "week", label: "Week" },
  { value: "info", label: "Info" },
] as const;
const FEED_FILTERS: ReadonlyArray<{ value: FeedFilter; label: string }> = [
  { value: "all", label: "All" },
  { value: "games", label: "Games" },
  { value: "checkins", label: "Check-ins" },
];
const GAME_TYPES = new Set<FeedItem["type"]>(["game_result", "run_result"]);
const COURT_FEED_RESOURCES = ["activity_events", "activity_event_likes"] as const;
const FEED_PAGE = 12;

export default function CourtProfileScreen() {
  const { id, tab } = useLocalSearchParams<{ id: string; tab?: string }>();
  const {
    courts,
    localCourtId,
    localCourt: contextLocalCourt,
    currentUser,
    isFriend,
    runs,
  } = useApp();
  const { top, bottom } = useSafeAreaInsets();
  const hasLocalPlus = useLocalPlus();
  const courtId = id ? String(id) : null;
  // The drawer's Games / Players / Feed / Week chips open the page on that tab.
  const [activeTab, setActiveTab] = React.useState<CourtTab>(
    COURT_TABS.some((item) => item.value === tab) ? (tab as CourtTab) : "live",
  );
  const [feedFilter, setFeedFilter] = React.useState<FeedFilter>("all");
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
  const [feedVisible, setFeedVisible] = React.useState(FEED_PAGE);
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
    setFeedVisible(FEED_PAGE);
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
  const filteredFeed = groupedCourtFeed.filter((item) =>
    feedFilter === "all" ? true : feedFilter === "games" ? GAME_TYPES.has(item.type) : !GAME_TYPES.has(item.type),
  );
  const distance = court.distanceKm != null && !Number.isNaN(court.distanceKm)
    ? `${(court.distanceKm * 0.621371).toFixed(1)} mi`
    : null;
  const place = [court.city || court.market || court.neighborhood, distance].filter(Boolean).join(" · ");
  const listPad = Math.max(bottom, 16) + 8;

  const openActivity = (item: FeedItem) => {
    if (item.type === "game_result" && item.match) {
      setSelectedResult({ match: item.match, sport: item.sport, courtName: item.courtName });
    } else if (item.playerId) {
      router.push(`/player/${item.playerId}`);
    }
  };

  return (
    <View style={styles.screen}>
      <View style={[styles.header, { paddingTop: Platform.OS === "web" ? 44 : top }]}>
        <CourtArt faint sport={court.sport} top={(Platform.OS === "web" ? 44 : top) + 44} />
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
          {/* Your courts (Oct 29): the bookmark is on for your local court.
              Saving other courts to a list comes with LocalPlus courts. */}
          <View
            accessibilityLabel={isMyLocal ? "Your local court" : "Not one of your courts"}
            accessible
            style={[styles.bookmark, isMyLocal && styles.bookmarkOn]}
          >
            <Feather color={isMyLocal ? Colors.accent : Colors.textSecondary} name="bookmark" size={17} />
          </View>
        </View>
        {/* Name left, the live number right (Oct 17 header reference), then
            today's busy times above the tabs so every tab shares them. */}
        <View style={styles.titleRow}>
          <View style={styles.titleBlock}>
            <SportLabel sport={court.sport} />
            <Text adjustsFontSizeToFit minimumFontScale={0.6} numberOfLines={1} style={styles.name}>
              {court.shortName || court.name}
            </Text>
            {place ? <Text numberOfLines={1} style={styles.place}>{place}</Text> : null}
          </View>
          <View
            accessibilityLabel={`${hiddenCount > 0 ? "About " : ""}${activeCount} on court`}
            style={styles.liveBlock}
          >
            <Text style={[styles.liveValue, activeCount > 0 && styles.liveValueOn]}>
              {hiddenCount > 0 ? `~${activeCount}` : activeCount}
            </Text>
            <View style={styles.liveLabelRow}>
              {activeCount > 0 ? <LiveDot /> : null}
              <Text style={styles.liveLabel}>On court</Text>
            </View>
          </View>
        </View>
        <View style={styles.busyHeader}>
          <CourtBusyChart courtId={court.id} games={upcomingGames} height={34} refreshKey={roster.length} variant="header" />
        </View>
        <CourtTabBar active={activeTab} onChange={setActiveTab} tabs={COURT_TABS} />
      </View>

      <View style={styles.tabContent}>
        {activeTab === "live" ? (
          <ScrollView contentContainerStyle={{ paddingBottom: listPad }} showsVerticalScrollIndicator={false}>
            <View style={styles.onCourt}>
              <Text style={styles.eyebrow}>On court · {hiddenCount > 0 ? `~${activeCount}` : activeCount}</Text>
              {roster.length > 0 || hiddenCount > 0 ? (
                <ScrollView contentContainerStyle={styles.roster} horizontal showsHorizontalScrollIndicator={false}>
                  {roster.map((player) => (
                    <PersonTile
                      friend={isFriend(player.id)}
                      key={player.id}
                      onPress={() => router.push(`/player/${player.id}`)}
                      player={player}
                    />
                  ))}
                  {hiddenCount > 0 ? <Text style={styles.privateInline}>+{hiddenCount} private</Text> : null}
                </ScrollView>
              ) : (
                <Text style={styles.emptyLine}>Nobody yet. Check in and you're first.</Text>
              )}
            </View>
            <FilterChips
              active={feedFilter}
              chips={FEED_FILTERS}
              onPress={(value) => {
                setFeedFilter(value);
                setFeedVisible(FEED_PAGE);
              }}
            />
            {filteredFeed.length > 0 ? (
              filteredFeed.slice(0, feedVisible).map((item, index) => (
                <ActivityRow
                  isLast={index === Math.min(feedVisible, filteredFeed.length) - 1}
                  item={item}
                  key={item.id}
                  previous={filteredFeed[index - 1]}
                  showActor
                  onActorPress={item.playerId ? () => router.push(`/player/${item.playerId}`) : undefined}
                  onPress={item.type === "game_result" && !item.match ? undefined : () => openActivity(item)}
                />
              ))
            ) : (
              <EmptyState title="No court activity yet" body="The first check-in or game here will start the feed." />
            )}
            {feedVisible < filteredFeed.length ? (
              <Pressable onPress={() => setFeedVisible((count) => count + FEED_PAGE)} style={styles.moreButton}>
                <Text style={styles.moreText}>VIEW MORE</Text>
                <Feather color={Colors.textSecondary} name="chevron-down" size={14} />
              </Pressable>
            ) : null}
          </ScrollView>
        ) : null}

        {activeTab === "games" ? (
          <ScrollView contentContainerStyle={{ paddingBottom: listPad }} showsVerticalScrollIndicator={false}>
            <CourtGamesPanel
              games={upcomingGames}
              onCreate={() => router.push({ pathname: "/(tabs)/schedule", params: { courtId: court.id, openCreate: "1" } })}
              onOpen={(game) => router.push(`/run/${game.id}`)}
            />
          </ScrollView>
        ) : null}

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

        {activeTab === "week" ? (
          <View style={styles.scheduleView}>
            <CourtSchedulePanel bottomInset={bottom} court={court} />
          </View>
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

function EmptyState({ title, body }: { title: string; body: string }) {
  return (
    <View style={styles.empty}>
      <Text style={styles.emptyTitle}>{title}</Text>
      <Text style={styles.emptyBody}>{body}</Text>
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
  navRow: { height: 44, paddingLeft: 12, paddingRight: 16, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  back: { width: 38, height: 38, alignItems: "center", justifyContent: "center" },
  bookmark: {
    width: 36,
    height: 36,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: Radius.button,
    borderWidth: 1,
    borderColor: Colors.hairlineChrome,
  },
  bookmarkOn: { backgroundColor: Colors.liveQuiet, borderColor: Colors.accentBorder },
  titleRow: { flexDirection: "row", alignItems: "flex-end", gap: 16, paddingHorizontal: 20, paddingTop: 6 },
  titleBlock: { flex: 1, minWidth: 0, gap: 6 },
  liveBlock: { flexShrink: 0, alignItems: "flex-end", paddingBottom: 1 },
  liveValue: { fontFamily: Typography.headingBold, fontSize: 46, lineHeight: 48, letterSpacing: -1.4, color: Colors.text, fontVariant: ["tabular-nums"] },
  liveValueOn: { color: Colors.liveInk },
  liveLabelRow: { flexDirection: "row", alignItems: "center", gap: 5, marginTop: 2 },
  liveLabel: { fontFamily: Typography.bodyBold, fontSize: 9, letterSpacing: 1.2, textTransform: "uppercase", color: Colors.textSecondary },
  busyHeader: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 10 },
  name: {
    fontFamily: Typography.headingBold,
    fontSize: 34,
    lineHeight: 37,
    letterSpacing: -1.1,
    textTransform: "uppercase",
    color: Colors.text,
    textShadowColor: Colors.sheet,
    textShadowRadius: 6,
  },
  place: { fontFamily: Typography.bodyMedium, fontSize: 11, color: Colors.textSecondary },
  tabContent: { flex: 1, minHeight: 0 },
  scheduleView: { flex: 1, minHeight: 0, overflow: "hidden" },
  onCourt: { paddingTop: 16, gap: 10 },
  eyebrow: { paddingHorizontal: 20, fontFamily: Typography.bodyBold, fontSize: 9, letterSpacing: 1.3, textTransform: "uppercase", color: Colors.textSecondary },
  roster: { paddingHorizontal: 20, gap: Space.md, alignItems: "center" },
  privateInline: { fontFamily: Typography.bodyMedium, fontSize: 10, color: Colors.muted },
  emptyLine: { paddingHorizontal: 20, fontFamily: Typography.bodyMedium, fontSize: 12, color: Colors.textSecondary },
  moreButton: { minHeight: 48, marginHorizontal: Layout.screenGutter, marginTop: Space.md, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: Space.sm, borderWidth: 1, borderColor: Colors.border, borderRadius: Radius.md },
  moreText: { fontFamily: Typography.bodyBold, fontSize: 9, color: Colors.textSecondary, letterSpacing: 1.2 },
  empty: { minHeight: 72, paddingHorizontal: Layout.screenGutter, paddingVertical: Space.md, alignItems: "center", justifyContent: "center" },
  emptyTitle: { fontFamily: Typography.heading, fontSize: 16, color: Colors.text, textAlign: "center" },
  emptyBody: { maxWidth: 300, marginTop: Space.sm, fontFamily: Typography.body, fontSize: 11, lineHeight: 17, color: Colors.muted, textAlign: "center" },
  pressed: { opacity: 0.72 },
});
