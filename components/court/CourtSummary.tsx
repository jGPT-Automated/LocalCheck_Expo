import React from "react";
import { StyleSheet, Text, View } from "react-native";

import { CourtArt } from "@/components/court/CourtArt";
import { MetricStrip, SportLabel } from "@/components/court/CourtParts";
import { Colors } from "@/constants/colors";
import type { Court } from "@/constants/data";
import { Typography } from "@/constants/typography";

/** The same court identity on an Explore card, its drawer and Home.
 * Art is decoration. Navigation, check-in and saved-court actions are owned
 * by the surrounding screen, outside this non-interactive summary.
 */
export function CourtSummary({
  court, activeCount, live, localCount, hoursLabel, size = "page",
}: {
  court: Court;
  activeCount: string | number;
  live: boolean;
  localCount: number;
  hoursLabel: string;
  size?: "page" | "drawer" | "card";
}) {
  const city = court.city || court.market || court.neighborhood;
  return (
    <View style={styles.summary}>
      <CourtArt sport={court.sport} />
      <View style={styles.meta}>
        <SportLabel sport={court.sport} />
        {city ? <Text numberOfLines={1} style={styles.city}>{city}</Text> : null}
      </View>
      <Text adjustsFontSizeToFit minimumFontScale={0.8} numberOfLines={2} style={styles.name}>
        {court.shortName || court.name}
      </Text>
      <MetricStrip
          cells={[
            { label: "On court", value: activeCount, live },
            { label: "Court hours · wk", value: hoursLabel },
            { label: "Locals", value: localCount },
          ]}
          size={size}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  summary: { position: "relative", overflow: "hidden", paddingTop: 12 },
  meta: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12, minHeight: 24, paddingHorizontal: 20 },
  city: { flexShrink: 1, maxWidth: "50%", fontFamily: Typography.bodyMedium, fontSize: 12, lineHeight: 16, color: Colors.textSecondary, textAlign: "right" },
  name: { marginVertical: 12, paddingHorizontal: 20, textAlign: "center", fontFamily: Typography.headingBold, fontSize: 30, lineHeight: 36, letterSpacing: -0.6, textTransform: "uppercase", color: Colors.text },
});
