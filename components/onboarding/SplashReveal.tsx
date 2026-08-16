import React, { useEffect, useRef } from "react";
import { Animated, Easing, Image, StyleSheet } from "react-native";

import { Colors } from "@/constants/colors";
import { useReducedMotion } from "@/hooks/useReducedMotion";

import {
  SIGNED_IN_TOTAL_MS,
  SIGNED_OUT_TOTAL_MS,
  type SplashMode,
} from "./splashTimeline";

const ARTWORK = require("@/assets/brand/splash-artwork.png");

// A single cinematic fade of the mark, centered — no morph stages, no lift,
// no separate wordmark choreography. Signed-in is a quicker beat than
// signed-out; both are otherwise the same treatment.
export function SplashReveal({
  mode,
  onDone,
}: {
  mode: SplashMode;
  onDone: () => void;
}) {
  const reducedMotion = useReducedMotion();
  const artwork = useRef(new Animated.Value(reducedMotion ? 1 : 0)).current;
  const veil = useRef(new Animated.Value(1)).current;
  const total = mode === "signed-in" ? SIGNED_IN_TOTAL_MS : SIGNED_OUT_TOTAL_MS;

  useEffect(() => {
    if (reducedMotion === null) return;
    if (reducedMotion) {
      artwork.setValue(1);
      const timer = setTimeout(onDone, 80);
      return () => clearTimeout(timer);
    }

    Animated.timing(artwork, {
      duration: 620,
      easing: Easing.out(Easing.cubic),
      toValue: 1,
      useNativeDriver: true,
    }).start();

    Animated.sequence([
      Animated.delay(total - 180),
      Animated.timing(veil, {
        duration: 160,
        toValue: 0,
        useNativeDriver: true,
      }),
    ]).start();

    const timer = setTimeout(onDone, total);
    return () => {
      clearTimeout(timer);
      artwork.stopAnimation();
      veil.stopAnimation();
    };
  }, [artwork, mode, onDone, reducedMotion, total, veil]);

  return (
    <Animated.View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[styles.overlay, { opacity: veil }]}
    >
      <Animated.View style={{ opacity: artwork }}>
        <Image resizeMode="contain" source={ARTWORK} style={styles.mark} />
      </Animated.View>
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
  mark: {
    width: 220,
    height: 220,
  },
});
