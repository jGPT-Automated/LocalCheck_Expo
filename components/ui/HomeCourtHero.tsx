import React from "react";
import { StyleSheet, Text, View } from "react-native";

import { CheckInButton, CourtLinkButton, MetricStrip, SportLabel } from "@/components/court/CourtParts";
import { Colors } from "@/constants/colors";
import type { Court } from "@/constants/data";
import { Typography } from "@/constants/typography";

/**
 * Home's local court header: full width, not a card. `HomeCourtTop` (sport on
 * the left) scrolls away; `HomeCourtHero` (left-aligned name, city · distance,
 * On court / Court hours · wk / Locals)
 * stays pinned under the app header. HomeCourtActions follows.
 */
export function HomeCourtTop({ court }: { court: Court }) {
  return (
    <View style={styles.metaRow}>
      <SportLabel sport={court.sport} />
    </View>
  );
}

/** The court name and its numbers: the part of Home that stays pinned. */
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
      <Text adjustsFontSizeToFit minimumFontScale={0.8} numberOfLines={2} style={styles.name}>
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
 * Home's action row, the Explore drawer's: Check in (or Check out) beside
 * Court, which opens the court page.
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
      <View style={styles.checkSlot}>
        <CheckInButton busy={isChecking} checkedIn={isCheckedIn} courtName={courtName} onPress={onCheckIn} />
      </View>
      <CourtLinkButton courtName={courtName} onPress={onViewCourt} />
    </View>
  );
}

const styles = StyleSheet.create({
  header: { position: "relative", overflow: "hidden", paddingTop: 4, backgroundColor: Colors.background },
  metaRow: { height: 28, paddingHorizontal: 20, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  name: {
    marginTop: 4,
    paddingHorizontal: 20,
    textAlign: "left",
    fontFamily: Typography.headingBold,
    fontSize: 32,
    lineHeight: 36,
    letterSpacing: -0.6,
    textTransform: "uppercase",
    color: Colors.text,
  },
  place: { marginTop: 2, paddingHorizontal: 20, textAlign: "left", fontFamily: Typography.bodyMedium, fontSize: 12, color: Colors.textSecondary },
  strip: { paddingHorizontal: 20, paddingTop: 10, paddingBottom: 6 },

  actions: { flexDirection: "row", gap: 10, paddingHorizontal: 20, paddingTop: 14 },
  checkSlot: { flex: 1, minWidth: 0 },
});
