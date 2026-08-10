import { Feather } from "@expo/vector-icons";
import React from "react";
import { StyleSheet, Text, View } from "react-native";

import { Colors } from "@/constants/colors";
import { Space } from "@/constants/layout";
import { Typography } from "@/constants/typography";

export interface DashboardMetric {
  label: string;
  value: string | number;
  trend?: number | null;
  trendLabel?: string;
  accent?: boolean;
}

export function MetricDashboard({ metrics }: { metrics: DashboardMetric[] }) {
  return (
    <View style={styles.wrap}>
      <View style={styles.grid}>
        {metrics.slice(0, 6).map((metric, index) => {
          const positive = (metric.trend ?? 0) > 0;
          const negative = (metric.trend ?? 0) < 0;
          return (
            <View
              key={metric.label}
              style={[
                styles.cell,
                index % 3 !== 2 && styles.rightBorder,
                index < 3 && styles.bottomBorder,
              ]}
            >
              <Text style={[styles.value, metric.accent && styles.accentValue]}>
                {metric.value}
              </Text>
              <Text numberOfLines={1} style={styles.label}>{metric.label}</Text>
              <View style={styles.trendSlot}>
                {metric.trend != null ? <View style={styles.trend}>
                  <Feather
                    color={positive ? Colors.win : negative ? Colors.loss : Colors.muted}
                    name={positive ? "trending-up" : negative ? "trending-down" : "minus"}
                    size={10}
                  />
                  <Text
                    style={[
                      styles.trendValue,
                      positive && styles.positive,
                      negative && styles.negative,
                    ]}
                  >
                    {Math.abs(metric.trend)}% {metric.trendLabel ?? "VS PRIOR"}
                  </Text>
                </View> : null}
              </View>
            </View>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { paddingVertical: Space.sm },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    borderTopWidth: StyleSheet.hairlineWidth,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.border,
    backgroundColor: Colors.surface,
  },
  cell: {
    width: "33.3333%",
    minHeight: 84,
    paddingHorizontal: Space.sm,
    paddingVertical: Space.md,
    alignItems: "center",
    justifyContent: "center",
  },
  rightBorder: { borderRightWidth: StyleSheet.hairlineWidth, borderRightColor: Colors.border },
  bottomBorder: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: Colors.border },
  value: {
    fontFamily: Typography.heading,
    fontSize: 24,
    lineHeight: 27,
    color: Colors.text,
  },
  accentValue: { color: Colors.accent },
  label: {
    marginTop: 3,
    fontFamily: Typography.bodyBold,
    fontSize: 7,
    color: Colors.muted,
    letterSpacing: 1,
    textTransform: "uppercase",
  },
  trend: { marginTop: 4, flexDirection: "row", alignItems: "center", gap: 3 },
  trendSlot: { minHeight: 16, justifyContent: "center" },
  trendValue: {
    fontFamily: Typography.bodyMedium,
    fontSize: 6,
    color: Colors.muted,
    letterSpacing: 0.45,
  },
  positive: { color: Colors.win },
  negative: { color: Colors.loss },
});
