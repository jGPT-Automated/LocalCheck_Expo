import React from "react";
import { StyleSheet, View } from "react-native";
import Animated, {
  useAnimatedStyle,
  type SharedValue,
} from "react-native-reanimated";
import Svg, { G, Path } from "react-native-svg";

import { Colors } from "@/constants/colors";

/**
 * The glyphs the mark cycles through before settling back on the check.
 *
 * Each is a stroked path in the LogoMark's own `0 0 40 40` viewBox with the
 * same 2.6 stroke weight and round caps, so every stage reads as the same mark
 * changing its mind rather than four unrelated icons.
 *
 * Order tells the brand story: a place → a win → a loss → the verdict.
 */
const GLYPHS = [
  // The resting mark, identical to LogoMark's check.
  "M13.5 20.4 18 25l9-9.6",
  // Location pin — "local".
  "M20 29.4c0-5.9 6-7.9 6-12.9a6 6 0 0 0-12 0c0 5 6 7 6 12.9z",
  // W — a win.
  "M12.5 15.6 15.5 25 20 18.9 24.5 25 27.5 15.6",
  // L — a loss.
  "M15.6 14.8v10.4h8.8",
  // Back to the check — "check".
  "M13.5 20.4 18 25l9-9.6",
] as const;

/** How many discrete glyph stages the mark travels through. */
export const MORPH_STAGES = GLYPHS.length;

export interface MorphMarkProps {
  size?: number;
  /**
   * Continuous position through {@link GLYPHS}. Whole numbers rest on a glyph;
   * fractional values cross-fade the neighbouring pair.
   */
  stage: SharedValue<number>;
}

function GlyphLayer({
  d,
  index,
  size,
  stage,
}: {
  d: string;
  index: number;
  size: number;
  stage: SharedValue<number>;
}) {
  const style = useAnimatedStyle(() => {
    "worklet";
    const distance = Math.abs(stage.value - index);
    const presence = Math.max(0, Math.min(1, 1 - distance));
    return {
      opacity: presence,
      transform: [
        // Outgoing glyphs shrink and rotate away; the incoming one settles
        // upright. This is the icon-swap feel, not a geometry morph — the
        // reference (transitions.dev) drives it the same way, with transform
        // and opacity rather than path interpolation.
        { scale: 0.82 + presence * 0.18 },
        { rotate: `${(stage.value - index) * -14}deg` },
      ],
    };
  }, [index]);

  return (
    <Animated.View style={[StyleSheet.absoluteFill, style]} pointerEvents="none">
      <Svg width={size} height={size} viewBox="0 0 40 40" fill="none">
        <Path
          d={d}
          stroke={Colors.accent}
          strokeWidth={2.6}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </Svg>
    </Animated.View>
  );
}

/**
 * The LocalCheck mark with a swappable inner glyph.
 *
 * The four corner brackets are the fixed part of the identity and never move.
 * Only the accent glyph inside them changes, which is what makes the reveal
 * land as one mark transforming.
 */
export function MorphMark({ size = 72, stage }: MorphMarkProps) {
  return (
    <View style={{ width: size, height: size }}>
      <Svg
        width={size}
        height={size}
        viewBox="0 0 40 40"
        fill="none"
        accessible
        accessibilityLabel="LocalCheck"
      >
        <G
          stroke={Colors.text}
          strokeWidth={1.6}
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <Path d="M13 4H4v9" />
          <Path d="M27 4h9v9" />
          <Path d="M36 27v9h-9" />
          <Path d="M4 27v9h9" />
        </G>
      </Svg>
      {GLYPHS.map((d, index) => (
        <GlyphLayer
          key={index}
          d={d}
          index={index}
          size={size}
          stage={stage}
        />
      ))}
    </View>
  );
}
