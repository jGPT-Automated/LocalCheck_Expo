import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { router, useFocusEffect } from "expo-router";
import React, { useCallback, useState } from "react";
import { Platform, ScrollView, StyleSheet, Text, View } from "react-native";

import { BrutalistButton } from "@/components/BrutalistButton";
import { ScreenHeader } from "@/components/ScreenHeader";
import { HomeCourtCarousel } from "@/components/home/HomeCourtCarousel";
import { HomeSessionStatus } from "@/components/home/HomeSessionStatus";
import { homeCheckInStatus } from "@/components/home/homeStatusModel";
import { SavedCourtPicker } from "@/components/court/SavedCourtList";
import { RunFlowSheet } from "@/components/sheet/RunFlowSheet";
import { useLocalList } from "@/context/LocalListContext";
import { AutoCheckInNote } from "@/components/autoCheckIn/AutoCheckInNote";
import { CourtDayPlanner } from "@/components/court/CourtDayPlanner";
import { HereNowSection, UpNextSection } from "@/components/court/CourtOverviewSections";
import { HomeCourtActions, HomeCourtHero } from "@/components/ui/HomeCourtHero";
import { nextGameLabel } from "@/lib/nextGameLabel";
import { ScreenViewport } from "@/components/ui/ScreenViewport";
import { useBottomFloor } from "@/components/ui/TabFloor";
import { useToast } from "@/components/ui/Toast";
import { Colors, Radius } from "@/constants/colors";
import { Layout, Space } from "@/constants/layout";
import { Typography } from "@/constants/typography";
import { useApp } from "@/context/AppContext";
import { useAuth } from "@/context/AuthContext";
import { useCourtCounts, usePresence } from "@/context/CourtPresenceContext";
import { courtHours, formatCourtHours } from "@/lib/courtHours";
import { fetchCourtWeekSpans } from "@/services/courtService";

/**
 * Home: one page, no tabs. Only the court name and its numbers stay pinned;
 * Check in, Here now, Up next and the time chart scroll under them.
 */
export function HomeScreen() {
  const {
    checkedInCourtId,
    checkedInStartedAt,
    pendingAutoCheckIn,
    hideAutoCheckIn,
    checkIn,
    checkOut,
    isFriend,
    runs,
    refreshCheckedIn,
  } = useApp();
  const { courts: listCourts, defaultCourt } = useLocalList();
  const [viewCourtId, setViewCourtId] = useState<string | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const localCourt = listCourts.find(court => court.id === viewCourtId) ?? defaultCourt;
  const localCourtId = localCourt?.id ?? null;
  React.useEffect(() => { setViewCourtId(defaultCourt?.id ?? null); }, [defaultCourt?.id]);
  const [now, setNow] = useState(Date.now());
  React.useEffect(() => {
    if (!checkedInCourtId && !pendingAutoCheckIn) return;
    setNow(Date.now());
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [checkedInCourtId, pendingAutoCheckIn]);
  const status = homeCheckInStatus({ now, activeCourtId: checkedInCourtId, startedAt: checkedInStartedAt, pending: pendingAutoCheckIn });
  const { roster, localCount } = usePresence(localCourtId);
  const liveCounts = useCourtCounts(listCourts);
  const { user } = useAuth();
  const tabFloor = useBottomFloor();
  const scroll = React.useRef<ScrollView>(null);
  const [isChecking, setIsChecking] = useState(false);
  const [courtHoursLabels, setCourtHoursLabels] = useState<Record<string, string>>({});
  const { showToast } = useToast();


  useFocusEffect(
    useCallback(() => {
      void refreshCheckedIn();
    }, [refreshCheckedIn]),
  );

  useFocusEffect(
    useCallback(() => {
      if (!localCourtId) return;
      let active = true;
      void fetchCourtWeekSpans(localCourtId).then((spans) => {
        if (active) setCourtHoursLabels(previous => ({ ...previous, [localCourtId]: formatCourtHours(courtHours(spans).hours) }));
      });
      return () => {
        active = false;
      };
    }, [localCourtId]),
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
        await hideAutoCheckIn(localCourt.id);
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

  const cancelPending = async () => {
    if (isChecking) return;
    setIsChecking(true);
    try {
      if (!(await hideAutoCheckIn(localCourt.id))) showToast({ title: "Couldn't cancel", body: "Try again.", icon: "alert-circle" });
    } finally { setIsChecking(false); }
  };



  return (
    <ScreenViewport>
      <ScreenHeader title="LOCALCHECK" active={Boolean(status)} right={status ? <HomeSessionStatus status={status} /> : undefined} />

      <HomeCourtCarousel courts={listCourts} selectedId={localCourt.id} onSelect={court => setViewCourtId(court.id)}>
        {court => {
          const count = liveCounts[court.id]?.activeCount ?? (court.id === localCourt.id ? activeTotal : court.activeCount ?? 0);
          const next = runs.filter(run => run.courtId === court.id && Date.parse(run.startTimeIso) >= now - 60 * 60_000).sort((a, b) => a.startTimeIso.localeCompare(b.startTimeIso));
          return <HomeCourtHero court={court} activeCount={court.id === localCourt.id ? activeLabel : String(count)} live={count > 0}
            localCount={court.id === localCourt.id ? localCount : liveCounts[court.id]?.localCount ?? court.localCount ?? 0}
            hoursLabel={courtHoursLabels[court.id] ?? "—"} nextGame={nextGameLabel(next[0], now)} onChooseCourt={() => setPickerOpen(true)} />;
        }}
      </HomeCourtCarousel>

      <ScrollView
        ref={scroll}
        contentContainerStyle={{ paddingBottom: tabFloor + Space.lg }}
        alwaysBounceVertical={false}
        bounces={false}
        overScrollMode="never"
        showsVerticalScrollIndicator={false}
        style={styles.scroll}
      >
        <HomeCourtActions
          courtName={localCourt.shortName || localCourt.name}
          isCheckedIn={isCheckedIn}
          isChecking={isChecking}
          onCheckIn={() => void handleCheckIn()}
          onViewCourt={() => router.push(`/court/${localCourt.id}`)}
          pending={waitingToPost}
          onCancel={() => void cancelPending()}
        />
        {!waitingToPost ? <AutoCheckInNote courtId={localCourt.id} /> : null}
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
          <CourtDayPlanner court={localCourt} games={upcoming} liveCount={activeTotal} onReveal={() => scroll.current?.scrollToEnd({ animated: false })} />
        </View>
      </ScrollView>
      {pickerOpen ? <RunFlowSheet dynamic="scrollable" visible onClose={() => setPickerOpen(false)} title="LocalList" contentBottomPadding={Space.xl}>
        <View testID="home-court-picker">
          <SavedCourtPicker selectedId={localCourt.id} onSelect={court => { setViewCourtId(court.id); setPickerOpen(false); }} />
        </View>
      </RunFlowSheet> : null}
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
  scroll: { flex: 1, minHeight: 0 },
  hereNow: { paddingTop: Space.lg, borderBottomWidth: 1, borderBottomColor: Colors.hairline },
  upNext: { paddingTop: Space.lg },
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
