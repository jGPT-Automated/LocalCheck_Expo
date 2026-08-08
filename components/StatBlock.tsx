import React from "react";
import { StyleSheet, Text, View, ViewStyle } from "react-native";

import { Colors, Radius } from "@/constants/colors";
import { Typography } from "@/constants/typography";

interface StatBlockProps {
  value: string | number;
  label: string;
  valueColor?: string;
  style?: ViewStyle;
  large?: boolean;
}

export function StatBlock({ value, label, valueColor, style, large }: StatBlockProps) {
  return (
    <View style={[styles.container, style]}>
      <Text style={[styles.value, large && styles.valueLarge, valueColor ? { color: valueColor } : null]}>
        {value}
      </Text>
      <Text style={styles.label}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { alignItems: "center", flex: 1, borderRadius: Radius.sm },
  value: {
    fontFamily: Typography.heading,
    fontSize: 22,
    color: Colors.text,
    lineHeight: 24,
  },
  valueLarge: { fontSize: 32, lineHeight: 34 },
  label: {
    fontFamily: Typography.bodyMedium,
    fontSize: 9,
    color: Colors.muted,
    letterSpacing: 1.5,
    textTransform: "uppercase" as const,
    marginTop: 3,
  },
});
