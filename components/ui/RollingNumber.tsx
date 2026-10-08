import React, { useEffect } from "react";
import { StyleSheet, Text, type TextStyle, View } from "react-native";
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withSpring,
} from "react-native-reanimated";

/**
 * A score that rolls into place digit by digit (odometer), instead of popping
 * in. Pure transform animation, so it stays smooth while the screen loads.
 * Letters ("W" / "L" for a hidden score) rise into the same window, so a
 * score flipping to W / L moves like the digits do. Reduce Motion: no roll.
 *
 * `style` must set fontSize and lineHeight; lineHeight is the digit window.
 */
export function RollingNumber({
  value,
  style,
  delay = 120,
}: {
  value: number | string;
  style: TextStyle | TextStyle[];
  delay?: number;
}) {
  const flat = StyleSheet.flatten(style) as TextStyle;
  const height = flat.lineHeight ?? (flat.fontSize ?? 16) * 1.2;
  const chars = String(value).split("");
  return (
    <View accessibilityLabel={String(value)} accessible style={styles.row}>
      {chars.map((char, index) =>
        /\d/.test(char) ? (
          <Digit
            delay={delay + (chars.length - 1 - index) * 60}
            digit={Number(char)}
            height={height}
            key={`${index}-${chars.length}`}
            style={flat}
          />
        ) : /[A-Za-z]/.test(char) ? (
          <Glyph char={char} delay={delay} height={height} key={`${index}-${char}`} style={flat} />
        ) : (
          <Text key={`${index}-${char}`} style={flat}>
            {char}
          </Text>
        ),
      )}
    </View>
  );
}

function Digit({
  digit,
  height,
  style,
  delay,
}: {
  digit: number;
  height: number;
  style: TextStyle;
  delay: number;
}) {
  const reduced = useReducedMotion();
  const offset = useSharedValue(reduced ? -height * digit : 0);

  useEffect(() => {
    const target = -height * digit;
    if (reduced) {
      offset.set(target);
      return;
    }
    offset.set(withDelay(delay, withSpring(target, { duration: 900, dampingRatio: 0.9 })));
  }, [digit, height, delay, reduced, offset]);

  const columnStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: offset.get() }],
  }));

  return (
    <View style={{ height, overflow: "hidden" }}>
      {/* Sizes the window to the final digit's real width. */}
      <Text style={[style, styles.ghost]}>{digit}</Text>
      <Animated.View style={[styles.column, columnStyle]}>
        {DIGITS.map((d) => (
          <Text key={d} style={[style, styles.cell, { height }]}>
            {d}
          </Text>
        ))}
      </Animated.View>
    </View>
  );
}

/** A letter that rises into its window from below, on the digits' spring. */
function Glyph({
  char,
  height,
  style,
  delay,
}: {
  char: string;
  height: number;
  style: TextStyle;
  delay: number;
}) {
  const reduced = useReducedMotion();
  const offset = useSharedValue(reduced ? 0 : height);

  useEffect(() => {
    if (reduced) {
      offset.set(0);
      return;
    }
    offset.set(withDelay(delay, withSpring(0, { duration: 700, dampingRatio: 0.9 })));
  }, [delay, reduced, offset]);

  const glyphStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: offset.get() }],
  }));

  return (
    <View style={{ height, overflow: "hidden" }}>
      <Animated.Text style={[style, glyphStyle]}>{char}</Animated.Text>
    </View>
  );
}

const DIGITS = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9];

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "flex-start" },
  ghost: { opacity: 0 },
  column: { position: "absolute", top: 0, left: -20, right: -20 },
  cell: { textAlign: "center" },
});
