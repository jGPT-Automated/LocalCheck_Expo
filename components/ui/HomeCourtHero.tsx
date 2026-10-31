import React from "react";
import { StyleSheet, View } from "react-native";

import { CourtArt } from "@/components/court/CourtArt";
import { CheckInButton, CourtLinkButton, CourtTitleRow, MetricStrip } from "@/components/court/CourtParts";
import { Colors } from "@/constants/colors";
import type { Court } from "@/constants/data";

/**
 * Home's local court header: the same title row as the Explore card, the
 * drawer and the court page (sport, name, city · distance, live number on the
 * right), then Next game / Court hours · wk / Locals on the darker band. It
 * stays pinned under the app header. No local mark: that lives on the court
 * page only. HomeCourtActions follows.
 */
export function HomeCourtHero({
  court,
  activeCount,
  live,
  localCount,
  hoursLabel,
  nextGame,
}: {
  court: Court;
  activeCount: string;
  live: boolean;
  localCount: number;
  hoursLabel: string;
  nextGame: string;
}) {
  const distance =
    court.distanceKm != null && !Number.isNaN(court.distanceKm)
      ? `${(court.distanceKm * 0.621371).toFixed(1)} mi`
      : null;
  const place = [court.city || court.market || court.neighborhood, distance].filter(Boolean).join(" · ");

  return (
    <View style={styles.header}>
      <CourtArt sport={court.sport} top={-16} />
      <View style={styles.title}>
        <CourtTitleRow
          live={live}
          liveValue={activeCount}
          name={court.shortName || court.name}
          place={place || undefined}
          size="page"
          sport={court.sport}
        />
      </View>
      <View style={styles.strip}>
        <MetricStrip
          cells={[
            { label: "Next game", value: nextGame },
            { label: "Court hours · wk", value: hoursLabel },
            { label: "Locals", value: localCount },
          ]}
          size="card"
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
  header: { position: "relative", overflow: "hidden", backgroundColor: Colors.background },
  title: { paddingTop: 12 },
  strip: { paddingTop: 16 },

  actions: { flexDirection: "row", gap: 10, paddingHorizontal: 20, paddingTop: 14 },
  checkSlot: { flex: 1, minWidth: 0 },
});
