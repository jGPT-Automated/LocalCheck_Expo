import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import React from "react";
import { Platform, StyleSheet, View } from "react-native";

import { Colors } from "@/constants/colors";
import type { CourtSport } from "@/constants/data";

/** Canonical icon-library-backed sport emblem used on every court surface. */
export function SportEmblem({
  sport,
  size = 14,
  glow = false,
}: {
  sport: CourtSport;
  size?: number;
  glow?: boolean;
}) {
  return (
    <View
      accessibilityLabel={`${sport.toLocaleLowerCase()} court`}
      accessibilityRole="image"
      style={[
        styles.wrap,
        { width: size + 8, height: size + 8 },
        glow && styles.glow,
      ]}
    >
      {sport === "BASKETBALL" ? (
        <Ionicons color={Colors.textSecondary} name="basketball-outline" size={size} />
      ) : (
        <MaterialCommunityIcons
          color={Colors.textSecondary}
          name={sport === "PICKLEBALL" ? "table-tennis" : sport === "TENNIS" ? "tennis-ball" : sport === "SOCCER" ? "soccer" : "volleyball"}
          size={size}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: "center",
    justifyContent: "center",
  },
  glow: {
    ...Platform.select({
      ios: {
        shadowColor: Colors.accent,
        shadowOpacity: 0.45,
        shadowRadius: 5,
        shadowOffset: { width: 0, height: 0 },
      },
      web: {
        filter: `drop-shadow(0 0 4px ${Colors.accentGlow})`,
      } as object,
    }),
  },
});
