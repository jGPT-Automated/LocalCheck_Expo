import { Feather } from "@expo/vector-icons";
import React from "react";
import { Image, ImageStyle, StyleProp, View } from "react-native";

import { backLogoContainerStyle, backLogoFrameStyle } from "@/components/brand/logoPresentation";
import { Colors } from "@/constants/colors";

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
const FRAME = require("@/assets/brand/logo-frame.png");

export function LogoMark({
  size = 64,
  style,
  variant = "mark",
}: {
  size?: number;
  style?: StyleProp<ImageStyle>;
  variant?: "mark" | "back";
}) {
  if (variant === "back") {
    return (
      <View
        accessibilityElementsHidden
        importantForAccessibility="no"
        style={backLogoContainerStyle(size)}
      >
        <Image resizeMode="contain" source={FRAME} style={backLogoFrameStyle(size)} />
        <Feather color={Colors.text} name="chevron-left" size={Math.round(size * 0.56)} />
      </View>
    );
  }

  return (
    <Image
      source={MARK}
      style={[{ width: size, height: size }, style]}
      resizeMode="contain"
      accessibilityLabel="LocalCheck"
    />
  );
}
