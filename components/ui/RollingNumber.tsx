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
 * `rollOnMount={false}` makes the first render static: opening a screen does
 * not animate its content. Only a value that changes afterwards (the user hid
 * the score, a revision landed) rolls into place.
 *
 * `style` must set fontSize and lineHeight; lineHeight is the digit window.
 */
export function RollingNumber({
  value,
  style,
  delay = 120,
  rollOnMount = true,
}: {
  value: number | string;
  style: TextStyle | TextStyle[];
  delay?: number;
  rollOnMount?: boolean;
}) {
  const flat = StyleSheet.flatten(style) as TextStyle;
  const height = flat.lineHeight ?? (flat.fontSize ?? 16) * 1.2;
  const chars = String(value).split("");
  // False while the first render commits, true for every render after it, so a
  // digit or letter that mounts later (the value changed) still animates in.
  const settled = React.useRef(false);
  const animateIn = rollOnMount || settled.current;
  useEffect(() => {
    settled.current = true;
  }, []);
  return (
    <View accessibilityLabel={String(value)} accessible style={styles.row}>
      {chars.map((char, index) =>
        /\d/.test(char) ? (
          <Digit
            animateIn={animateIn}
            delay={delay + (chars.length - 1 - index) * 60}
            digit={Number(char)}
            height={height}
            key={`${index}-${chars.length}`}
            style={flat}
          />
        ) : /[A-Za-z]/.test(char) ? (
          <Glyph animateIn={animateIn} char={char} delay={delay} height={height} key={`${index}-${char}`} style={flat} />
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
  animateIn,
}: {
  digit: number;
  height: number;
  style: TextStyle;
  delay: number;
  animateIn: boolean;
}) {
  const reduced = useReducedMotion();
  const offset = useSharedValue(reduced || !animateIn ? -height * digit : 0);
  const first = React.useRef(true);

  useEffect(() => {
    const target = -height * digit;
    const isFirst = first.current;
    first.current = false;
    if (reduced || (isFirst && !animateIn)) {
      offset.set(target);
      return;
    }
    offset.set(withDelay(delay, withSpring(target, { duration: 900, dampingRatio: 0.9 })));
    // animateIn only matters for the first run; it is not a trigger.
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
  animateIn,
}: {
  char: string;
  height: number;
  style: TextStyle;
  delay: number;
  animateIn: boolean;
}) {
  const reduced = useReducedMotion();
  const offset = useSharedValue(reduced || !animateIn ? 0 : height);

  useEffect(() => {
    if (reduced || !animateIn) {
      offset.set(0);
      return;
    }
    offset.set(withDelay(delay, withSpring(0, { duration: 700, dampingRatio: 0.9 })));
    // Runs once per glyph: a new letter remounts this component.
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
