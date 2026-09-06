import { NumberFlow } from "number-flow-react-native";
import React, { type ReactNode } from "react";
import { StyleSheet, Text, View } from "react-native";

import { Colors } from "@/constants/colors";
import { Typography } from "@/constants/typography";

export type ProfileMetric = {
  label: string;
  value: string | number;
  tone?: "win" | "loss" | "default";
};

export function ProfileStats({
  metrics,
  trailing,
  compact = false,
  animateChanges = false,
}: {
  metrics: ProfileMetric[];
  trailing?: ReactNode;
  compact?: boolean;
  /** Only pass this on the signed-in player's own stats — a peer's profile
   * should never animate just because you happened to load it after a
   * change. See ScoreCard's EloChangeLine for the ELO-specific case. */
  animateChanges?: boolean;
}) {
  return (
    <View style={[styles.row, compact && styles.rowCompact]}>
      <View style={styles.panel}>
        {metrics.map((metric, index) => (
          <View
            key={metric.label}
            style={[styles.metric, index > 0 && styles.divider]}
          >
            {animateChanges && typeof metric.value === "number" ? (
              <NumberFlow
                style={StyleSheet.flatten([
                  styles.value,
                  metric.tone === "win" && styles.win,
                  metric.tone === "loss" && styles.loss,
                ])}
                value={metric.value}
              />
            ) : (
              <Text
                style={[
                  styles.value,
                  metric.tone === "win" && styles.win,
                  metric.tone === "loss" && styles.loss,
                ]}
              >
                {metric.value}
              </Text>
            )}
            <Text style={styles.label}>{metric.label}</Text>
          </View>
        ))}
      </View>
      {trailing ? <View style={styles.trailing}>{trailing}</View> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    minHeight: 90,
    paddingHorizontal: 20,
    paddingBottom: 14,
    flexDirection: "row",
    alignItems: "stretch",
    gap: 10,
  },
  rowCompact: { minHeight: 84, paddingVertical: 8 },
  panel: {
    flex: 1,
    minWidth: 0,
    flexDirection: "row",
    overflow: "hidden",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.borderLight,
    borderRadius: 10,
    backgroundColor: Colors.surface,
  },
  metric: {
    flex: 1,
    minWidth: 0,
    alignItems: "center",
    justifyContent: "center",
  },
  divider: {
    borderLeftWidth: StyleSheet.hairlineWidth,
    borderLeftColor: Colors.border,
  },
  value: {
    fontFamily: Typography.headingBold,
    fontSize: 23,
    lineHeight: 26,
    color: Colors.text,
  },
  win: { color: Colors.win },
  loss: { color: Colors.loss },
  label: {
    marginTop: 3,
    fontFamily: Typography.bodyMedium,
    fontSize: 11,
    lineHeight: 13,
    color: Colors.muted,
    letterSpacing: 0.8,
  },
  trailing: { flexDirection: "row", alignItems: "stretch", gap: 8 },
});
