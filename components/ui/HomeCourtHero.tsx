import { Feather } from "@expo/vector-icons";
import React from "react";
import { StyleSheet, Text, View } from "react-native";

import { CourtArt } from "@/components/court/CourtArt";
import { CheckInButton, LocalTag, MetricStrip, SportLabel } from "@/components/court/CourtParts";
import { PressableScale } from "@/components/ui/PressableScale";
import { Colors, Radius } from "@/constants/colors";
import type { Court } from "@/constants/data";
import { Typography } from "@/constants/typography";

/**
 * Home's local court header (Oct 16): full width, not a card. Court trace on
 * the right, sport on the left with the Local tag hanging off the right edge,
 * the centred name, city · distance, then On court / Court hours · wk /
 * Locals. Kept short so the feed gets the screen; the actions live in
 * HomeCourtActions at the bottom, where the thumb is.
 */
export function HomeCourtHero({
  court,
  activeCount,
  live,
  localCount,
  hoursLabel,
}: {
  court: Court;
  activeCount: string;
  live: boolean;
  localCount: number;
  hoursLabel: string;
}) {
  const distance =
    court.distanceKm != null && !Number.isNaN(court.distanceKm)
      ? `${(court.distanceKm * 0.621371).toFixed(1)} mi`
      : null;
  const place = [court.city || court.market || court.neighborhood, distance].filter(Boolean).join(" · ");

  return (
    <View style={styles.header}>
      <CourtArt sport={court.sport} />
      <View style={styles.metaRow}>
        <SportLabel sport={court.sport} />
        <LocalTag />
      </View>
      <Text adjustsFontSizeToFit minimumFontScale={0.6} numberOfLines={1} style={styles.name}>
        {court.shortName || court.name}
      </Text>
      {place ? <Text numberOfLines={1} style={styles.place}>{place}</Text> : null}
      <View style={styles.strip}>
        <MetricStrip
          cells={[
            { label: "On court", value: activeCount, live },
            { label: "Court hours · wk", value: hoursLabel },
            { label: "Locals", value: localCount },
          ]}
        />
      </View>
    </View>
  );
}

/**
 * Home's reachable action row, pinned above the tab bar: Plan visit (small),
 * Check in (most of the width) and a square Court ↗ into the court page.
 */
export function HomeCourtActions({
  courtName,
  isCheckedIn,
  isChecking,
  onCheckIn,
  onPlanVisit,
  onViewCourt,
}: {
  courtName: string;
  isCheckedIn: boolean;
  isChecking: boolean;
  onCheckIn: () => void;
  onPlanVisit: () => void;
  onViewCourt: () => void;
}) {
  return (
    <View style={styles.actions}>
      <PressableScale
        accessibilityHint="Opens the week to plan when you'll play"
        accessibilityLabel="Plan visit"
        accessibilityRole="button"
        onPress={onPlanVisit}
        style={styles.plan}
      >
        <Feather color={Colors.inkSoft} name="calendar" size={14} />
        <Text style={styles.planText}>Plan</Text>
      </PressableScale>
      <View style={styles.checkSlot}>
        <CheckInButton busy={isChecking} checkedIn={isCheckedIn} courtName={courtName} height={52} onPress={onCheckIn} />
      </View>
      <PressableScale
        accessibilityHint="Opens the full court page"
        accessibilityLabel={`View ${courtName}`}
        accessibilityRole="button"
        onPress={onViewCourt}
        style={styles.square}
      >
        <Feather color={Colors.text} name="arrow-up-right" size={20} />
      </PressableScale>
    </View>
  );
}

const styles = StyleSheet.create({
  header: { position: "relative", overflow: "hidden", paddingTop: 6 },
  metaRow: { height: 28, paddingLeft: 20, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  name: {
    marginTop: 4,
    paddingHorizontal: 20,
    textAlign: "center",
    fontFamily: Typography.headingBold,
    fontSize: 34,
    lineHeight: 36,
    letterSpacing: -1.1,
    textTransform: "uppercase",
    color: Colors.text,
    textShadowColor: Colors.background,
    textShadowRadius: 6,
  },
  place: { marginTop: 2, textAlign: "center", fontFamily: Typography.bodyMedium, fontSize: 11, color: Colors.textSecondary },
  strip: { paddingHorizontal: 20, paddingTop: 10, paddingBottom: 6 },

  actions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 10,
    borderTopWidth: 1,
    borderTopColor: Colors.hairline,
    backgroundColor: Colors.background,
  },
  plan: {
    width: 76,
    height: 52,
    alignItems: "center",
    justifyContent: "center",
    gap: 3,
    borderRadius: Radius.button,
    borderWidth: 1,
    borderColor: Colors.hairlineChrome,
    backgroundColor: Colors.panel,
  },
  planText: { fontFamily: Typography.bodyBold, fontSize: 9, letterSpacing: 1.3, textTransform: "uppercase", color: Colors.inkSoft },
  checkSlot: { flex: 1, minWidth: 0 },
  square: {
    width: 52,
    height: 52,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: Radius.button,
    borderWidth: 1,
    borderColor: Colors.hairlineChrome,
    backgroundColor: Colors.panel,
  },
});
