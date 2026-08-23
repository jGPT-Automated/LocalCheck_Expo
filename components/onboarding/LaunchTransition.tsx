import React, { useEffect, useRef } from "react";
import { StyleSheet } from "react-native";
import Animated, {
  Easing,
  cancelAnimation,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from "react-native-reanimated";

import { AnimatedLogoMark } from "@/components/brand/LogoMark";
import { Colors } from "@/constants/colors";
import { useReducedMotion } from "@/hooks/useReducedMotion";
import { remainingLaunchFloor } from "./launchTiming";

// The one loading/launch indicator for the auth journey. This is the exact
// geometry from components/brand/LogoMark.tsx's CornerFrame — the same
// viewBox, the same Rects, the same checkmark Polygon, not a redrawn
// approximation. The mark never moves, scales, or glows. The checkmark
// never animates. The only thing that changes is which corner pair is
// opaque: they sweep clockwise, one at a time, for as long as `loading` is
// true, with a floor of MIN_ROTATIONS full sweeps so the motion is always
// actually visible even if the real work finishes faster. When loading
// resolves (and the floor is satisfied), the sweep stops, all four corners
// snap solid together, held briefly, then onDone fires. Appears once per
// journey: after a sign-in/sign-up/Apple submit, or once on cold open for
// an already-signed-in session — never as a separate pre-form splash.
const MARK_SIZE = 88;
const DIM_OPACITY = 0.32;
const STEP_MS = 130;
const MIN_ROTATIONS = 3;
const MIN_LOADING_MS = MIN_ROTATIONS * 4 * STEP_MS; // 1560ms
const RESOLVE_SNAP_MS = 220;
const HOLD_MS = 220;
// Total floor ~2000ms: three full sweeps, then solid, then in — matching
// "1.5 to 2 seconds" end to end, on both the post-sign-in path and the
// already-signed-in cold-open path.

export function LaunchTransition({
  loading,
  onDone,
}: {
  loading: boolean;
  onDone: () => void;
}) {
  const reducedMotion = useReducedMotion();
  const c0 = useSharedValue(1);
  const c1 = useSharedValue(DIM_OPACITY);
  const c2 = useSharedValue(DIM_OPACITY);
  const c3 = useSharedValue(DIM_OPACITY);
  const corners = [c0, c1, c2, c3];
  const settledRef = useRef(false);
  const cycleStartedAtRef = useRef(Date.now());

  useEffect(() => {
    // Wait for the real (resolved) value. reducedMotion starts null and
    // flips to true/false shortly after mount via an async accessibility
    // check — since this effect is keyed on reducedMotion too, letting it
    // run before that resolves means a second run happens right after,
    // hitting the settledRef guard below and silently never rescheduling
    // onDone.
    if (reducedMotion === null) return;

    if (reducedMotion) {
      corners.forEach((c) => {
        c.value = 1;
      });
      if (!loading && !settledRef.current) {
        settledRef.current = true;
        const t = setTimeout(onDone, 80);
        return () => clearTimeout(t);
      }
      return;
    }

    if (loading) {
      corners.forEach((c, i) => {
        const sequence = [0, 1, 2, 3].map((slot) =>
          withTiming(slot === i ? 1 : DIM_OPACITY, {
            duration: STEP_MS,
            easing: Easing.inOut(Easing.quad),
          }),
        );
        c.value = withRepeat(withSequence(...sequence), -1);
      });
      return () => corners.forEach((c) => cancelAnimation(c));
    }

    // loading is false. If we never actually entered a loading cycle (the
    // already-signed-in cold-open case), resolve immediately. Otherwise
    // finish out the minimum rotation floor before resolving.
    if (settledRef.current) return;
    const remaining = remainingLaunchFloor(cycleStartedAtRef.current, Date.now(), MIN_LOADING_MS);

    const resolveTimer = setTimeout(() => {
      settledRef.current = true;
      corners.forEach((c) => cancelAnimation(c));
      corners.forEach((c) => {
        c.value = withTiming(1, { duration: RESOLVE_SNAP_MS, easing: Easing.out(Easing.cubic) });
      });
      setTimeout(onDone, RESOLVE_SNAP_MS + HOLD_MS);
    }, remaining);

    return () => clearTimeout(resolveTimer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, reducedMotion]);

  return (
    <Animated.View style={styles.overlay}>
      <Animated.View style={styles.mark}>
        <AnimatedLogoMark cornerIntensities={[c0, c1, c2, c3]} size={MARK_SIZE} />
      </Animated.View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: Colors.background,
    zIndex: 100,
  },
  mark: {
    width: MARK_SIZE,
    height: MARK_SIZE,
  },
});
