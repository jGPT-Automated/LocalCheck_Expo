import {
  Canvas,
  Fill,
  ImageShader,
  rect,
  Shader,
  useImage,
} from "@shopify/react-native-skia";
import React from "react";
import { StyleSheet, View } from "react-native";
import { useDerivedValue, type SharedValue } from "react-native-reanimated";

import {
  MAX_SHAPE_SIZE,
  MIN_SHAPE_SIZE,
  REVEAL_SEED,
  REVEAL_SHAPE,
  shapedImageShader,
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

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <Canvas style={{ width, height }}>
        <Fill>
          <Shader source={shapedImageShader} uniforms={uniforms}>
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
