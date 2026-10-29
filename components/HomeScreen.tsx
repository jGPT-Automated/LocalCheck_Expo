import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { router, useFocusEffect } from "expo-router";
import React, { useCallback, useState } from "react";
import { Platform, ScrollView, StyleSheet, Text, View } from "react-native";

import { BrutalistButton } from "@/components/BrutalistButton";
import { ScreenHeader } from "@/components/ScreenHeader";
import { AutoCheckInNote } from "@/components/autoCheckIn/AutoCheckInNote";
import { HereNowSection, UpNextSection } from "@/components/court/CourtOverviewSections";
import { CourtActions, CourtSummary, courtPlaceLabel } from "@/components/court/CourtParts";
import { TodayPanel } from "@/components/court/TodayPanel";
import { ScreenViewport } from "@/components/ui/ScreenViewport";
import { useBottomFloor } from "@/components/ui/TabFloor";
import { useToast } from "@/components/ui/Toast";
import { Colors, Radius } from "@/constants/colors";
import { Layout, Space } from "@/constants/layout";
import { Typography } from "@/constants/typography";
import { useApp } from "@/context/AppContext";
import { useAuth } from "@/context/AuthContext";
import { useCourtCounts, usePresence } from "@/context/CourtPresenceContext";

/**
 * Home: a dashboard, not a feed (Oct 29). The court header (the same one the
 * Explore card and drawer use) and Check in stay pinned; Here now, Today
 * (the hours, who's going, the hour's game or open run) and Up next scroll
 * under them. The court's feed lives on the court page.
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
    isFriend,
    runs,
    refreshCheckedIn,
  } = useApp();
  const { roster } = usePresence(localCourtId);
  const liveCounts = useCourtCounts(localCourt ? [localCourt] : []);
  const { user } = useAuth();
  const tabFloor = useBottomFloor();
  const [isChecking, setIsChecking] = useState(false);
  const { showToast } = useToast();

  useFocusEffect(
    useCallback(() => {
      void refreshCheckedIn();
    }, [refreshCheckedIn]),
  );

  if (!localCourt) {
    return <NoCourtState isSignedIn={Boolean(user)} />;
  }

  // An auto check-in waiting to post counts as checked in for the player.
  const waitingToPost = pendingAutoCheckIn?.courtId === localCourt.id && checkedInCourtId !== localCourt.id;
  const isCheckedIn = checkedInCourtId === localCourt.id || waitingToPost;
  const statsActive = liveCounts[localCourt.id]?.activeCount ?? 0;
  const activeTotal = Math.max(roster.length, statsActive);
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

  const name = localCourt.shortName || localCourt.name;

  return (
    <ScreenViewport>
      <ScreenHeader checkInBar title="LOCALCHECK" />

      {/* Pinned: the court and Check in. */}
      <View>
        <CourtSummary
          approximate={activeTotal > roster.length}
          name={name}
          onCourt={activeTotal}
          place={courtPlaceLabel(localCourt)}
          sport={localCourt.sport}
          style={styles.summary}
        />
        <CourtActions
          busy={isChecking}
          checkedIn={isCheckedIn}
          courtName={name}
          onCheckIn={() => void handleCheckIn()}
          onViewCourt={() => router.push(`/court/${localCourt.id}`)}
        />
        <AutoCheckInNote courtId={localCourt.id} />
      </View>

      <ScrollView
        bounces={false}
        contentContainerStyle={{ paddingTop: Space.sm, paddingBottom: tabFloor + Space.xl }}
        showsVerticalScrollIndicator={false}
        style={styles.scroll}
      >
        <HereNowSection
          isFriend={isFriend}
          onMore={() => router.push(`/court/${localCourt.id}?tab=players`)}
          onPlayer={(id) => router.push(`/player/${id}`)}
          roster={roster}
        />
        <TodayPanel
          court={localCourt}
          games={upcoming}
          refreshKey={roster.length}
        />
        <View style={styles.upNext}>
          <UpNextSection onOpenRun={(id) => router.push(`/run/${id}`)} upcoming={upcoming} />
        </View>
      </ScrollView>
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
  scroll: { flex: 1, minHeight: 0, borderTopWidth: 1, borderTopColor: Colors.hairline },
  summary: { paddingHorizontal: Layout.screenGutter, paddingTop: Space.lg },
  upNext: { paddingTop: Space.xl },
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
