import React from "react";
import { StyleSheet } from "react-native";

import { CourtSummary } from "@/components/court/CourtSummary";
import { PressableScale } from "@/components/ui/PressableScale";
import { Colors, Radius } from "@/constants/colors";
import type { Court } from "@/constants/data";

interface CourtListItemProps {
  court: Court;
  onPress?: (court: Court) => void;
  hoursLabel: string;
}

/** Explore card: the shared court identity; tapping opens its drawer. */
export function CourtListItem({ court, onPress, hoursLabel }: CourtListItemProps) {
  const active = court.activeCount ?? 0;
  return (
    <PressableScale
      accessibilityLabel={onPress ? `Open ${court.name}` : undefined}
      accessibilityRole={onPress ? "button" : undefined}
      disabled={!onPress}
      onPress={onPress ? () => onPress(court) : undefined}
      style={styles.card}
      testID={`court-${court.id}`}
    >
      <CourtSummary court={court} activeCount={active} live={active > 0} localCount={court.localCount ?? 0} hoursLabel={hoursLabel} size="card" />
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  card: { marginHorizontal: 16, marginVertical: 6, overflow: "hidden", borderRadius: Radius.panel, borderWidth: 1, borderColor: Colors.border, backgroundColor: Colors.surface },
});
