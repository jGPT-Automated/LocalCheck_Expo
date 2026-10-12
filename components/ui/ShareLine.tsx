import React, { useEffect, useState } from "react";
import { type LayoutChangeEvent, StyleSheet, View } from "react-native";
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";

import { Colors } from "@/constants/colors";
import { Durations, Ease } from "@/constants/motion";

const TRACK = 4;

/**
 * One thin line that shows how two sides split a total (a series record, a
 * game's margin). Two segments: the leading side's share is orange and runs in
 * from that side's end, the rest stays neutral. No marker on the join, so it
 * never reads as a slider. It fills once when it first appears and never
 * again. Reduce Motion: it is simply there.
 *
 * `leftShare` is the left side's fraction of the total (0 to 1). `leader`
 * says which side gets the orange; null (a tie, or nothing yet) leaves the
 * line neutral.
 */
export function ShareLine({
  leftShare,
  leader,
}: {
  leftShare: number;
  leader: "left" | "right" | null;
}) {
  const reduced = useReducedMotion();
  const [width, setWidth] = useState(0);
  const progress = useSharedValue(reduced ? 1 : 0);
  const share = Math.min(1, Math.max(0, leftShare));
  const fillFraction = leader === "left" ? share : leader === "right" ? 1 - share : 0;

  useEffect(() => {
    if (reduced) {
      progress.value = 1;
      return;
    }
    if (width > 0) {
      progress.value = withTiming(1, { duration: Durations.ticker, easing: Ease.out });
    }
    // Runs once: when the line first has a width.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [width > 0, reduced]);

  const onLayout = (event: LayoutChangeEvent) => {
    const next = Math.round(event.nativeEvent.layout.width);
    if (next !== width) setWidth(next);
  };

  // Only transform animates: the fill grows from its end.
  const fillStyle = useAnimatedStyle(() => ({
    transform: [{ scaleX: progress.value }],
  }));

  return (
    <View onLayout={onLayout} style={styles.line}>
      <View style={styles.track} />
      {leader && fillFraction > 0 ? (
        <Animated.View
          style={[
            styles.fill,
            leader === "left"
              ? { left: 0, width: `${fillFraction * 100}%`, transformOrigin: "left center" }
              : { right: 0, width: `${fillFraction * 100}%`, transformOrigin: "right center" },
            fillStyle,
          ]}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  pattern: { height: TRACK, overflow: "hidden" },
  patternRow: { height: TRACK / 2, flexDirection: "row" },
  checker: { width: TRACK / 2, height: TRACK / 2 },
  checkerOn: { backgroundColor: Colors.accentBorder },
  line: { height: TRACK },
  track: {
    height: TRACK,
    borderRadius: TRACK / 2,
    backgroundColor: Colors.borderLight,
  },
  fill: {
    position: "absolute",
    top: 0,
    height: TRACK,
    borderRadius: TRACK / 2,
    backgroundColor: Colors.accent,
  },
});

/**
 * The line's stand-in when a score is hidden (D47): same height and place, a
 * faint orange checker instead of a split, so the card keeps its divide
 * without giving the margin away.
 */
export function PatternLine() {
  const [width, setWidth] = useState(0);
  const cells = Math.max(0, Math.floor(width / CHECKER));
  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      onLayout={(event) => setWidth(Math.round(event.nativeEvent.layout.width))}
      style={styles.pattern}
    >
      {[0, 1].map((row) => (
        <View key={row} style={styles.patternRow}>
          {Array.from({ length: cells }, (_, index) => (
            <View
              key={index}
              style={[styles.checker, (index + row) % 2 === 0 ? styles.checkerOn : null]}
            />
          ))}
        </View>
      ))}
    </View>
  );
}

const CHECKER = TRACK / 2;
