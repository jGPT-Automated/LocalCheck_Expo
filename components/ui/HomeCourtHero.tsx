import React from "react";
import { StyleSheet, View } from "react-native";

import { CourtSummary } from "@/components/court/CourtSummary";
import { CheckInButton, CourtLinkButton } from "@/components/court/CourtParts";
import { Colors } from "@/constants/colors";
import type { Court } from "@/constants/data";

/** Shared court summary, pinned under Home's app header. */
export function HomeCourtHero({ court, activeCount, live, localCount, hoursLabel }: {
  court: Court; activeCount: string; live: boolean; localCount: number; hoursLabel: string;
}) {
  return <View style={styles.header}><CourtSummary court={court} activeCount={activeCount} live={live} localCount={localCount} hoursLabel={hoursLabel} /></View>;
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
  header: { backgroundColor: Colors.background },
  actions: { flexDirection: "row", gap: 10, paddingHorizontal: 20, paddingTop: 14 },
  checkSlot: { flex: 1, minWidth: 0 },
});
