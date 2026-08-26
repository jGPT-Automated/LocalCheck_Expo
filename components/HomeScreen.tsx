import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { router, useFocusEffect } from "expo-router";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { CourtSchedulePanel } from "@/components/CourtSchedulePanel";
import { PlayerAvatar } from "@/components/PlayerAvatar";
import { ScreenHeader, SectionHeader } from "@/components/ScreenHeader";
import { ActivityRow } from "@/components/ui/ActivityRow";
import { GameResultModal } from "@/components/ui/GameResultModal";
import { HomeCourtHero } from "@/components/ui/HomeCourtHero";
import { PlayerSummaryRow } from "@/components/ui/PlayerSummaryRow";
import { PersonTile } from "@/components/ui/PersonTile";
import { ScreenViewport } from "@/components/ui/ScreenViewport";
import { Colors, Radius } from "@/constants/colors";
import type { FeedItem, FeedMatchSummary } from "@/constants/data";
import { Layout, Space } from "@/constants/layout";
import { Typography } from "@/constants/typography";
import { useApp } from "@/context/AppContext";
import { useAuth } from "@/context/AuthContext";
import { useCourtCounts, usePresence } from "@/context/CourtPresenceContext";
import {
  fetchLocalsWithLastCheckIn,
  type LocalWithLastCheckIn,
} from "@/services/profileService";

type HomeTab = "feed" | "locals" | "schedule";

export function HomeScreen() {
  const {
    localCourt,
    localCourtId,
    checkedInCourtId,
    checkIn,
    checkOut,
    feed,
    isFriend,
    refreshCheckedIn,
    refreshFeed,
  } = useApp();
  const { roster, localCount } = usePresence(localCourtId);
  const liveCounts = useCourtCounts(localCourt ? [localCourt] : []);
  const { user } = useAuth();
  const { bottom } = useSafeAreaInsets();
  const [activeTab, setActiveTab] = useState<HomeTab>("feed");
  const [locals, setLocals] = useState<LocalWithLastCheckIn[]>([]);
  const [isChecking, setIsChecking] = useState(false);
  const [selectedResult, setSelectedResult] = useState<{
    match: FeedMatchSummary;
    sport: FeedItem["sport"];
    courtName?: string;
  } | null>(null);

  const refreshLocals = useCallback(() => {
    if (!localCourtId) {
      setLocals([]);
      return;
    }
    let active = true;
    void fetchLocalsWithLastCheckIn(localCourtId).then((result) => {
      if (active) setLocals(result);
    });
    return () => {
      active = false;
    };
  }, [localCourtId]);

  useFocusEffect(
    useCallback(() => {
      void refreshCheckedIn();
      void refreshFeed();
      return refreshLocals();
    }, [refreshCheckedIn, refreshFeed, refreshLocals]),
  );

  useEffect(() => {
    setActiveTab("feed");
    setSelectedResult(null);
  }, [localCourtId]);

  const sortedPlayers = useMemo(
    () =>
      [...roster].sort((a, b) => {
        const friendshipDifference =
          Number(isFriend(b.id)) - Number(isFriend(a.id));
        return friendshipDifference || b.elo - a.elo;
      }),
    [isFriend, roster],
  );

  if (!localCourt) {
    return <NoCourtState isSignedIn={Boolean(user)} />;
  }

  const isCheckedIn = checkedInCourtId === localCourt.id;
  const statsActive = liveCounts[localCourt.id]?.activeCount ?? 0;
  const activeTotal = Math.max(roster.length, statsActive);
  const hiddenCount = Math.max(0, activeTotal - roster.length);
  const activeLabel = `${hiddenCount > 0 ? "~" : ""}${activeTotal}`;
  const hereNowIds = new Set(roster.map((player) => player.id));
  const visibleLocals = locals.filter(
    ({ player }) => !hereNowIds.has(player.id),
  );
  const privateLocalCount = Math.max(0, localCount - locals.length);

  const courtFeed = feed.filter((item) => item.courtId === localCourt.id);

  const handleCheckIn = async () => {
    if (isChecking) return;
    setIsChecking(true);
    try {
      if (Platform.OS !== "web") {
        await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      }
      if (isCheckedIn) await checkOut();
      else await checkIn(localCourt.id);
    } finally {
      setIsChecking(false);
    }
  };

  const openActivity = (item: FeedItem) => {
    if (item.type === "game_result" && item.match) {
      setSelectedResult({
        match: item.match,
        sport: item.sport,
        courtName: item.courtName,
      });
      return;
    }
    if (item.runId) {
      router.push(`/run/${item.runId}`);
      return;
    }
    if (item.playerId) router.push(`/player/${item.playerId}`);
  };

  const scrollBottom =
    Platform.OS === "web" ? Layout.tabBarClearance + 24 : bottom + 92;

  return (
    <ScreenViewport>
      <ScreenHeader title="LOCALCHECK" />

      <HomeCourtHero
        activeCount={activeLabel}
        court={localCourt}
        isCheckedIn={isCheckedIn}
        isChecking={isChecking}
        localCount={localCount}
        onCheckIn={() => void handleCheckIn()}
        onViewCourt={() => router.push(`/court/${localCourt.id}`)}
        visitCount={localCourt.ratingCount ?? 0}
      />

      <HomeTabs active={activeTab} onChange={setActiveTab} />

      <View style={styles.tabBody}>
        {activeTab === "feed" ? (
          <ScrollView
            contentContainerStyle={{ paddingBottom: scrollBottom }}
            showsVerticalScrollIndicator={false}
          >
            <View
              style={[
                styles.peopleSection,
                activeTotal === 0 && styles.peopleSectionEmpty,
              ]}
            >
              <SectionHeader count={activeLabel} title="Checked in" />
              {activeTotal === 0 ? (
                <View style={styles.emptyPeople}>
                  <Text style={styles.emptyText}>Nobody here yet.</Text>
                </View>
              ) : (
                <ScrollView
                  contentContainerStyle={styles.roster}
                  horizontal
                  nestedScrollEnabled
                  showsHorizontalScrollIndicator={false}
                >
                  {sortedPlayers.map((player) => (
                    <PersonTile
                      friend={isFriend(player.id)}
                      key={player.id}
                      onPress={() => router.push(`/player/${player.id}`)}
                      player={player}
                    />
                  ))}
                  {hiddenCount > 0 ? (
                    <HiddenPeopleTile count={hiddenCount} />
                  ) : null}
                </ScrollView>
              )}
            </View>

            <View style={styles.activitySection}>
              <SectionHeader
                count={courtFeed.length || undefined}
                title="Court activity"
              />
              {courtFeed.length > 0 ? (
                courtFeed.map((item, index) => (
                  <ActivityRow
                    isFirst={index === 0}
                    isLast={index === courtFeed.length - 1}
                    item={item}
                    key={item.id}
                    onActorPress={
                      item.playerId
                        ? () => router.push(`/player/${item.playerId}`)
                        : undefined
                    }
                    onPress={
                      item.type === "game_result" && !item.match
                        ? undefined
                        : () => openActivity(item)
                    }
                  />
                ))
              ) : (
                <View style={styles.activityEmpty}>
                  <Text style={styles.emptyText}>
                    No activity yet. Check in to start the court story.
                  </Text>
                </View>
              )}
            </View>
          </ScrollView>
        ) : null}

        {activeTab === "locals" ? (
          <ScrollView
            contentContainerStyle={{ paddingBottom: scrollBottom }}
            showsVerticalScrollIndicator={false}
          >
            <SectionHeader count={activeLabel} title="Here now" />
            <View style={styles.peopleList}>
              {sortedPlayers.length > 0 ? (
                sortedPlayers.map((player) => {
                  const localHistory = locals.find(
                    (entry) => entry.player.id === player.id,
                  );
                  return (
                    <PlayerSummaryRow
                      checkInCount={localHistory?.checkInCount}
                      detail="Active now"
                      friend={isFriend(player.id)}
                      key={player.id}
                      onPress={() => router.push(`/player/${player.id}`)}
                      player={player}
                    />
                  );
                })
              ) : (
                <Text style={styles.listEmpty}>
                  No visible players checked in.
                </Text>
              )}
              {hiddenCount > 0 ? (
                <Text style={styles.privateNote}>
                  +{hiddenCount} PRIVATE{" "}
                  {hiddenCount === 1 ? "PLAYER" : "PLAYERS"} INCLUDED IN THE
                  LIVE COUNT
                </Text>
              ) : null}
            </View>

            <SectionHeader count={localCount} title="Locals" />
            <View style={styles.peopleList}>
              {visibleLocals.length > 0 ? (
                visibleLocals.map(({ player, lastCheckInAt, checkInCount }) => (
                  <PlayerSummaryRow
                    checkInCount={checkInCount}
                    detail={
                      lastCheckInAt
                        ? `Last here · ${relativeTime(lastCheckInAt)}`
                        : "Local player"
                    }
                    friend={isFriend(player.id)}
                    inactive={isInactive(lastCheckInAt)}
                    key={player.id}
                    onPress={() => router.push(`/player/${player.id}`)}
                    player={player}
                  />
                ))
              ) : (
                <Text style={styles.listEmpty}>
                  No other visible local profiles yet.
                </Text>
              )}
              {privateLocalCount > 0 ? (
                <Text style={styles.privateNote}>
                  +{privateLocalCount} PRIVATE{" "}
                  {privateLocalCount === 1 ? "LOCAL" : "LOCALS"} INCLUDED IN THE
                  COUNT
                </Text>
              ) : null}
            </View>
          </ScrollView>
        ) : null}

        {activeTab === "schedule" ? (
          <View style={styles.scheduleTab}>
            <CourtSchedulePanel court={localCourt} interactive={false} />
          </View>
        ) : null}
      </View>

      <GameResultModal
        courtName={selectedResult?.courtName}
        match={selectedResult?.match ?? null}
        onClose={() => setSelectedResult(null)}
        sport={selectedResult?.sport}
        visible={Boolean(selectedResult)}
      />
    </ScreenViewport>
  );
}

function HomeTabs({
  active,
  onChange,
}: {
  active: HomeTab;
  onChange: (tab: HomeTab) => void;
}) {
  return (
    <View accessibilityRole="tablist" style={styles.tabs}>
      {(["feed", "locals", "schedule"] as const).map((tab) => (
        <Pressable
          accessibilityRole="tab"
          accessibilityState={{ selected: active === tab }}
          key={tab}
          onPress={() => onChange(tab)}
          style={[styles.tab, active === tab && styles.tabActive]}
        >
          <Text
            style={[styles.tabText, active === tab && styles.tabTextActive]}
          >
            {tab.toUpperCase()}
          </Text>
        </Pressable>
      ))}
    </View>
  );
}

function HiddenPeopleTile({ count }: { count: number }) {
  return (
    <View
      accessibilityLabel={`${count} more people with private visibility`}
      style={styles.hiddenTile}
    >
      <View style={styles.hiddenAvatar}>
        <Text style={styles.hiddenCount}>+{count}</Text>
      </View>
      <Text style={styles.hiddenLabel}>Private</Text>
    </View>
  );
}

function NoCourtState({ isSignedIn }: { isSignedIn: boolean }) {
  return (
    <ScreenViewport>
      <ScreenHeader title="LOCALCHECK" />
      <View style={styles.noCourt}>
        <View style={styles.noCourtIcon}>
          <Feather color={Colors.accent} name="map-pin" size={24} />
        </View>
        <Text style={styles.noCourtTitle}>
          {isSignedIn ? "FIND YOUR LOCAL COURT" : "YOUR LOCAL COURT, LIVE"}
        </Text>
        <Text style={styles.noCourtCopy}>
          {isSignedIn
            ? "Choose a home court to see who's there, upcoming runs, and live activity."
            : "Sign in to check in, find runs, and see who is playing nearby."}
        </Text>
        <Pressable
          accessibilityRole="button"
          onPress={() => router.push(isSignedIn ? "/(tabs)/explore" : "/auth")}
          style={({ pressed }) => [
            styles.noCourtButton,
            pressed && styles.buttonPressed,
          ]}
        >
          <Text style={styles.noCourtButtonText}>
            {isSignedIn ? "EXPLORE COURTS" : "SIGN IN"}
          </Text>
          <Feather color={Colors.black} name="arrow-right" size={15} />
        </Pressable>
      </View>
    </ScreenViewport>
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

const styles = StyleSheet.create({
  tabBody: {
    flex: 1,
    minHeight: 0,
  },
  scheduleTab: { flex: 1, minHeight: 0 },
  tabs: {
    minHeight: 45,
    paddingHorizontal: 20,
    flexDirection: "row",
    backgroundColor: Colors.background,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.border,
  },
  tab: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    borderBottomWidth: 2,
    borderBottomColor: "transparent",
  },
  tabActive: {
    borderBottomColor: Colors.accent,
  },
  tabText: {
    fontFamily: Typography.bodyBold,
    fontSize: 8,
    color: Colors.muted,
    letterSpacing: 1.6,
  },
  tabTextActive: {
    color: Colors.text,
  },
  peopleSection: {
    minHeight: 112,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.borderSubtle,
  },
  peopleSectionEmpty: { minHeight: 0 },
  roster: {
    minHeight: 70,
    paddingHorizontal: Layout.screenGutter,
    paddingVertical: Space.lg,
    gap: Space.md,
  },
  emptyPeople: {
    minHeight: Layout.minTouchTarget,
    paddingHorizontal: Layout.screenGutter,
    alignItems: "center",
    justifyContent: "center",
  },
  activitySection: {
    minHeight: 150,
  },
  activityEmpty: {
    minHeight: 120,
    paddingHorizontal: Layout.screenGutter,
    justifyContent: "center",
  },
  emptyText: {
    fontFamily: Typography.body,
    fontSize: 12,
    lineHeight: 18,
    color: Colors.muted,
    textAlign: "center",
  },
  hiddenTile: {
    width: 62,
    alignItems: "center",
    gap: Space.sm,
    paddingTop: Space.xs,
  },
  hiddenAvatar: {
    width: 42,
    height: 42,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.lg,
    borderStyle: "dashed",
    backgroundColor: Colors.surface,
  },
  hiddenCount: {
    fontFamily: Typography.heading,
    fontSize: 14,
    color: Colors.textSecondary,
  },
  hiddenLabel: {
    fontFamily: Typography.bodyMedium,
    fontSize: 9,
    color: Colors.muted,
  },
  peopleList: {
    paddingBottom: Space.lg,
  },
  privateNote: {
    marginTop: Space.md,
    marginHorizontal: Layout.screenGutter,
    fontFamily: Typography.bodyBold,
    fontSize: 8,
    lineHeight: 13,
    color: Colors.muted,
    letterSpacing: 1,
  },
  listEmpty: {
    paddingHorizontal: Layout.screenGutter,
    paddingVertical: Space.xl,
    fontFamily: Typography.body,
    fontSize: 11,
    lineHeight: 17,
    color: Colors.muted,
  },
  scheduleDivider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: Colors.border,
  },
  scheduleRuns: {
    paddingHorizontal: Layout.screenGutter,
    paddingBottom: Space.xl,
    gap: Space.sm,
  },
  openSchedule: {
    minHeight: 48,
    marginTop: Space.sm,
    paddingHorizontal: Space.lg,
    borderRadius: Radius.sm,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: Space.sm,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  openScheduleText: {
    fontFamily: Typography.heading,
    fontSize: 11,
    color: Colors.text,
    letterSpacing: 1.2,
  },
  noCourt: {
    flex: 1,
    paddingHorizontal: Layout.screenGutter,
    paddingBottom: Layout.tabBarClearance,
    alignItems: "center",
    justifyContent: "center",
  },
  noCourtIcon: {
    width: 54,
    height: 54,
    marginBottom: Space.xl,
    borderRadius: Radius.lg,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: Colors.liveQuiet,
    borderWidth: 1,
    borderColor: Colors.accentDim,
  },
  noCourtTitle: {
    fontFamily: Typography.heading,
    fontSize: 25,
    color: Colors.text,
    letterSpacing: 0.8,
    textAlign: "center",
  },
  noCourtCopy: {
    maxWidth: 320,
    marginTop: Space.sm,
    fontFamily: Typography.body,
    fontSize: 13,
    lineHeight: 20,
    color: Colors.textSecondary,
    textAlign: "center",
  },
  noCourtButton: {
    minHeight: 48,
    marginTop: Space.xxl,
    paddingHorizontal: Space.xl,
    borderRadius: Radius.sm,
    flexDirection: "row",
    alignItems: "center",
    gap: Space.sm,
    backgroundColor: Colors.accent,
  },
  noCourtButtonText: {
    fontFamily: Typography.headingBold,
    fontSize: 12,
    color: Colors.black,
    letterSpacing: 1.35,
  },
  buttonPressed: {
    opacity: 0.72,
  },
});
