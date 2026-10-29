import { Feather } from "@expo/vector-icons";
import React from "react";
import { StyleSheet, Text, View } from "react-native";

import { MetricStrip, SportLabel } from "@/components/court/CourtParts";
import { PressableScale } from "@/components/ui/PressableScale";
import { Colors, Radius } from "@/constants/colors";
import type { Court } from "@/constants/data";
import { Typography } from "@/constants/typography";

interface CourtListItemProps {
  court: Court;
  onPress?: (court: Court) => void;
  isLocalCourt?: boolean;
  /** Court hours · wk, already formatted ("70h", or a dash while loading). */
  hoursLabel: string;
}

/**
 * Canonical Explore court card: sport, name, city · distance and court stats.
 * The whole card opens the drawer; its chevron is a cue, not another button.
 */
export function CourtListItem({ court, onPress, isLocalCourt, hoursLabel }: CourtListItemProps) {
  const active = court.activeCount ?? 0;
  const distance =
    court.distanceKm != null && !Number.isNaN(court.distanceKm)
      ? `${(court.distanceKm * 0.621371).toFixed(1)} mi`
      : null;
  const place = [court.city || court.market || court.neighborhood, distance].filter(Boolean).join(" · ");

  return (
    <PressableScale
      accessibilityLabel={onPress ? `Open ${court.name}` : undefined}
      accessibilityHint={isLocalCourt ? "Your local court" : undefined}
      accessibilityRole={onPress ? "button" : undefined}
      disabled={!onPress}
      onPress={onPress ? () => onPress(court) : undefined}
      style={styles.card}
      testID={`court-${court.id}`}
    >
      <View style={styles.metaRow}>
        <SportLabel sport={court.sport} />
        {onPress ? <Feather accessible={false} color={Colors.textSecondary} name="chevron-right" size={18} /> : null}
      </View>
      <Text numberOfLines={2} style={styles.name}>
        {court.shortName || court.name}
      </Text>
      {place ? <Text numberOfLines={1} style={styles.place}>{place}</Text> : null}
      <View style={styles.strip}>
        <MetricStrip
          cells={[
            { label: "On court", value: active, live: active > 0 },
            { label: "Court hours · wk", value: hoursLabel },
            { label: "Locals", value: court.localCount ?? 0 },
          ]}
          size="card"
        />
      </View>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  card: {
    marginHorizontal: 16,
    marginVertical: 6,
    overflow: "hidden",
    borderRadius: Radius.panel,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.surface,
  },
  metaRow: {
    height: 26,
    marginTop: 14,
    paddingHorizontal: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  name: {
    paddingTop: 6,
    paddingHorizontal: 16,
    fontFamily: Typography.headingBold,
    fontSize: 26,
    lineHeight: 30,
    letterSpacing: -0.6,
    textTransform: "uppercase",
    color: Colors.text,
  },
  place: { paddingTop: 6, paddingHorizontal: 16, fontFamily: Typography.bodyMedium, fontSize: 12, color: Colors.textSecondary },
  strip: { marginTop: 14 },
});
