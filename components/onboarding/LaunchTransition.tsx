import React, { useEffect, useRef } from "react";
import { StyleSheet } from "react-native";
import Svg, { Polygon, Rect } from "react-native-svg";
import Animated, {
  Easing,
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
  type SharedValue,
} from "react-native-reanimated";

import { Colors } from "@/constants/colors";
import { useReducedMotion } from "@/hooks/useReducedMotion";

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
const VIEWBOX = "0 0 210 202";
const DIM_OPACITY = 0.32;
const STEP_MS = 130;
const MIN_ROTATIONS = 3;
const MIN_LOADING_MS = MIN_ROTATIONS * 4 * STEP_MS; // 1560ms
const RESOLVE_SNAP_MS = 220;
const HOLD_MS = 220;
// Total floor ~2000ms: three full sweeps, then solid, then in — matching
// "1.5 to 2 seconds" end to end, on both the post-sign-in path and the
// already-signed-in cold-open path.

const CORNER_RECTS = [
  // top-left
  [
    { height: 16, width: 65, x: 0, y: 0 },
    { height: 68, width: 16, x: 0, y: 0 },
  ],
  // top-right
  [
    { height: 16, width: 65, x: 145, y: 0 },
    { height: 68, width: 16, x: 194, y: 0 },
  ],
  // bottom-right
  [
    { height: 17, width: 65, x: 145, y: 185 },
    { height: 68, width: 16, x: 194, y: 134 },
  ],
  // bottom-left
  [
    { height: 17, width: 65, x: 0, y: 185 },
    { height: 68, width: 16, x: 0, y: 134 },
  ],
] as const;

function Corner({
  rects,
  intensity,
}: {
  rects: readonly { height: number; width: number; x: number; y: number }[];
  intensity: SharedValue<number>;
}) {
  const style = useAnimatedStyle(() => ({ opacity: intensity.value }));
  return (
    <Animated.View pointerEvents="none" style={[styles.layer, style]}>
      <Svg fill="none" height={MARK_SIZE} viewBox={VIEWBOX} width={MARK_SIZE}>
        {rects.map((r) => (
          <Rect key={`${r.x}-${r.y}`} fill={Colors.white} height={r.height} width={r.width} x={r.x} y={r.y} />
        ))}
      </Svg>
    </Animated.View>
  );
}

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
  const cycleStartedAtRef = useRef<number | null>(null);

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
      if (cycleStartedAtRef.current === null) cycleStartedAtRef.current = Date.now();
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
    const elapsed = cycleStartedAtRef.current === null ? MIN_LOADING_MS : Date.now() - cycleStartedAtRef.current;
    const remaining = Math.max(0, MIN_LOADING_MS - elapsed);

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
        {CORNER_RECTS.map((rects, i) => (
          <Corner key={i} rects={rects} intensity={corners[i]} />
        ))}
        <Animated.View pointerEvents="none" style={styles.layer}>
          <Svg fill="none" height={MARK_SIZE} viewBox={VIEWBOX} width={MARK_SIZE}>
            <Polygon fill={Colors.brandMark} points="45,110 60,96 87,122 155,53 170,67 87,151" />
          </Svg>
        </Animated.View>
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
  layer: {
    position: "absolute",
    width: MARK_SIZE,
    height: MARK_SIZE,
  },
});
