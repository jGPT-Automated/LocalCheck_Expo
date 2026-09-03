import { Feather } from "@expo/vector-icons";
import { router, useLocalSearchParams } from "expo-router";
import React from "react";
import { Platform, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { CourtSchedulePanel } from "@/components/CourtSchedulePanel";
import { SectionHeader } from "@/components/ScreenHeader";
import { ActivityRow } from "@/components/ui/ActivityRow";
import { GameResultModal } from "@/components/ui/GameResultModal";
import { CourtMapPreview } from "@/components/ui/CourtMapPreview";
import { DetailHeader } from "@/components/ui/DetailHeader";
import { MetricDashboard, type DashboardMetric } from "@/components/ui/MetricDashboard";
import { PlayerSummaryRow } from "@/components/ui/PlayerSummaryRow";
import { Colors, Radius } from "@/constants/colors";
import type { Court, FeedItem, FeedMatchSummary } from "@/constants/data";
import { Layout, Space } from "@/constants/layout";
import { TextStyles, Typography } from "@/constants/typography";
import { useApp } from "@/context/AppContext";
import { useCourtCounts, usePresence } from "@/context/CourtPresenceContext";
import { useRealtimeHub } from "@/context/RealtimeHubContext";
import { batchHasResource, type RealtimeTopic } from "@/lib/realtimeHub";
import { openCourtInMaps } from "@/lib/openMaps";
import {
  fetchCourtActivityMetrics,
  fetchCourtById,
  type CourtActivityMetrics,
} from "@/services/courtService";
import { fetchFeed } from "@/services/feedService";
import {
  fetchLeaderboard,
  fetchLocalsWithLastCheckIn,
  type LocalWithLastCheckIn,
} from "@/services/profileService";

type CourtTab = "feed" | "locals" | "schedule" | "details";
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
  } = useApp();
  const { bottom } = useSafeAreaInsets();
  const courtId = id ? String(id) : null;
  const [activeTab, setActiveTab] = React.useState<CourtTab>("feed");
  const [court, setCourt] = React.useState<Court | null>(
    courts.find((item) => item.id === id) ?? (contextLocalCourt?.id === id ? contextLocalCourt : null),
  );
  const [fetchError, setFetchError] = React.useState(false);
  const [locals, setLocals] = React.useState<LocalWithLastCheckIn[]>([]);
  const [courtFeed, setCourtFeed] = React.useState<Awaited<ReturnType<typeof fetchFeed>>>([]);
  const [rankedIds, setRankedIds] = React.useState<Set<string>>(new Set());
  const [feedVisible, setFeedVisible] = React.useState(FEED_PAGE);
  const [activityMetrics, setActivityMetrics] = React.useState<CourtActivityMetrics>({
    checkInsThisWeek: 0,
    checkInTrend: null,
    gamesThisWeek: 0,
    activeLocals: 0,
    activeLocalTrend: null,
  });
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
      fetchCourtActivityMetrics(courtId),
    ]).then(([nextLocals, nextMetrics]) => {
      if (cancelled) return;
      setLocals(nextLocals);
      setActivityMetrics(nextMetrics);
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

  const statsActive = countMap[court.id]?.activeCount ?? court.activeCount ?? 0;
  const activeCount = Math.max(roster.length, statsActive);
  const hiddenCount = Math.max(0, activeCount - roster.length);
  const isMyLocal = localCourtId === court.id;
  const hereNowIds = new Set(roster.map((player) => player.id));
  const visibleLocals = locals.filter(({ player }) => !hereNowIds.has(player.id));
  const privateLocalCount = Math.max(0, localCount - locals.length);
  const dashboard: DashboardMetric[] = [
    { label: "Active now", value: hiddenCount > 0 ? `~${activeCount}` : activeCount, accent: activeCount > 0 },
    { label: "Active locals", value: activityMetrics.activeLocals, trend: activityMetrics.activeLocalTrend, trendLabel: "90D" },
    { label: "Check-ins · 7D", value: activityMetrics.checkInsThisWeek, trend: activityMetrics.checkInTrend, trendLabel: "7D" },
    { label: "Games · 7D", value: activityMetrics.gamesThisWeek },
    { label: "Total locals", value: localCount },
    { label: "All check-ins", value: court.ratingCount ?? 0 },
  ];
  const bottomPad = Platform.OS === "web" ? Layout.tabBarClearance + 24 : bottom + 32;

  const openActivity = (item: FeedItem) => {
    if (item.type === "game_result" && item.match) {
      setSelectedResult({ match: item.match, sport: item.sport, courtName: item.courtName });
    } else if (item.playerId) {
      router.push(`/player/${item.playerId}`);
    }
  };

  return (
    <View style={styles.screen}>
      <DetailHeader
        onBack={() => router.canGoBack() ? router.back() : router.replace("/(tabs)")}
        title={court.shortName || court.name}
        right={<Pressable
          accessibilityLabel={isMyLocal ? "Remove my local court" : "Set as my local court"}
          accessibilityHint={isMyLocal ? "Removes this as your local court" : "Sets this as your local court"}
          accessibilityRole="button"
          accessibilityState={{ selected: isMyLocal }}
          hitSlop={8}
          onPress={() => void setLocalCourt(isMyLocal ? null : court.id, court)}
          style={({ pressed }) => [
            styles.localButton,
            isMyLocal && styles.localButtonActive,
            pressed && styles.pressed,
          ]}
        >
          <Feather
            color={isMyLocal ? Colors.accent : Colors.textSecondary}
            name={isMyLocal ? "check-circle" : "map-pin"}
            size={12}
          />
          <Text style={[styles.localButtonText, isMyLocal && styles.localButtonTextActive]}>
            {isMyLocal ? "LOCAL" : "SET LOCAL"}
          </Text>
        </Pressable>}
      />
      <MetricDashboard metrics={dashboard} />
      <CourtTabs active={activeTab} onChange={setActiveTab} />

      <View style={styles.tabContent}>
        {activeTab === "feed" ? (
          <ScrollView contentContainerStyle={{ paddingBottom: bottomPad }} showsVerticalScrollIndicator={false}>
            {courtFeed.length > 0 ? (
              courtFeed.slice(0, feedVisible).map((item, index) => (
                <ActivityRow
                  isFirst={index === 0}
                  isLast={index === Math.min(feedVisible, courtFeed.length) - 1}
                  item={item}
                  key={item.id}
                  onActorPress={item.playerId ? () => router.push(`/player/${item.playerId}`) : undefined}
                  onPress={item.type === "game_result" && !item.match ? undefined : () => openActivity(item)}
                />
              ))
            ) : (
              <EmptyState title="No court activity yet" body="The first check-in or game here will start the feed." />
            )}
            {feedVisible < courtFeed.length ? (
              <Pressable onPress={() => setFeedVisible((count) => count + FEED_PAGE)} style={styles.moreButton}>
                <Text style={styles.moreText}>VIEW MORE</Text>
                <Feather color={Colors.accent} name="chevron-down" size={14} />
              </Pressable>
            ) : null}
          </ScrollView>
        ) : null}

        {activeTab === "locals" ? (
          <ScrollView contentContainerStyle={{ paddingBottom: bottomPad }} showsVerticalScrollIndicator={false}>
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
                inactive={isInactive(lastCheckInAt)}
                key={player.id}
                onPress={() => router.push(`/player/${player.id}`)}
                player={player}
                ranked={rankedIds.has(player.id)}
              />
            )) : <EmptyState title="No visible local profiles" body="Locals appear here after choosing this as their home court." />}
            {privateLocalCount > 0 ? <Text style={styles.privateNote}>+{privateLocalCount} private {privateLocalCount === 1 ? "local" : "locals"}</Text> : null}
          </ScrollView>
        ) : null}

        {activeTab === "schedule" ? (
          <View style={styles.scheduleView}>
            <CourtSchedulePanel court={court} interactive={false} />
          </View>
        ) : null}

        {activeTab === "details" ? (
          <ScrollView contentContainerStyle={{ paddingBottom: bottomPad }} showsVerticalScrollIndicator={false}>
            <SectionHeader title="Court details" />
            <View style={styles.detailList}>
              <DetailRow label="Full name" value={court.name} />
              <DetailRow label="Short name" value={court.shortName || court.name} />
              <DetailRow label="Address" value={court.address || "Not available"} />
              <DetailRow label="Court added" value={formatDate(court.addedDate)} />
              <DetailRow label="Court status" value={courtStatusLabel(court)} />
              <CourtMapPreview court={court} onPress={() => void openCourtInMaps(court)} />
            </View>
            <Pressable
              onPress={() => void setLocalCourt(isMyLocal ? null : court.id, court)}
              style={({ pressed }) => [styles.localAction, isMyLocal && styles.localActionActive, pressed && styles.pressed]}
            >
              <Feather color={isMyLocal ? Colors.black : Colors.text} name="star" size={16} />
              <Text style={[styles.localActionText, isMyLocal && styles.localActionTextActive]}>
                {isMyLocal ? "MY LOCAL COURT" : "SET AS MY LOCAL"}
              </Text>
            </Pressable>
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

function CourtTabs({ active, onChange }: { active: CourtTab; onChange: (tab: CourtTab) => void }) {
  return (
    <View accessibilityRole="tablist" style={styles.tabs}>
      {(["feed", "locals", "schedule", "details"] as const).map((tab) => (
        <Pressable
          accessibilityRole="tab"
          accessibilityState={{ selected: active === tab }}
          key={tab}
          onPress={() => onChange(tab)}
          style={[styles.tab, active === tab && styles.tabActive]}
        >
          <Text style={[styles.tabText, active === tab && styles.tabTextActive]}>{tab.toUpperCase()}</Text>
        </Pressable>
      ))}
    </View>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.detailRow}>
      <Text style={styles.detailLabel}>{label}</Text>
      <Text style={styles.detailValue}>{value}</Text>
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
  if (!Number.isFinite(elapsed) || elapsed < 0) return "recently";
  const minutes = Math.floor(elapsed / 60_000);
  if (minutes < 60) return minutes <= 1 ? "just now" : `${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} hr${hours === 1 ? "" : "s"} ago`;
  const days = Math.floor(hours / 24);
  return `${days} day${days === 1 ? "" : "s"} ago`;
}

function isInactive(value: string | null): boolean {
  if (!value) return true;
  return Date.now() - new Date(value).getTime() > 90 * 86_400_000;
}

function formatDate(value?: string): string {
  if (!value) return "Not available";
  return new Date(value).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function courtStatusLabel(court: Court): string {
  if (court.status === "confirmed") return "Verified";
  if (court.status === "pending") return "Needs review";
  return "Community listed";
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Colors.background },
  notFound: { flex: 1, alignItems: "center", justifyContent: "center", gap: Space.lg, padding: 30, backgroundColor: Colors.background },
  notFoundText: { fontFamily: Typography.heading, fontSize: 22, color: Colors.text },
  retryButton: { minHeight: 44, paddingHorizontal: Space.xl, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: Colors.border },
  retryText: { fontFamily: Typography.bodyBold, fontSize: 10, color: Colors.text, letterSpacing: 1.2 },
  localButton: { minHeight: Layout.minTouchTarget, paddingHorizontal: 10, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: Space.xs, borderWidth: 1, borderColor: Colors.borderLight, borderRadius: 5, backgroundColor: Colors.surfaceHigh },
  localButtonActive: { borderColor: Colors.accentBorder, backgroundColor: Colors.accentDim },
  localButtonText: { ...TextStyles.labelSmall, color: Colors.textSecondary, letterSpacing: 0.25 },
  localButtonTextActive: { color: Colors.accent },
  tabs: { minHeight: 44, paddingHorizontal: Layout.screenGutter, flexDirection: "row", borderTopWidth: StyleSheet.hairlineWidth, borderBottomWidth: StyleSheet.hairlineWidth, borderColor: Colors.border },
  tab: { flex: 1, alignItems: "center", justifyContent: "center", borderBottomWidth: 2, borderBottomColor: "transparent" },
  tabActive: { borderBottomColor: Colors.accent },
  tabText: { fontFamily: Typography.bodyBold, fontSize: 8, color: Colors.muted, letterSpacing: 1.2 },
  tabTextActive: { color: Colors.text },
  tabContent: { flex: 1, minHeight: 0 },
  scheduleView: { flex: 1, minHeight: 0, overflow: "hidden" },
  moreButton: { minHeight: 48, marginHorizontal: Layout.screenGutter, marginTop: Space.md, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: Space.sm, borderWidth: 1, borderColor: Colors.border, borderRadius: Radius.md },
  moreText: { fontFamily: Typography.bodyBold, fontSize: 9, color: Colors.textSecondary, letterSpacing: 1.2 },
  privateNote: { paddingHorizontal: Layout.screenGutter, paddingVertical: Space.md, fontFamily: Typography.bodyMedium, fontSize: 9, color: Colors.muted },
  detailList: { paddingHorizontal: Layout.screenGutter },
  detailRow: { minHeight: 62, paddingVertical: Space.md, justifyContent: "center", borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: Colors.borderSubtle },
  detailLabel: { fontFamily: Typography.bodyBold, fontSize: 8, color: Colors.muted, letterSpacing: 1.2, textTransform: "uppercase" },
  detailValue: { marginTop: 4, fontFamily: Typography.bodyMedium, fontSize: 13, lineHeight: 18, color: Colors.text },
  mapRow: { minHeight: 66, flexDirection: "row", alignItems: "center", justifyContent: "space-between", borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: Colors.borderSubtle },
  mapValue: { marginTop: 4, fontFamily: Typography.bodyMedium, fontSize: 12, color: Colors.textSecondary },
  localAction: { minHeight: 48, marginHorizontal: Layout.screenGutter, marginTop: Space.xl, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: Space.sm, borderWidth: 1, borderColor: Colors.border, borderRadius: Radius.md },
  localActionActive: { backgroundColor: Colors.accent, borderColor: Colors.accent },
  localActionText: { fontFamily: Typography.bodyBold, fontSize: 10, color: Colors.text, letterSpacing: 1.2 },
  localActionTextActive: { color: Colors.black },
  empty: { minHeight: 72, paddingHorizontal: Layout.screenGutter, paddingVertical: Space.md, alignItems: "center", justifyContent: "center" },
  emptyTitle: { fontFamily: Typography.heading, fontSize: 16, color: Colors.text, textAlign: "center" },
  emptyBody: { maxWidth: 300, marginTop: Space.sm, fontFamily: Typography.body, fontSize: 11, lineHeight: 17, color: Colors.muted, textAlign: "center" },
  pressed: { opacity: 0.72 },
});
