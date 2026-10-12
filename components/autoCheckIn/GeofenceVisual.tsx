import React from "react";
import { StyleSheet, Text, View } from "react-native";
import Svg, { Circle, Line, Rect } from "react-native-svg";

import { Colors } from "@/constants/colors";
import { Space } from "@/constants/layout";
import { TextStyles } from "@/constants/typography";
import { AUTO_CHECK_IN_RADIUS_M } from "@/lib/autoCheckInModel";

const W = 280;
const H = 132;

/**
 * The circle auto check-in watches (D48): the court in the middle, the 150 m
 * ring around it, and the label under it. Drawn, not a map, so it reads the
 * same everywhere and costs nothing to show.
 */
export function GeofenceVisual({ courtName }: { courtName: string }) {
  const cx = W / 2;
  const cy = H / 2;
  return (
    <View accessibilityLabel={`A ${AUTO_CHECK_IN_RADIUS_M} metre circle around ${courtName}`} style={styles.wrap}>
      <Svg height={H} viewBox={`0 0 ${W} ${H}`} width="100%">
        {/* faint street grid */}
        {[0.2, 0.5, 0.8].map((f) => (
          <Line key={`h${f}`} stroke={Colors.border} strokeWidth={1} x1={0} x2={W} y1={H * f} y2={H * f} />
        ))}
        {[0.15, 0.38, 0.62, 0.85].map((f) => (
          <Line key={`v${f}`} stroke={Colors.border} strokeWidth={1} x1={W * f} x2={W * f} y1={0} y2={H} />
        ))}
        <Circle cx={cx} cy={cy} fill={Colors.accentGhost} r={56} stroke={Colors.accent} strokeDasharray="5 4" strokeWidth={1.5} />
        {/* the court, to scale: about 28 m against a 150 m ring */}
        <Rect fill={Colors.surfaceHigh} height={7} rx={1} stroke={Colors.textSecondary} strokeWidth={1} width={12} x={cx - 6} y={cy - 3.5} />
        <Line stroke={Colors.textSecondary} strokeWidth={0.75} x1={cx} x2={cx} y1={cy - 3.5} y2={cy + 3.5} />
      </Svg>
      <Text numberOfLines={1} style={styles.caption}>
        {`${AUTO_CHECK_IN_RADIUS_M} m around ${courtName}`}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: "center",
    gap: Space.xs,
    paddingVertical: Space.sm,
    borderRadius: 12,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    overflow: "hidden",
  },
  caption: { ...TextStyles.caption, color: Colors.textSecondary },
});
