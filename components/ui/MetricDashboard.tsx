import { Feather } from "@expo/vector-icons";
import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import Animated, {
  Extrapolation,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";

import { Colors } from "@/constants/colors";
import { Motion, Space } from "@/constants/layout";
import { TextStyles } from "@/constants/typography";
import { useReducedMotion } from "@/hooks/useReducedMotion";

export interface DashboardMetric {
  label: string;
  value: string | number;
  trend?: number | null;
  trendLabel?: string;
  accent?: boolean;
}

export function MetricDashboard({ metrics }: { metrics: DashboardMetric[] }) {
  return (
    <View style={styles.grid}>
      {metrics.slice(0, 6).map((metric, index) => (
        <MetricCell index={index} key={metric.label} metric={metric} />
      ))}
    </View>
  );
}

function MetricCell({ metric, index }: { metric: DashboardMetric; index: number }) {
  const reducedMotion = useReducedMotion() === true;
  const [expanded, setExpanded] = React.useState(false);
  const progress = useSharedValue(0);
  const hasTrend = metric.trend != null;
  const positive = (metric.trend ?? 0) > 0;
  const negative = (metric.trend ?? 0) < 0;
  const direction = positive ? "up" : negative ? "down" : "unchanged";
  const period = expandedPeriod(metric.trendLabel);

  React.useEffect(() => {
    progress.value = withTiming(expanded ? 1 : 0, {
      duration: reducedMotion ? Motion.fast : Motion.standard,
    });
  }, [expanded, progress, reducedMotion]);

  const frontStyle = useAnimatedStyle(() => {
    const rotation = interpolate(progress.value, [0, 1], [0, 180], Extrapolation.CLAMP);
    return {
      opacity: reducedMotion
        ? 1 - progress.value
        : interpolate(progress.value, [0, 0.49, 0.5], [1, 1, 0], Extrapolation.CLAMP),
      transform: reducedMotion
        ? []
        : [{ perspective: 800 }, { rotateY: `${rotation}deg` }],
    };
  });

  const backStyle = useAnimatedStyle(() => {
    const rotation = interpolate(progress.value, [0, 1], [-180, 0], Extrapolation.CLAMP);
    return {
      opacity: reducedMotion
        ? progress.value
        : interpolate(progress.value, [0.49, 0.5, 1], [0, 1, 1], Extrapolation.CLAMP),
      transform: reducedMotion
        ? []
        : [{ perspective: 800 }, { rotateY: `${rotation}deg` }],
    };
  });

  const cellStyles = [
    styles.cell,
    index % 3 !== 2 && styles.rightBorder,
    index < 3 && styles.bottomBorder,
  ];

  if (!hasTrend) {
    return (
      <View style={cellStyles}>
        <MetricPrimary metric={metric} />
      </View>
    );
  }

  const trendSummary = `${direction} ${Math.abs(metric.trend ?? 0)} percent versus the prior ${period.toLowerCase()}`;

  return (
    <Pressable
      accessibilityHint={expanded ? "Shows the court metric" : "Shows trend details"}
      accessibilityLabel={`${metric.label}, ${metric.value}. Trend ${trendSummary}.`}
      accessibilityRole="button"
      accessibilityState={{ expanded }}
      onPress={() => setExpanded((current) => !current)}
      style={({ pressed }) => [cellStyles, pressed && styles.pressed]}
    >
      <Animated.View pointerEvents="none" style={[styles.face, frontStyle]}>
        <MetricPrimary metric={metric} />
        <CornerTrend negative={negative} positive={positive} />
      </Animated.View>
      <Animated.View
        pointerEvents="none"
        style={[
          styles.face,
          styles.backFace,
          positive && styles.positiveBack,
          negative && styles.negativeBack,
          backStyle,
        ]}
      >
        <View style={styles.trendHeadline}>
          <Feather
            color={positive ? Colors.win : negative ? Colors.loss : Colors.textSecondary}
            name={positive ? "trending-up" : negative ? "trending-down" : "minus"}
            size={17}
          />
          <Text style={[styles.trendValue, positive && styles.positive, negative && styles.negative]}>
            {positive ? "UP" : negative ? "DOWN" : "NO CHANGE"} {Math.abs(metric.trend ?? 0)}%
          </Text>
        </View>
        <Text style={styles.trendPeriod}>VS PRIOR {period}</Text>
        <Text style={styles.tapHint}>TAP TO RETURN</Text>
      </Animated.View>
    </Pressable>
  );
}

function MetricPrimary({ metric }: { metric: DashboardMetric }) {
  return (
    <View style={styles.metricContent}>
      <Text style={[styles.value, metric.accent && styles.accentValue]}>{metric.value}</Text>
      <Text numberOfLines={1} style={styles.label}>{metric.label}</Text>
    </View>
  );
}

function CornerTrend({ positive, negative }: { positive: boolean; negative: boolean }) {
  const color = positive ? Colors.win : negative ? Colors.loss : Colors.textSecondary;
  return (
    <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={styles.cornerFlag}>
      <View style={[styles.cornerTriangle, { borderTopColor: color }]} />
      <Feather
        color={Colors.background}
        name={positive ? "trending-up" : negative ? "trending-down" : "minus"}
        size={11}
        style={styles.cornerIcon}
      />
    </View>
  );
}

function expandedPeriod(value?: string) {
  if (!value) return "PERIOD";
  const match = value.match(/^(\d+)D$/i);
  if (!match) return value.toUpperCase();
  return `${match[1]} ${match[1] === "1" ? "DAY" : "DAYS"}`;
}

const styles = StyleSheet.create({
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    borderTopWidth: StyleSheet.hairlineWidth,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.border,
    backgroundColor: Colors.surface,
  },
  cell: {
    position: "relative",
    width: "33.3333%",
    minHeight: 104,
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
  },
  face: {
    ...StyleSheet.absoluteFillObject,
    paddingHorizontal: Space.sm,
    paddingVertical: Space.md,
    alignItems: "center",
    justifyContent: "center",
    backfaceVisibility: "hidden",
  },
  backFace: { backgroundColor: Colors.surfaceHigh },
  positiveBack: { backgroundColor: Colors.winDim },
  negativeBack: { backgroundColor: Colors.lossDim },
  pressed: { backgroundColor: Colors.surfacePressed },
  metricContent: { alignItems: "center", justifyContent: "center" },
  rightBorder: { borderRightWidth: StyleSheet.hairlineWidth, borderRightColor: Colors.border },
  bottomBorder: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: Colors.border },
  value: { ...TextStyles.metric, color: Colors.text },
  accentValue: { color: Colors.accent },
  label: {
    ...TextStyles.labelSmall,
    marginTop: Space.xs,
    color: Colors.muted,
    letterSpacing: 0.35,
    textTransform: "uppercase",
  },
  cornerFlag: {
    position: "absolute",
    top: 0,
    right: 0,
    width: 32,
    height: 32,
  },
  cornerTriangle: {
    position: "absolute",
    top: 0,
    right: 0,
    width: 0,
    height: 0,
    borderTopWidth: 32,
    borderLeftWidth: 32,
    borderLeftColor: "transparent",
  },
  cornerIcon: { position: "absolute", top: 4, right: 3 },
  trendHeadline: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: Space.xs },
  trendValue: { ...TextStyles.statSmall, color: Colors.textSecondary },
  trendPeriod: {
    ...TextStyles.labelSmall,
    marginTop: Space.xs,
    color: Colors.textSecondary,
    letterSpacing: 0.35,
  },
  tapHint: {
    ...TextStyles.labelSmall,
    marginTop: Space.sm,
    color: Colors.muted,
    letterSpacing: 0.5,
  },
  positive: { color: Colors.win },
  negative: { color: Colors.loss },
});
