import React from "react";
import { StyleSheet, Text, View, ViewStyle } from "react-native";

import { Colors, Radius } from "@/constants/colors";
import { Typography } from "@/constants/typography";

import { LivePulse } from "./LivePulse";

interface StatBlockProps {
  value: string | number;
  label: string;
  valueColor?: string;
  style?: ViewStyle;
  large?: boolean;
  /** A small pulse sits at the value's corner instead of pushing it off
   * center, and the value itself takes the accent color. */
  live?: boolean;
}

export function StatBlock({
  value,
  label,
  valueColor,
  style,
  large,
  live,
}: StatBlockProps) {
  return (
    <View style={[styles.container, style]}>
      <View style={styles.valueWrap}>
        <Text
          style={[
            styles.value,
            large && styles.valueLarge,
            live || valueColor
              ? { color: valueColor ?? Colors.accent }
              : null,
          ]}
        >
          {value}
        </Text>
        {live ? (
          <LivePulse color={Colors.accent} size={5} style={styles.liveDot} />
        ) : null}
      </View>
      <Text style={styles.label}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { alignItems: "center", flex: 1, borderRadius: Radius.sm },
  valueWrap: { position: "relative" },
  value: {
    fontFamily: Typography.heading,
    fontSize: 22,
    color: Colors.text,
    lineHeight: 24,
  },
  valueLarge: { fontSize: 32, lineHeight: 34 },
  liveDot: { position: "absolute", top: -3, right: -9 },
  label: {
    fontFamily: Typography.bodyMedium,
    fontSize: 9,
    color: Colors.muted,
    letterSpacing: 1.5,
    textTransform: "uppercase" as const,
    marginTop: 3,
  },
});
