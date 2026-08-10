import React, { useEffect, useMemo, useRef } from "react";
import {
  Animated,
  Easing,
  Image,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from "react-native";
import Svg, { G, Path } from "react-native-svg";

import { Colors } from "@/constants/colors";
import { Typography } from "@/constants/typography";
import { useReducedMotion } from "@/hooks/useReducedMotion";

import {
  SIGNED_IN_TOTAL_MS,
  SIGNED_OUT_TOTAL_MS,
  type SplashMode,
} from "./splashTimeline";

const ARTWORK = require("@/assets/brand/splash-artwork.png");

// These are the approved mark paths from PR25's MorphMark, reduced to the
// release sequence: a place, a win, then the LocalCheck verdict.
const GLYPHS = [
  "M20 29.4c0-5.9 6-7.9 6-12.9a6 6 0 0 0-12 0c0 5 6 7 6 12.9z",
  "M12.5 15.6 15.5 25 20 18.9 24.5 25 27.5 15.6",
  "M13.5 20.4 18 25l9-9.6",
] as const;

function LaunchMark({ size, stage }: { size: number; stage: Animated.Value }) {
  return (
    <View style={{ width: size, height: size }}>
      <Svg
        fill="none"
        height={size}
        viewBox="0 0 40 40"
        width={size}
      >
        <G
          stroke={Colors.text}
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={1.6}
        >
          <Path d="M13 4H4v9" />
          <Path d="M27 4h9v9" />
          <Path d="M36 27v9h-9" />
          <Path d="M4 27v9h9" />
        </G>
      </Svg>

      {GLYPHS.map((path, index) => {
        const inputRange =
          index === 0
            ? [0, 0.5]
            : index === GLYPHS.length - 1
              ? [1.5, 2]
              : [0.5, 1, 1.5];
        const outputRange =
          index === 0 ? [1, 0] : index === GLYPHS.length - 1 ? [0, 1] : [0, 1, 0];
        const opacity = stage.interpolate({
          inputRange,
          outputRange,
          extrapolate: "clamp",
        });
        const scale = opacity.interpolate({
          inputRange: [0, 1],
          outputRange: [0.82, 1],
        });

        return (
          <Animated.View
            key={path}
            style={[
              StyleSheet.absoluteFill,
              { opacity, pointerEvents: "none", transform: [{ scale }] },
            ]}
          >
            <Svg fill="none" height={size} viewBox="0 0 40 40" width={size}>
              <Path
                d={path}
                stroke={Colors.accent}
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2.6}
              />
            </Svg>
          </Animated.View>
        );
      })}
    </View>
  );
}

export function SplashReveal({
  mode,
  onDone,
}: {
  mode: SplashMode;
  onDone: () => void;
}) {
  const { height } = useWindowDimensions();
  const reducedMotion = useReducedMotion();
  const stage = useRef(new Animated.Value(reducedMotion ? 2 : 0)).current;
  const artwork = useRef(new Animated.Value(reducedMotion ? 1 : 0)).current;
  const lift = useRef(new Animated.Value(reducedMotion ? 1 : 0)).current;
  const veil = useRef(new Animated.Value(1)).current;
  const total = mode === "signed-in" ? SIGNED_IN_TOTAL_MS : SIGNED_OUT_TOTAL_MS;

  useEffect(() => {
    if (reducedMotion === null) return;
    if (reducedMotion) {
      stage.setValue(2);
      artwork.setValue(1);
      lift.setValue(1);
      const timer = setTimeout(onDone, 80);
      return () => clearTimeout(timer);
    }

    const animations = [
      Animated.timing(stage, {
        duration: 1_080,
        easing: Easing.inOut(Easing.cubic),
        toValue: 2,
        useNativeDriver: true,
      }),
    ];

    if (mode === "signed-out") {
      animations.push(
        Animated.timing(artwork, {
          duration: 2_000,
          easing: Easing.out(Easing.cubic),
          toValue: 1,
          useNativeDriver: true,
        }),
      );
      Animated.sequence([
        Animated.delay(2_050),
        Animated.timing(lift, {
          duration: 600,
          easing: Easing.out(Easing.cubic),
          toValue: 1,
          useNativeDriver: true,
        }),
      ]).start();
    }

    Animated.parallel(animations).start();
    Animated.sequence([
      Animated.delay(total - 280),
      Animated.timing(veil, {
        duration: 260,
        toValue: 0,
        useNativeDriver: true,
      }),
    ]).start();

    const timer = setTimeout(onDone, total);
    return () => {
      clearTimeout(timer);
      stage.stopAnimation();
      artwork.stopAnimation();
      lift.stopAnimation();
      veil.stopAnimation();
    };
  }, [artwork, lift, mode, onDone, reducedMotion, stage, total, veil]);

  const markSize = mode === "signed-in" ? 84 : 52;
  const centredTop = height / 2 - markSize / 2;
  const liftDistance = useMemo(
    () => (mode === "signed-out" ? centredTop - 64 : 0),
    [centredTop, mode],
  );

  return (
    <Animated.View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[styles.overlay, { opacity: veil }]}
    >
      {mode === "signed-out" && (
        <Animated.View
          style={[
            styles.artwork,
            {
              opacity: artwork,
              transform: [
                {
                  scale: artwork.interpolate({
                    inputRange: [0, 1],
                    outputRange: [1.055, 1],
                  }),
                },
              ],
            },
          ]}
        >
          <Image resizeMode="contain" source={ARTWORK} style={styles.artworkImage} />
        </Animated.View>
      )}

      <Animated.View
        style={[
          styles.lockup,
          {
            top: centredTop,
            transform: [
              {
                translateY: lift.interpolate({
                  inputRange: [0, 1],
                  outputRange: [0, -liftDistance],
                }),
              },
            ],
          },
        ]}
      >
        <LaunchMark size={markSize} stage={stage} />
        {mode === "signed-out" && <Text style={styles.wordmark}>LOCALCHECK</Text>}
      </Animated.View>
      {mode === "signed-in" && <Text style={styles.signedInLabel}>LOCALCHECK</Text>}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    backgroundColor: Colors.background,
    justifyContent: "center",
    pointerEvents: "none",
    zIndex: 100,
  },
  artwork: {
    ...StyleSheet.absoluteFillObject,
    opacity: 0.9,
  },
  artworkImage: {
    height: "100%",
    width: "100%",
  },
  lockup: {
    alignItems: "center",
    flexDirection: "row",
    gap: 12,
    position: "absolute",
  },
  wordmark: {
    color: Colors.text,
    fontFamily: Typography.heading,
    fontSize: 32,
    letterSpacing: 1.8,
  },
  signedInLabel: {
    color: Colors.muted,
    fontFamily: Typography.bodyMedium,
    fontSize: 10,
    letterSpacing: 3.2,
    marginTop: 116,
  },
});
