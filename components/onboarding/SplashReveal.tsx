import React, { useEffect, useRef } from "react";
import { Animated, Easing, Image, StyleSheet } from "react-native";

import { LogoMark } from "@/components/brand/LogoMark";
import { Colors } from "@/constants/colors";
import { useReducedMotion } from "@/hooks/useReducedMotion";

import {
  SIGNED_IN_TOTAL_MS,
  SIGNED_OUT_TOTAL_MS,
  type SplashMode,
} from "./splashTimeline";

const ARTWORK = require("@/assets/brand/splash-artwork.png");

// Standard splash composition: a static brand backdrop with one mark
// animating on top of it — not a sequence of separate full-screen moments.
// Signed-out shows the artwork as an immediate, unanimated background (it
// never appears without the mark); signed-in has no artwork, matching the
// quicker returning-user beat. Either way, the LogoMark fade-in is the only
// thing that animates — no morph stages, no lift, no separate wordmark.
export function SplashReveal({
  mode,
  onDone,
}: {
  mode: SplashMode;
  onDone: () => void;
}) {
  const reducedMotion = useReducedMotion();
  const mark = useRef(new Animated.Value(reducedMotion ? 1 : 0)).current;
  const veil = useRef(new Animated.Value(1)).current;
  const total = mode === "signed-in" ? SIGNED_IN_TOTAL_MS : SIGNED_OUT_TOTAL_MS;

  useEffect(() => {
    if (reducedMotion === null) return;
    if (reducedMotion) {
      mark.setValue(1);
      const timer = setTimeout(onDone, 80);
      return () => clearTimeout(timer);
    }

    Animated.timing(mark, {
      duration: 480,
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
      mark.stopAnimation();
      veil.stopAnimation();
    };
  }, [mark, onDone, reducedMotion, total, veil]);

  return (
    <Animated.View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[styles.overlay, { opacity: veil }]}
    >
      {mode === "signed-out" && (
        <Image resizeMode="contain" source={ARTWORK} style={styles.artwork} />
      )}
      <Animated.View style={{ opacity: mark }}>
        <LogoMark size={mode === "signed-in" ? 84 : 64} />
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
  // Present from the first frame, never separately animated — the mark is
  // the only thing that fades. "contain" so the full illustration shows,
  // never cropped, at its native 1024x1536 aspect ratio.
  artwork: {
    ...StyleSheet.absoluteFillObject,
    width: "100%",
    height: "100%",
  },
});
