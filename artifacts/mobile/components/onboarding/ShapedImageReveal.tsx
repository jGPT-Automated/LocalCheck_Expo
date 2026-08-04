import {
  Canvas,
  Fill,
  ImageShader,
  rect,
  Shader,
  useImage,
} from "@shopify/react-native-skia";
// expo-image per
// .agents/skills/vercel-react-native-skills/rules/ui-expo-image.md (HIGH).
import { Image } from "expo-image";
import React from "react";
import { StyleSheet, View } from "react-native";
import { useDerivedValue, type SharedValue } from "react-native-reanimated";

import {
  getShapedImageShader,
  MAX_SHAPE_SIZE,
  MIN_SHAPE_SIZE,
  REVEAL_SEED,
  REVEAL_SHAPE,
} from "./shapedImageShader";

const ARTWORK = require("@/assets/brand/splash-artwork.png");

export interface ShapedImageRevealProps {
  /** 0 → nothing drawn, 1 → artwork fully resolved. Driven on the UI thread. */
  progress: SharedValue<number>;
  width: number;
  height: number;
}

/**
 * Renders the brand artwork emerging from black through the shaped-image
 * shader. Native only — the `.web.tsx` sibling serves a static fallback
 * because Skia on web needs CanvasKit, which the repeatable web-export
 * preview does not load.
 *
 * The artwork PNG is transparent, so unresolved regions read as the app
 * background rather than a matte.
 */
export function ShapedImageReveal({
  progress,
  width,
  height,
}: ShapedImageRevealProps) {
  const image = useImage(ARTWORK);
  const shader = getShapedImageShader();

  const uniforms = useDerivedValue(() => {
    "worklet";
    return {
      iResolution: [width, height],
      iData: [
        progress.value,
        REVEAL_SHAPE,
        REVEAL_SHAPE,
        REVEAL_SEED,
        REVEAL_SEED,
        // Single-image reveal: there is no outgoing frame to cross-dissolve.
        0,
        MIN_SHAPE_SIZE,
        MAX_SHAPE_SIZE,
      ],
    };
  }, [width, height]);

  // Holding the canvas back until decode completes avoids a one-frame flash of
  // an empty shader on slower devices.
  if (!image) return <View style={StyleSheet.absoluteFill} pointerEvents="none" />;

  // No shader — show the artwork plainly rather than nothing. The reveal is a
  // flourish; the brand image is the content, and it must never depend on a
  // shader compiling.
  if (!shader) {
    return (
      <View style={StyleSheet.absoluteFill} pointerEvents="none">
        <Image source={ARTWORK} style={{ width, height }} contentFit="contain" />
      </View>
    );
  }

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <Canvas style={{ width, height }}>
        <Fill>
          <Shader source={shader} uniforms={uniforms}>
            <ImageShader
              image={image}
              rect={rect(0, 0, width, height)}
              fit="contain"
            />
            <ImageShader
              image={image}
              rect={rect(0, 0, width, height)}
              fit="contain"
            />
          </Shader>
        </Fill>
      </Canvas>
    </View>
  );
}
