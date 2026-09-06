import React from "react";
import { StyleSheet, View } from "react-native";
import Svg, { Path, Polygon, Rect } from "react-native-svg";
import Animated, {
  type SharedValue,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSpring,
  withTiming,
} from "react-native-reanimated";

import { Colors } from "@/constants/colors";
import { useReducedMotion } from "@/hooks/useReducedMotion";

const FULL_LOCKUP_RATIO = 1290 / 202;
const WORDMARK_RATIO = 1022 / 110;
const MARK_VIEWBOX = "0 0 210 202";
const MARK_CHECK_POINTS = "45,110 60,96 87,122 155,53 170,67 87,151";
const MARK_CORNERS = [
  [
    { height: 16, width: 65, x: 0, y: 0 },
    { height: 68, width: 16, x: 0, y: 0 },
  ],
  [
    { height: 16, width: 65, x: 145, y: 0 },
    { height: 68, width: 16, x: 194, y: 0 },
  ],
  [
    { height: 17, width: 65, x: 145, y: 185 },
    { height: 68, width: 16, x: 194, y: 134 },
  ],
  [
    { height: 17, width: 65, x: 0, y: 185 },
    { height: 68, width: 16, x: 0, y: 134 },
  ],
] as const;

function FrameRects({ color = Colors.white }: { color?: string }) {
  return (
    <>
      <Rect fill={color} height="16" width="65" x="0" y="0" />
      <Rect fill={color} height="68" width="16" x="0" y="0" />
      <Rect fill={color} height="16" width="65" x="145" y="0" />
      <Rect fill={color} height="68" width="16" x="194" y="0" />
      <Rect fill={color} height="17" width="65" x="0" y="185" />
      <Rect fill={color} height="68" width="16" x="0" y="134" />
      <Rect fill={color} height="17" width="65" x="145" y="185" />
      <Rect fill={color} height="68" width="16" x="194" y="134" />
    </>
  );
}

function CornerFrame() {
  return (
    <>
      <FrameRects />
      <Polygon fill={Colors.brandMark} points={MARK_CHECK_POINTS} />
    </>
  );
}

/**
 * Brand success mark: the LocalCheck frame fades in, then the check springs
 * up inside it — a premium, on-brand alternative to a Feather "check" for
 * confirmed states. Renders static when `play` is false or reduced motion.
 */
export function BrandCheck({
  size = 88,
  play = true,
  checkColor = Colors.brandMark,
  frameColor = Colors.white,
}: {
  size?: number;
  play?: boolean;
  checkColor?: string;
  frameColor?: string;
}) {
  const reduceMotion = useReducedMotion() === true;
  const animate = play && !reduceMotion;
  const frame = useSharedValue(animate ? 0 : 1);
  const check = useSharedValue(animate ? 0 : 1);

  React.useEffect(() => {
    if (!animate) {
      frame.value = 1;
      check.value = 1;
      return;
    }
    frame.value = withTiming(1, { duration: 240 });
    check.value = withDelay(
      150,
      withSpring(1, { damping: 11, stiffness: 150, mass: 0.7 }),
    );
  }, [animate, check, frame]);

  const frameStyle = useAnimatedStyle(() => ({ opacity: frame.value }));
  const checkStyle = useAnimatedStyle(() => ({
    opacity: check.value,
    transform: [{ scale: 0.5 + check.value * 0.5 }],
  }));

  return (
    <View style={{ height: size, width: size }}>
      <Animated.View
        pointerEvents="none"
        style={[styles.animatedLayer, { height: size, width: size }, frameStyle]}
      >
        <Svg
          accessibilityLabel="Confirmed"
          fill="none"
          height={size}
          viewBox={MARK_VIEWBOX}
          width={size}
        >
          <FrameRects color={frameColor} />
        </Svg>
      </Animated.View>
      <Animated.View
        pointerEvents="none"
        style={[
          styles.animatedLayer,
          styles.checkLayer,
          { height: size, width: size },
          checkStyle,
        ]}
      >
        <Svg fill="none" height={size} viewBox={MARK_VIEWBOX} width={size}>
          <Polygon fill={checkColor} points={MARK_CHECK_POINTS} />
        </Svg>
      </Animated.View>
    </View>
  );
}

function AnimatedCorner({
  intensity,
  rects,
  size,
}: {
  intensity: SharedValue<number>;
  rects: (typeof MARK_CORNERS)[number];
  size: number;
}) {
  const animatedStyle = useAnimatedStyle(() => ({ opacity: intensity.value }));
  return (
    <Animated.View pointerEvents="none" style={[styles.animatedLayer, { height: size, width: size }, animatedStyle]}>
      <Svg fill="none" height={size} viewBox={MARK_VIEWBOX} width={size}>
        {rects.map((rect, i) => (
          <Rect
            key={i}
            fill={Colors.white}
            height={rect.height}
            width={rect.width}
            x={rect.x}
            y={rect.y}
          />
        ))}
      </Svg>
    </Animated.View>
  );
}

/** Canonical animated form of the icon mark used by launch/loading motion. */
export function AnimatedLogoMark({
  cornerIntensities,
  size = 88,
}: {
  cornerIntensities: readonly [SharedValue<number>, SharedValue<number>, SharedValue<number>, SharedValue<number>];
  size?: number;
}) {
  return (
    <View style={{ height: size, width: size }}>
      {MARK_CORNERS.map((rects, index) => (
        <AnimatedCorner key={index} intensity={cornerIntensities[index]} rects={rects} size={size} />
      ))}
      <View pointerEvents="none" style={[styles.animatedLayer, { height: size, width: size }]}>
        <Svg fill="none" height={size} viewBox={MARK_VIEWBOX} width={size}>
          <Polygon fill={Colors.brandMark} points={MARK_CHECK_POINTS} />
        </Svg>
      </View>
    </View>
  );
}

function WordmarkPaths() {
  return (
    <>
      <Rect fill={Colors.white} height="110" width="17" x="268" y="45" />
      <Rect fill={Colors.white} height="17" width="75" x="268" y="138" />
      <Path
        d="M345 99.5a56.5 56.5 0 1 0 113 0 56.5 56.5 0 1 0-113 0Zm17 0a39.5 39.5 0 1 1 79 0 39.5 39.5 0 1 1-79 0Z"
        fill={Colors.white}
        fillRule="evenodd"
      />
      <Path d="M561.387 61.694a53 56.5 0 1 0 0 75.612l-12.634-11.375a36 39.5 0 1 1 0-52.862Z" fill={Colors.white} />
      <Path d="M862.387 61.694a53 56.5 0 1 0 0 75.612l-12.634-11.375a36 39.5 0 1 1 0-52.862Z" fill={Colors.white} />
      <Path d="M1174.515 61.694a52.5 56.5 0 1 0 0 75.612l-12.633-11.375a35.5 39.5 0 1 1 0-52.862Z" fill={Colors.white} />
      <Polygon fill={Colors.white} points="576,155 596,155 629,45 619,45" />
      <Polygon fill={Colors.white} points="662,155 682,155 639,45 629,45" />
      <Rect fill={Colors.white} height="16" width="48" x="605" y="113" />
      <Rect fill={Colors.white} height="110" width="17" x="692" y="45" />
      <Rect fill={Colors.white} height="17" width="75" x="692" y="138" />
      <Rect fill={Colors.white} height="110" width="17" x="888" y="45" />
      <Rect fill={Colors.white} height="110" width="17" x="962" y="45" />
      <Rect fill={Colors.white} height="17" width="91" x="888" y="92" />
      <Rect fill={Colors.white} height="110" width="17" x="995" y="45" />
      <Rect fill={Colors.white} height="17" width="80" x="995" y="45" />
      <Rect fill={Colors.white} height="17" width="70" x="995" y="92" />
      <Rect fill={Colors.white} height="17" width="80" x="995" y="138" />
      <Rect fill={Colors.white} height="110" width="17" x="1199" y="45" />
      <Polygon fill={Colors.white} points="1216,100 1272,45 1290,45 1231,104" />
      <Polygon fill={Colors.white} points="1216,100 1231,96 1290,155 1270,155" />
    </>
  );
}

/** Canonical icon-only mark, sourced from localcheck-logo-final.svg. */
export function LogoMark({
  size = 64,
  variant = "mark",
}: {
  size?: number;
  variant?: "mark" | "back";
}) {
  return (
    <View
      accessibilityElementsHidden={variant === "back"}
      importantForAccessibility={variant === "back" ? "no" : "auto"}
      style={{ height: size, width: size }}
    >
      <Svg
        accessibilityLabel={variant === "mark" ? "LocalCheck" : undefined}
        height={size}
        preserveAspectRatio="xMidYMid meet"
        viewBox={variant === "back" ? "0 0 250 240" : "0 0 210 202"}
        width={size}
      >
        {variant === "back" ? (
          <>
            <Rect fill={Colors.white} height="18" width="76" x="0" y="0" />
            <Rect fill={Colors.white} height="76" width="18" x="0" y="0" />
            <Rect fill={Colors.white} height="18" width="76" x="174" y="0" />
            <Rect fill={Colors.white} height="76" width="18" x="232" y="0" />
            <Rect fill={Colors.white} height="18" width="76" x="0" y="222" />
            <Rect fill={Colors.white} height="76" width="18" x="0" y="164" />
            <Rect fill={Colors.white} height="18" width="76" x="174" y="222" />
            <Rect fill={Colors.white} height="76" width="18" x="232" y="164" />
            <Polygon fill={Colors.brandMark} points="123,59 62,122 125,184 138,170 91,122 138,73" />
          </>
        ) : (
          <CornerFrame />
        )}
      </Svg>
    </View>
  );
}

/** Exact final LocalCheck lockup for every surface that spells the brand name. */
export function LogoLockup({ width = 200 }: { width?: number }) {
  const height = width / FULL_LOCKUP_RATIO;
  return (
    <Svg accessibilityLabel="LocalCheck" height={height} preserveAspectRatio="xMidYMid meet" viewBox="0 0 1290 202" width={width}>
      <CornerFrame />
      <WordmarkPaths />
    </Svg>
  );
}

/** Exact wordmark-only geometry for the existing animated launch mark. */
export function LogoWordmark({ width = 160 }: { width?: number }) {
  const height = width / WORDMARK_RATIO;
  return (
    <Svg accessibilityLabel="LocalCheck" height={height} preserveAspectRatio="xMidYMid meet" viewBox="268 45 1022 110" width={width}>
      <WordmarkPaths />
    </Svg>
  );
}

const styles = StyleSheet.create({
  animatedLayer: { position: "absolute" },
  checkLayer: { alignItems: "center", justifyContent: "center" },
});
