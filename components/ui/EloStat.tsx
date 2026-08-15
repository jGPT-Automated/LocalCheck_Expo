import React from "react";
import { StyleSheet, Text, View } from "react-native";

import { Colors } from "@/constants/colors";
import { TextStyles } from "@/constants/typography";

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
  wrap: { minWidth: 56, alignItems: "center", justifyContent: "center" },
  value: {
    ...TextStyles.statSmall,
    color: Colors.text,
  },
  label: {
    marginTop: 1,
    ...TextStyles.labelSmall,
    color: Colors.muted,
    letterSpacing: 0.5,
  },
  hero: { ...TextStyles.displayLarge, color: Colors.text },
  heroLabel: { marginTop: 2, letterSpacing: 0.7 },
  emphasized: { color: Colors.text },
  delta: { ...TextStyles.labelSmall, marginTop: 4, color: Colors.accent, letterSpacing: 0.4 },
  negative: { color: Colors.loss },
});
