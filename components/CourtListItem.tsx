import { LinearGradient } from "expo-linear-gradient";
import React from "react";
import { StyleSheet, Text, View } from "react-native";

import { LocalTag, MetricStrip, SportLabel } from "@/components/court/CourtParts";
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
 * Canonical Explore court card: a soft sport tint in the top corner, the sport
 * (and LOCAL when it is yours) on the first line, then the name and city ·
 * distance centred, then On court / Court hours · wk / Locals. No court
 * drawing behind the text. Actions live in the court drawer, so the card has
 * none.
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
      <View style={styles.metaRow}>
        <SportLabel sport={court.sport} />
        {isLocalCourt ? <View style={styles.localTag}><LocalTag /></View> : null}
      </View>
      <Text adjustsFontSizeToFit minimumFontScale={0.6} numberOfLines={1} style={styles.name}>
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
    borderRadius: Radius.courtCard,
    borderWidth: 1,
    borderColor: Colors.hairlineCard,
    backgroundColor: Colors.sheet,
  },
  metaRow: {
    height: 26,
    marginTop: 14,
    paddingHorizontal: 18,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },
  localTag: { position: "absolute", right: 18 },
  name: {
    paddingTop: 8,
    paddingHorizontal: 18,
    textAlign: "center",
    fontFamily: Typography.headingBold,
    fontSize: 30,
    lineHeight: 32,
    letterSpacing: -0.9,
    textTransform: "uppercase",
    color: Colors.text,
    textShadowColor: Colors.sheet,
    textShadowRadius: 6,
  },
  place: { paddingTop: 6, paddingHorizontal: 18, textAlign: "center", fontFamily: Typography.bodyMedium, fontSize: 11, color: Colors.textSecondary },
  strip: { marginTop: 14 },
});
