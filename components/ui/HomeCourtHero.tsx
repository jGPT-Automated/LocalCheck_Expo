import React from "react";
import { StyleSheet, Text, View } from "react-native";

import { CourtArt } from "@/components/court/CourtArt";
import { CheckInButton, CourtLinkButton, LocalButton, MetricStrip, SportPlaceRow } from "@/components/court/CourtParts";
import { Colors } from "@/constants/colors";
import type { Court } from "@/constants/data";
import { Typography } from "@/constants/typography";

function courtPlace(court: Court): string {
  const distance =
    court.distanceKm != null && !Number.isNaN(court.distanceKm)
      ? `${(court.distanceKm * 0.621371).toFixed(1)} mi`
      : null;
  return [court.city || court.market || court.neighborhood, distance].filter(Boolean).join(" · ");
}

/**
 * Home's local court header: full width, not a card, and all of it stays fixed
 * while the page below scrolls. `HomeCourtTop` (sport on the left, city ·
 * distance on the right), `HomeCourtHero` (court trace, centred name, On court
 * / Court hours · wk / Locals), then HomeCourtActions.
 */
export function HomeCourtTop({ court }: { court: Court }) {
  return <SportPlaceRow place={courtPlace(court)} sport={court.sport} style={styles.metaRow} />;
}

/** The court name and its numbers. */
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
  return (
    <View style={styles.header}>
      <CourtArt sport={court.sport} />
      <Text adjustsFontSizeToFit minimumFontScale={0.6} numberOfLines={1} style={styles.name}>
        {court.shortName || court.name}
      </Text>
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
 * Home's action row, the Explore drawer's: your local (glass), Check in (or
 * Check out), and Court (glass), which opens the court page.
 */
export function HomeCourtActions({
  courtName,
  isCheckedIn,
  isChecking,
  onCheckIn,
  onViewCourt,
}: {
  courtName: string;
  isCheckedIn: boolean;
  isChecking: boolean;
  onCheckIn: () => void;
  onViewCourt: () => void;
}) {
  return (
    <View style={styles.actions}>
      <LocalButton active courtName={courtName} />
      <View style={styles.checkSlot}>
        <CheckInButton busy={isChecking} checkedIn={isCheckedIn} courtName={courtName} onPress={onCheckIn} />
      </View>
      <CourtLinkButton courtName={courtName} onPress={onViewCourt} />
    </View>
  );
}

const styles = StyleSheet.create({
  header: { position: "relative", overflow: "hidden", paddingTop: 4, backgroundColor: Colors.background },
  metaRow: { height: 28, paddingHorizontal: 20 },
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
  strip: { paddingHorizontal: 20, paddingTop: 10, paddingBottom: 6 },

  actions: { flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 20, paddingTop: 14 },
  checkSlot: { flex: 1, minWidth: 0 },
});
