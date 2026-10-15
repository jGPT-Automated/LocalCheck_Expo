import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { router, useLocalSearchParams } from "expo-router";
import React from "react";
import { ActivityIndicator, Platform, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { CourtSchedulePanel } from "@/components/CourtSchedulePanel";
import { SectionHeader } from "@/components/ScreenHeader";
import { CourtArt } from "@/components/court/CourtArt";
import { CourtGamesPanel } from "@/components/court/CourtGamesPanel";
import { CourtInfoPanel } from "@/components/court/CourtInfoPanel";
import { CourtTabBar, LiveDot, LocalPill, MetricStrip, SportLabel } from "@/components/court/CourtParts";
import { ActivityRow } from "@/components/ui/ActivityRow";
import { GameResultModal } from "@/components/ui/GameResultModal";
import { PersonTile } from "@/components/ui/PersonTile";
import { PlayerSummaryRow } from "@/components/ui/PlayerSummaryRow";
import { useToast } from "@/components/ui/Toast";
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
import { isInactiveLocal, relativeTime } from "@/lib/localPresence";
import { groupCheckinBursts, pairVisits } from "@/lib/activityPresentation";
import {
  courtHours,
  formatAverageSession,
  formatCourtHours,
  formatNextGame,
  type CourtHours,
} from "@/lib/courtHours";
import { fetchCourtById, fetchCourtWeekSpans } from "@/services/courtService";
import { fetchFeed } from "@/services/feedService";
import {
  fetchLeaderboard,
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
  const { id } = useLocalSearchParams<{ id: string }>();
  const {
    courts,
    localCourtId,
    localCourt: contextLocalCourt,
    currentUser,
    setLocalCourt,
    isFriend,
    runs,
    checkedInCourtId,
    pendingAutoCheckIn,
    hideAutoCheckIn,
    checkIn,
    checkOut,
  } = useApp();
  const { top, bottom } = useSafeAreaInsets();
  const { showToast } = useToast();
  const hasLocalPlus = useLocalPlus();
  const courtId = id ? String(id) : null;
  const [activeTab, setActiveTab] = React.useState<CourtTab>("live");
  const [feedFilter, setFeedFilter] = React.useState<FeedFilter>("all");
  const [isChecking, setIsChecking] = React.useState(false);
  const [court, setCourt] = React.useState<Court | null>(
    courts.find((item) => item.id === id) ?? (contextLocalCourt?.id === id ? contextLocalCourt : null),
  );
  const [fetchError, setFetchError] = React.useState(false);
  const [locals, setLocals] = React.useState<LocalWithLastCheckIn[]>([]);
  const [courtFeed, setCourtFeed] = React.useState<Awaited<ReturnType<typeof fetchFeed>>>([]);
  const groupedCourtFeed = React.useMemo(
    () => groupCheckinBursts(pairVisits(courtFeed)),
    [courtFeed],
  );
  const [rankedIds, setRankedIds] = React.useState<Set<string>>(new Set());
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

  React.useEffect(() => {
    if (!courtId) return;
    let cancelled = false;
    void Promise.all([
      fetchLocalsWithLastCheckIn(courtId),
      fetchCourtWeekSpans(courtId),
    ]).then(([nextLocals, spans]) => {
      if (cancelled) return;
      setLocals(nextLocals);
      setWeek(courtHours(spans));
    });
    return () => { cancelled = true; };
  }, [courtId]);

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

  React.useEffect(() => {
    if (!court) return;
    let cancelled = false;
    void fetchLeaderboard("LOCAL", court.id, court.sport).then((players) => {
      if (!cancelled) setRankedIds(new Set(players.slice(0, 10).map((player) => player.id)));
    });
    return () => { cancelled = true; };
  }, [court]);

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
  const visibleLocals = locals.filter(({ player }) => !hereNowIds.has(player.id));
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
  const waitingToPost = pendingAutoCheckIn?.courtId === court.id && checkedInCourtId !== court.id;
  const isCheckedIn = checkedInCourtId === court.id || waitingToPost;
  const listPad = 24;
  const barBottom = Platform.OS === "web" ? 16 : Math.max(bottom, 16);

  const openActivity = (item: FeedItem) => {
    if (item.type === "game_result" && item.match) {
      setSelectedResult({ match: item.match, sport: item.sport, courtName: item.courtName });
    } else if (item.playerId) {
      router.push(`/player/${item.playerId}`);
    }
  };

  const handleCheckIn = async () => {
    if (isChecking) return;
    setIsChecking(true);
    try {
      if (waitingToPost) {
        if (Platform.OS !== "web") void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        await hideAutoCheckIn();
      } else if (isCheckedIn) {
        if (Platform.OS !== "web") void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        await checkOut();
      } else if (await checkIn(court.id)) {
        showToast({
          title: `CHECKED IN · ${(court.shortName || court.name).toUpperCase()}`,
          body: "Check out when you leave.",
          icon: "map-pin",
        });
      }
    } finally {
      setIsChecking(false);
    }
  };

  return (
    <View style={styles.screen}>
      <View style={[styles.header, { paddingTop: Platform.OS === "web" ? 44 : top }]}>
        <CourtArt sport={court.sport} top={(Platform.OS === "web" ? 44 : top) + 44} />
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
          <LocalPill isLocal={isMyLocal} onPress={() => void setLocalCourt(isMyLocal ? null : court.id, court)} />
        </View>
        <View style={styles.titleBlock}>
          <SportLabel sport={court.sport} />
          <Text adjustsFontSizeToFit minimumFontScale={0.6} numberOfLines={1} style={styles.name}>
            {court.shortName || court.name}
          </Text>
          {place ? <Text numberOfLines={1} style={styles.place}>{place}</Text> : null}
        </View>
        <View style={styles.stripWrap}>
          <MetricStrip
            cells={[
              { label: "On court", value: hiddenCount > 0 ? `~${activeCount}` : activeCount, live: activeCount > 0 },
              { label: "Court hours · wk", value: hoursLabel },
              { label: "Next game", value: formatNextGame(upcomingGames[0]?.startTimeIso) },
            ]}
          />
        </View>
        <CourtTabBar active={activeTab} onChange={setActiveTab} tabs={COURT_TABS} />
      </View>

      <View style={styles.tabContent}>
        {activeTab === "live" ? (
          <ScrollView alwaysBounceVertical={false} contentContainerStyle={{ paddingBottom: listPad }} showsVerticalScrollIndicator={false}>
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
            <View style={styles.filters}>
              {FEED_FILTERS.map((filter) => {
                const selected = feedFilter === filter.value;
                return (
                  <Pressable
                    accessibilityRole="button"
                    accessibilityState={{ selected }}
                    key={filter.value}
                    onPress={() => {
                      setFeedFilter(filter.value);
                      setFeedVisible(FEED_PAGE);
                    }}
                    style={[styles.chip, selected && styles.chipActive]}
                  >
                    <Text style={[styles.chipText, selected && styles.chipTextActive]}>{filter.label}</Text>
                  </Pressable>
                );
              })}
            </View>
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
          <ScrollView alwaysBounceVertical={false} contentContainerStyle={{ paddingBottom: listPad }} showsVerticalScrollIndicator={false}>
            <CourtGamesPanel games={upcomingGames} onOpen={(game) => router.push(`/run/${game.id}`)} />
          </ScrollView>
        ) : null}

        {activeTab === "players" ? (
          <ScrollView alwaysBounceVertical={false} contentContainerStyle={{ paddingBottom: listPad }} showsVerticalScrollIndicator={false}>
            <SectionHeader count={activeCount} title="Here now" />
            {roster.length > 0 ? roster.map((player) => {
              const history = locals.find((entry) => entry.player.id === player.id);
              return (
                <PlayerSummaryRow
                  checkInCount={history?.checkInCount}
                  detail={rankedIds.has(player.id) ? "Active now · Top 10" : "Active now"}
                  friend={isFriend(player.id)}
                  key={player.id}
                  onPress={() => router.push(`/player/${player.id}`)}
                  player={player}
                  ranked={rankedIds.has(player.id)}
                />
              );
            }) : <EmptyState title="Nobody publicly checked in" body="Private check-ins remain included in the live total." />}
            {hiddenCount > 0 ? <Text style={styles.privateNote}>+{hiddenCount} private {hiddenCount === 1 ? "player" : "players"}</Text> : null}

            <SectionHeader count={localCount} title="Locals" />
            {visibleLocals.length > 0 ? visibleLocals.map(({ player, lastCheckInAt, checkInCount }) => (
              <PlayerSummaryRow
                checkInCount={checkInCount}
                detail={lastCheckInAt ? `Last here · ${relativeTime(lastCheckInAt)}` : "No check-ins yet"}
                friend={isFriend(player.id)}
                inactive={isInactiveLocal(lastCheckInAt)}
                key={player.id}
                onPress={() => router.push(`/player/${player.id}`)}
                player={player}
                ranked={rankedIds.has(player.id)}
              />
            )) : <EmptyState title="No visible local profiles" body="Locals appear here after choosing this as their home court." />}
            {privateLocalCount > 0 ? <Text style={styles.privateNote}>+{privateLocalCount} private {privateLocalCount === 1 ? "local" : "locals"}</Text> : null}
          </ScrollView>
        ) : null}

        {activeTab === "week" ? (
          <View style={styles.scheduleView}>
            <CourtSchedulePanel bottomInset={12} court={court} />
          </View>
        ) : null}

        {activeTab === "info" ? (
          <ScrollView alwaysBounceVertical={false} contentContainerStyle={{ paddingBottom: listPad }} showsVerticalScrollIndicator={false}>
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

      <View style={[styles.bottomBar, { paddingBottom: barBottom }]}>
        <Pressable
          accessibilityHint="Opens the week view to plan a visit"
          accessibilityRole="button"
          onPress={() => setActiveTab("week")}
          style={({ pressed }) => [styles.barButton, styles.planButton, pressed && styles.pressed]}
        >
          <Text style={styles.planText}>Plan visit</Text>
        </Pressable>
        <Pressable
          accessibilityLabel={isCheckedIn ? `Check out of ${court.shortName || court.name}` : `Check in to ${court.shortName || court.name}`}
          accessibilityRole="button"
          accessibilityState={{ busy: isChecking, selected: isCheckedIn }}
          disabled={isChecking}
          onPress={() => void handleCheckIn()}
          style={({ pressed }) => [styles.barButton, isCheckedIn ? styles.checkOutButton : styles.checkInButton, pressed && styles.pressed]}
        >
          {isChecking ? (
            <ActivityIndicator color={isCheckedIn ? Colors.text : Colors.black} size="small" />
          ) : isCheckedIn ? (
            <View style={styles.checkOutInner}>
              <LiveDot />
              <Text style={styles.checkOutText}>Check out</Text>
            </View>
          ) : (
            <Text style={styles.checkInText}>Check in</Text>
          )}
        </Pressable>
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
  titleBlock: { paddingHorizontal: 20, paddingTop: 6, gap: 6 },
  name: {
    fontFamily: Typography.headingBold,
    fontSize: 38,
    lineHeight: 40,
    letterSpacing: -1.2,
    textTransform: "uppercase",
    color: Colors.text,
    textShadowColor: Colors.sheet,
    textShadowRadius: 6,
  },
  place: { fontFamily: Typography.bodyMedium, fontSize: 11, color: Colors.textSecondary },
  stripWrap: { paddingHorizontal: 20, paddingTop: 14, paddingBottom: 12 },
  tabContent: { flex: 1, minHeight: 0 },
  scheduleView: { flex: 1, minHeight: 0, overflow: "hidden" },
  onCourt: { paddingTop: 16, gap: 10 },
  eyebrow: { paddingHorizontal: 20, fontFamily: Typography.bodyBold, fontSize: 9, letterSpacing: 1.3, textTransform: "uppercase", color: Colors.textSecondary },
  roster: { paddingHorizontal: 20, gap: Space.md, alignItems: "center" },
  privateInline: { fontFamily: Typography.bodyMedium, fontSize: 10, color: Colors.muted },
  emptyLine: { paddingHorizontal: 20, fontFamily: Typography.bodyMedium, fontSize: 12, color: Colors.textSecondary },
  filters: { flexDirection: "row", gap: 6, paddingHorizontal: 20, paddingTop: 16, paddingBottom: 6 },
  chip: { height: 30, paddingHorizontal: 12, borderRadius: 999, justifyContent: "center", borderWidth: 1, borderColor: "rgba(242,242,246,0.12)" },
  chipActive: { backgroundColor: Colors.text, borderColor: Colors.text },
  chipText: { fontFamily: Typography.bodyBold, fontSize: 9, letterSpacing: 1.1, textTransform: "uppercase", color: Colors.textSecondary },
  chipTextActive: { color: Colors.background },
  moreButton: { minHeight: 48, marginHorizontal: Layout.screenGutter, marginTop: Space.md, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: Space.sm, borderWidth: 1, borderColor: Colors.border, borderRadius: Radius.md },
  moreText: { fontFamily: Typography.bodyBold, fontSize: 9, color: Colors.textSecondary, letterSpacing: 1.2 },
  privateNote: { paddingHorizontal: Layout.screenGutter, paddingVertical: Space.md, fontFamily: Typography.bodyMedium, fontSize: 9, color: Colors.muted },
  bottomBar: { flexDirection: "row", gap: 10, paddingHorizontal: 20, paddingTop: 12, borderTopWidth: 1, borderTopColor: Colors.hairline, backgroundColor: Colors.background },
  barButton: { flex: 1, height: 52, borderRadius: 4, alignItems: "center", justifyContent: "center" },
  planButton: { backgroundColor: Colors.panel, borderWidth: 1, borderColor: Colors.hairlineChrome },
  planText: { fontFamily: Typography.bodyBold, fontSize: 12, letterSpacing: 1.6, textTransform: "uppercase", color: Colors.text },
  checkInButton: { backgroundColor: Colors.accent },
  checkInText: { fontFamily: Typography.bodyBold, fontSize: 12, letterSpacing: 1.6, textTransform: "uppercase", color: Colors.background },
  checkOutButton: { borderWidth: 1.5, borderColor: Colors.accentBorderStrong, backgroundColor: Colors.surfaceDark },
  checkOutInner: { flexDirection: "row", alignItems: "center", gap: 8 },
  checkOutText: { fontFamily: Typography.bodyBold, fontSize: 11, letterSpacing: 1.3, textTransform: "uppercase", color: Colors.accent },
  empty: { minHeight: 72, paddingHorizontal: Layout.screenGutter, paddingVertical: Space.md, alignItems: "center", justifyContent: "center" },
  emptyTitle: { fontFamily: Typography.heading, fontSize: 16, color: Colors.text, textAlign: "center" },
  emptyBody: { maxWidth: 300, marginTop: Space.sm, fontFamily: Typography.body, fontSize: 11, lineHeight: 17, color: Colors.muted, textAlign: "center" },
  pressed: { opacity: 0.72 },
});
