import React from "react";
import { StyleSheet, Text, View } from "react-native";

import { Colors } from "@/constants/colors";
import { TextStyles } from "@/constants/typography";

export function EloStat({
  value,
  emphasized = false,
  hero = false,
  delta,
  showLabel = true,
  compactDelta = false,
  leaderboard = false,
}: {
  value: number;
  emphasized?: boolean;
  hero?: boolean;
  delta?: number | null;
  showLabel?: boolean;
  compactDelta?: boolean;
  leaderboard?: boolean;
}) {
  return (
    <View
      accessibilityLabel={`${value} ELO`}
      style={[
        styles.wrap,
        hero && styles.heroWrap,
        leaderboard && styles.leaderboardWrap,
      ]}
    >
      <Text
        adjustsFontSizeToFit={hero}
        minimumFontScale={0.85}
        numberOfLines={1}
        style={[
          styles.value,
          hero && styles.hero,
          leaderboard && styles.leaderboardValue,
          emphasized && styles.emphasized,
        ]}
      >
        {value}
      </Text>
      {showLabel ? (
        <Text
          style={[
            styles.label,
            hero && styles.heroLabel,
            leaderboard && styles.leaderboardLabel,
          ]}
        >
          ELO
        </Text>
      ) : null}
      {delta != null ? (
        <Text style={[styles.delta, delta < 0 && styles.negative]}>
          {compactDelta ? (delta > 0 ? "▲ " : "▼ ") : delta > 0 ? "+" : ""}
          {Math.abs(delta)}
          {compactDelta ? "" : " THIS WEEK"}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { minWidth: 56, alignItems: "center", justifyContent: "center" },
  leaderboardWrap: { minWidth: 52, alignItems: "flex-end" },
  heroWrap: { minWidth: 64, flexShrink: 0 },
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
  leaderboardValue: { fontSize: 17, lineHeight: 19 },
  leaderboardLabel: { fontSize: 8, lineHeight: 9, letterSpacing: 1.2 },
  hero: { ...TextStyles.displayLarge, color: Colors.text },
  heroLabel: { marginTop: 2, letterSpacing: 0.7 },
  emphasized: { color: Colors.text },
  delta: {
    ...TextStyles.labelSmall,
    marginTop: 1,
    color: Colors.accent,
    letterSpacing: 0.4,
  },
  negative: { color: Colors.loss },
});
