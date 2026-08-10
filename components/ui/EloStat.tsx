import React from "react";
import { StyleSheet, Text, View } from "react-native";

import { Colors } from "@/constants/colors";
import { Typography } from "@/constants/typography";

export function EloStat({
  value,
  emphasized = false,
  hero = false,
  delta,
}: {
  value: number;
  emphasized?: boolean;
  hero?: boolean;
  delta?: number | null;
}) {
  return (
    <View accessibilityLabel={`${value} ELO`} style={styles.wrap}>
      <Text style={[styles.value, hero && styles.hero, emphasized && styles.emphasized]}>{value}</Text>
      <Text style={[styles.label, hero && styles.heroLabel]}>ELO</Text>
      {delta != null ? (
        <Text style={[styles.delta, delta < 0 && styles.negative]}>
          {delta > 0 ? "+" : ""}{delta} THIS WEEK
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { minWidth: 52, alignItems: "center", justifyContent: "center" },
  value: {
    fontFamily: Typography.heading,
    fontSize: 20,
    lineHeight: 21,
    color: Colors.text,
  },
  label: {
    marginTop: 1,
    fontFamily: Typography.bodyBold,
    fontSize: 6,
    color: Colors.muted,
    letterSpacing: 1.2,
  },
  hero: { fontSize: 38, lineHeight: 40, color: Colors.text },
  heroLabel: { marginTop: 2, fontSize: 8, letterSpacing: 1.5 },
  emphasized: { color: Colors.text },
  delta: { marginTop: 4, fontFamily: Typography.bodyBold, fontSize: 7, color: Colors.accent, letterSpacing: 0.8 },
  negative: { color: Colors.loss },
});
