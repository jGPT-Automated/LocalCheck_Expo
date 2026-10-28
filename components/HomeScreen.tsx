import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { router, useFocusEffect } from "expo-router";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Platform, ScrollView, StyleSheet, Text, useWindowDimensions, View } from "react-native";

import { BrutalistButton } from "@/components/BrutalistButton";
import { ScreenHeader } from "@/components/ScreenHeader";
import { AutoCheckInNote } from "@/components/autoCheckIn/AutoCheckInNote";
import { CourtBusyChart } from "@/components/court/CourtBusyChart";
import { HourSlotCard } from "@/components/court/HourSlotCard";
import { HereNowSection, UpNextSection } from "@/components/court/CourtOverviewSections";
import { SectionHead } from "@/components/court/CourtParts";
import { ActivityRow } from "@/components/ui/ActivityRow";
import { GameResultModal } from "@/components/ui/GameResultModal";
import { HomeCourtActions, HomeCourtHero, HomeCourtTop } from "@/components/ui/HomeCourtHero";
import { ScreenViewport } from "@/components/ui/ScreenViewport";
import { useBottomFloor } from "@/components/ui/TabFloor";
import { useToast } from "@/components/ui/Toast";
import { Colors, Radius } from "@/constants/colors";
import type { FeedItem, FeedMatchSummary } from "@/constants/data";
import { Layout, Space } from "@/constants/layout";
import { Typography } from "@/constants/typography";
import { useApp } from "@/context/AppContext";
import { useAuth } from "@/context/AuthContext";
import { useCourtCounts, usePresence } from "@/context/CourtPresenceContext";
import { groupCheckinBursts, pairVisits } from "@/lib/activityPresentation";
import { courtHours, formatCourtHours } from "@/lib/courtHours";
import { fetchCourtWeekSpans } from "@/services/courtService";

/**
 * Home: one page, no tabs. Only the court name and its numbers stay pinned;
 * Check in, Here now, Up next, Today and the court feed scroll under them.
 */
export function HomeScreen() {
  const {
    localCourt,
    localCourtId,
    checkedInCourtId,
    pendingAutoCheckIn,
    hideAutoCheckIn,
    checkIn,
    checkOut,
    feed,
    isFriend,
    runs,
    refreshCheckedIn,
    refreshFeed,
  } = useApp();
  const { roster, localCount } = usePresence(localCourtId);
  const liveCounts = useCourtCounts(localCourt ? [localCourt] : []);
  const { user } = useAuth();
  const tabFloor = useBottomFloor();
  const [isChecking, setIsChecking] = useState(false);
  const [picked, setPicked] = useState<{ dayOffset: number; hour: number } | null>(null);
  const [hoursLabel, setHoursLabel] = useState("0h");
  const { showToast } = useToast();
  // On a short phone (iPhone SE) the fixed block would leave too little room to
  // scroll, so the busy chart moves into the scrolling page.
  const compact = useWindowDimensions().height < 720;
  const [selectedResult, setSelectedResult] = useState<{
    match: FeedMatchSummary;
    sport: FeedItem["sport"];
    courtName?: string;
  } | null>(null);

  useFocusEffect(
    useCallback(() => {
      void refreshCheckedIn();
      void refreshFeed();
    }, [refreshCheckedIn, refreshFeed]),
  );

  useFocusEffect(
    useCallback(() => {
      if (!localCourtId) return;
      let active = true;
      void fetchCourtWeekSpans(localCourtId).then((spans) => {
        if (active) setHoursLabel(formatCourtHours(courtHours(spans).hours));
      });
      return () => {
        active = false;
      };
    }, [localCourtId]),
  );

  useEffect(() => {
    setSelectedResult(null);
    setPicked(null);
  }, [localCourtId]);

  // Kept above the no-court early return so the hook count never changes
  // between renders — the "Rendered fewer hooks than expected" crash a brand-new
  // account hit the first time it set a local court. `courtFeed` is null-safe.
  const courtFeed = feed.filter((item) => item.courtId === localCourt?.id);
  const groupedCourtFeed = useMemo(
    () => groupCheckinBursts(pairVisits(courtFeed, { splitToday: true })),
    [courtFeed],
  );

  if (!localCourt) {
    return <NoCourtState isSignedIn={Boolean(user)} />;
  }

  // An auto check-in waiting to post counts as checked in for the player.
  const waitingToPost = pendingAutoCheckIn?.courtId === localCourt.id && checkedInCourtId !== localCourt.id;
  const isCheckedIn = checkedInCourtId === localCourt.id || waitingToPost;
  const statsActive = liveCounts[localCourt.id]?.activeCount ?? 0;
  const activeTotal = Math.max(roster.length, statsActive);
  const activeLabel = `${activeTotal > roster.length ? "~" : ""}${activeTotal}`;
  const now = Date.now();
  const upcoming = runs
    .filter((run) => run.courtId === localCourt.id && Date.parse(run.startTimeIso) >= now - 60 * 60_000)
    .sort((a, b) => a.startTimeIso.localeCompare(b.startTimeIso));

  const handleCheckIn = async () => {
    if (isChecking) return;
    setIsChecking(true);
    try {
      if (waitingToPost) {
        // Not posted yet: checking out means it never happened.
        if (Platform.OS !== "web") void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        await hideAutoCheckIn();
      } else if (isCheckedIn) {
        if (Platform.OS !== "web") void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        await checkOut();
      } else if (await checkIn(localCourt.id)) {
        // The toast carries the success haptic.
        showToast({
          title: `CHECKED IN · ${(localCourt.shortName || localCourt.name).toUpperCase()}`,
          body: "Check out when you leave.",
          icon: "map-pin",
        });
      }
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

  const busyChart = (
    <View style={styles.chart}>
      <CourtBusyChart
        courtId={localCourt.id}
        games={upcoming}
        onSelect={setPicked}
        refreshKey={roster.length}
        selected={picked}
        variant="header"
      />
    </View>
  );

  return (
    <ScreenViewport>
      <ScreenHeader title="LOCALCHECK" />

      {/* Fixed: the court, its numbers, Check in and today's busy times. */}
      <View style={styles.fixed}>
        <HomeCourtTop court={localCourt} />
        <HomeCourtHero
          activeCount={activeLabel}
          court={localCourt}
          hoursLabel={hoursLabel}
          live={activeTotal > 0}
          localCount={localCount}
        />
        <HomeCourtActions
          courtName={localCourt.shortName || localCourt.name}
          isCheckedIn={isCheckedIn}
          isChecking={isChecking}
          onCheckIn={() => void handleCheckIn()}
          onViewCourt={() => router.push(`/court/${localCourt.id}`)}
        />
        <AutoCheckInNote courtId={localCourt.id} />
        {compact ? null : busyChart}
      </View>

      <ScrollView
        contentContainerStyle={{ paddingBottom: tabFloor + Space.lg }}
        showsVerticalScrollIndicator={false}
        style={styles.scroll}
      >
        {compact ? busyChart : null}
        {picked ? (
          <View style={styles.pickedSlot}>
            <HourSlotCard court={localCourt} dayOffset={picked.dayOffset} hour={picked.hour} />
          </View>
        ) : null}
        <View style={styles.hereNow}>
          <HereNowSection
            isFriend={isFriend}
            onMore={() => router.push(`/court/${localCourt.id}?tab=players`)}
            onPlayer={(id) => router.push(`/player/${id}`)}
            roster={roster}
          />
        </View>
        <View style={styles.upNext}>
          <UpNextSection
            onOpenRun={(id) => router.push(`/run/${id}`)}
            upcoming={upcoming}
          />
        </View>
        <View style={styles.today}>
          <SectionHead title="Recent activity" />
        </View>
        {groupedCourtFeed.length > 0 ? (
          groupedCourtFeed.map((item, index) => (
            <ActivityRow
              item={item}
              key={item.id}
              previous={groupedCourtFeed[index - 1]}
              showActor
              onActorPress={item.playerId ? () => router.push(`/player/${item.playerId}`) : undefined}
              onPress={item.type === "game_result" && !item.match ? undefined : () => openActivity(item)}
            />
          ))
        ) : (
          <Text style={styles.emptyText}>No activity yet. Check in to start the court story.</Text>
        )}
      </ScrollView>

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
        <BrutalistButton
          icon={<Feather color={Colors.background} name="arrow-right" size={15} />}
          label={isSignedIn ? "Explore courts" : "Sign in"}
          onPress={() => router.push(isSignedIn ? "/(tabs)/explore" : "/auth")}
          style={styles.noCourtButton}
        />
      </View>
    </ScreenViewport>
  );
}


const styles = StyleSheet.create({
  fixed: { borderBottomWidth: 1, borderBottomColor: Colors.hairline },
  scroll: { flex: 1, minHeight: 0 },
  chart: { paddingHorizontal: Layout.screenGutter, paddingTop: Space.md, paddingBottom: Space.md },
  hereNow: { paddingTop: Space.lg, borderBottomWidth: 1, borderBottomColor: Colors.hairline },
  upNext: { paddingTop: Space.lg },
  pickedSlot: { paddingHorizontal: Layout.screenGutter, paddingTop: Space.md },
  today: { paddingHorizontal: Layout.screenGutter, paddingBottom: Space.lg },
  emptyText: {
    paddingHorizontal: Layout.screenGutter,
    fontFamily: Typography.bodyMedium,
    fontSize: 12,
    color: Colors.textSecondary,
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
  noCourtButton: { marginTop: Space.xxl },
});
