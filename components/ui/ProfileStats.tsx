import React from "react";
import { StyleSheet, Text, View } from "react-native";

import { Colors } from "@/constants/colors";
import { Typography } from "@/constants/typography";

export type ProfileMetric = {
  label: string;
  value: string | number;
  tone?: "win" | "loss" | "default";
};

export function ProfileStats({ metrics }: { metrics: ProfileMetric[] }) {
  return (
    <View style={styles.panel}>
      {metrics.map((metric, index) => (
        <View key={metric.label} style={[styles.metric, index > 0 && styles.divider]}>
          <Text style={[
            styles.value,
            metric.tone === "win" && styles.win,
            metric.tone === "loss" && styles.loss,
          ]}>{metric.value}</Text>
          <Text style={styles.label}>{metric.label}</Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  panel: { flexDirection: "row", borderTopWidth: StyleSheet.hairlineWidth, borderBottomWidth: StyleSheet.hairlineWidth, borderColor: Colors.border },
  metric: { flex: 1, minHeight: 70, alignItems: "center", justifyContent: "center" },
  divider: { borderLeftWidth: StyleSheet.hairlineWidth, borderLeftColor: Colors.border },
  value: { fontFamily: Typography.headingBold, fontSize: 24, lineHeight: 27, color: Colors.text },
  win: { color: Colors.win },
  loss: { color: Colors.loss },
  label: { marginTop: 3, fontFamily: Typography.bodyMedium, fontSize: 7, color: Colors.muted, letterSpacing: 1.1 },
});
