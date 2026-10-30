import { LinearGradient } from "expo-linear-gradient";
import React from "react";
import { StyleSheet } from "react-native";

import { CourtSummary, courtPlaceLabel } from "@/components/court/CourtParts";
import { PressableScale } from "@/components/ui/PressableScale";
import { Colors, Radius } from "@/constants/colors";
import type { Court } from "@/constants/data";

interface CourtListItemProps {
  court: Court;
  onPress?: (court: Court) => void;
}

/**
 * Canonical Explore court card (Oct 29): thin, the same `CourtSummary` the
 * drawer rises with (sport and city · distance on top, the name and who's on
 * court now below), on a soft sport tint. Actions live in the drawer.
 */
export function CourtListItem({ court, onPress }: CourtListItemProps) {
  return (
    <PressableScale
      accessibilityLabel={onPress ? `Open ${court.name}` : undefined}
      accessibilityRole={onPress ? "button" : undefined}
      disabled={!onPress}
      onPress={onPress ? () => onPress(court) : undefined}
      style={styles.card}
      testID={`court-${court.id}`}
    >
      <LinearGradient
        colors={[court.sport === "PICKLEBALL" ? Colors.pickleballTint : Colors.basketballTint, "transparent"]}
        end={{ x: 0.35, y: 0.7 }}
        pointerEvents="none"
        start={{ x: 1, y: 0 }}
        style={StyleSheet.absoluteFill}
      />
      <CourtSummary
        name={court.shortName || court.name}
        onCourt={court.activeCount ?? 0}
        place={courtPlaceLabel(court)}
        size="card"
        sport={court.sport}
      />
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  card: {
    marginHorizontal: 16,
    marginVertical: 6,
    paddingHorizontal: 18,
    paddingVertical: 16,
    overflow: "hidden",
    borderRadius: Radius.courtCard,
    borderWidth: 1,
    borderColor: Colors.hairlineCard,
    backgroundColor: Colors.sheet,
  },
});
