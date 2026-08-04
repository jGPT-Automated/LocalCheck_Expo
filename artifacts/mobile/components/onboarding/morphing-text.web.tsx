import React from "react";
import { Text, View } from "react-native";

import { Typography } from "@/constants/typography";

export interface MorphingTextProps {
  text: string;
  width: number;
  height: number;
  color: string;
  fontSize?: number;
  fontSource?: unknown;
  fallbackFontFamily?: string;
  fitTexts?: readonly string[];
  staggerMs?: number;
  blurMax?: number;
}

/**
 * Web stand-in for the Skia morphing text.
 *
 * The real block draws every glyph as its own Skia `Group` so it can carry a
 * true Gaussian blur — that is the entire reason it uses Skia rather than
 * animated text views. Skia on web needs the CanvasKit WASM bundle, which the
 * repeatable export preview (`script/start_local_preview.sh`) does not ship, so
 * web renders the string plainly. The morph is verified on a device, which is
 * what the block's own workflow requires.
 */
export function MorphingText({
  text,
  width,
  height,
  color,
  fontSize = 32,
  fallbackFontFamily,
}: MorphingTextProps) {
  return (
    <View
      style={{ width, height, alignItems: "center", justifyContent: "center" }}
    >
      <Text
        numberOfLines={1}
        style={{
          color,
          fontSize,
          fontFamily: fallbackFontFamily ?? Typography.heading,
          letterSpacing: 2,
        }}
      >
        {text}
      </Text>
    </View>
  );
}
