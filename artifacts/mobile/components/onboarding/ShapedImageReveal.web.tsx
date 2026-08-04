// expo-image per
// .agents/skills/vercel-react-native-skills/rules/ui-expo-image.md (HIGH).
import { Image } from "expo-image";
import React from "react";
import { StyleSheet, View } from "react-native";
import Animated, {
  useAnimatedStyle,
  type SharedValue,
} from "react-native-reanimated";

const ARTWORK = require("@/assets/brand/splash-artwork.png");

export interface ShapedImageRevealProps {
  progress: SharedValue<number>;
  width: number;
  height: number;
}

/**
 * Web stand-in for the Skia reveal.
 *
 * Skia on web requires the CanvasKit WASM bundle, which the repeatable
 * export-and-serve preview (`script/start_local_preview.sh`) does not ship.
 * Rather than break the browser preview for every other screen, web fades and
 * scales the same artwork on the same timeline. The shaped reveal itself is
 * verified on a mobile runtime, per the block's own workflow.
 */
export function ShapedImageReveal({
  progress,
  width,
  height,
}: ShapedImageRevealProps) {
  const style = useAnimatedStyle(() => ({
    opacity: progress.value,
    transform: [{ scale: 1.06 - progress.value * 0.06 }],
  }));

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <Animated.View style={[{ width, height }, style]}>
        <Image
          source={ARTWORK}
          style={{ width, height }}
          contentFit="contain"
        />
      </Animated.View>
    </View>
  );
}
