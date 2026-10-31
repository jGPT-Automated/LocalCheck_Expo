import React from "react";
import { StyleSheet } from "react-native";

import { CourtArt } from "@/components/court/CourtArt";
import { CourtTitleRow } from "@/components/court/CourtParts";
import { PressableScale } from "@/components/ui/PressableScale";
import { Colors, Radius } from "@/constants/colors";
import type { Court } from "@/constants/data";

interface CourtListItemProps {
  court: Court;
  onPress?: (court: Court) => void;
}

/**
 * Canonical Explore court card: court trace top right, then the shared title
 * row (sport, name, city · distance on the left, the live On court number on
 * the right). No numbers strip and no local mark: tapping the card opens the
 * court drawer, which carries the same title row plus the strip and actions.
 */
export function CourtListItem({ court, onPress }: CourtListItemProps) {
  const active = court.activeCount ?? 0;
  const distance =
    court.distanceKm != null && !Number.isNaN(court.distanceKm)
      ? `${(court.distanceKm * 0.621371).toFixed(1)} mi`
      : null;
  const place = [court.city || court.market || court.neighborhood, distance].filter(Boolean).join(" · ");

  return (
    <PressableScale
      accessibilityLabel={onPress ? `Open ${court.name}` : undefined}
      accessibilityRole={onPress ? "button" : undefined}
      disabled={!onPress}
      onPress={onPress ? () => onPress(court) : undefined}
      style={styles.card}
      testID={`court-${court.id}`}
    >
      {/* Centred on the name, as it was when the card had the numbers strip. */}
      <CourtArt sport={court.sport} top={-16} />
      <CourtTitleRow
        live={active > 0}
        liveValue={active}
        name={court.shortName || court.name}
        place={place || undefined}
        sport={court.sport}
      />
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  card: {
    marginHorizontal: 16,
    marginVertical: 6,
    overflow: "hidden",
    borderRadius: Radius.courtCard,
    borderWidth: 1,
    borderColor: Colors.hairlineCard,
    backgroundColor: Colors.sheet,
    paddingTop: 16,
    paddingBottom: 16,
  },
});
