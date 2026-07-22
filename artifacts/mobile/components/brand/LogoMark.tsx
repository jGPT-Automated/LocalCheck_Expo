import React from "react";
import { Image, ImageStyle, StyleProp } from "react-native";

/**
 * THE LocalCheck logo mark — the single place the in-app logo comes from.
 *
 * To swap the logo app-wide: replace `assets/brand/logo-mark.png` (editable
 * vector source lives next to it at `assets/brand/logo-mark.svg`). Nothing
 * else in the app should ever require the logo file directly — always render
 * <LogoMark />. The native app icon + splash are separate build assets
 * (`assets/images/icon.png`, `assets/images/splash-icon.png`) and need a
 * tagged full build (not OTA) to change — see DESIGN.md §Brand assets.
 */
const MARK = require("@/assets/brand/logo-mark.png");

export function LogoMark({
  size = 64,
  style,
}: {
  size?: number;
  style?: StyleProp<ImageStyle>;
}) {
  return (
    <Image
      source={MARK}
      style={[{ width: size, height: size }, style]}
      resizeMode="contain"
      accessibilityLabel="LocalCheck"
    />
  );
}
