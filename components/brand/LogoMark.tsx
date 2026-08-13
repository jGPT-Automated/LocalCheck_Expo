import { Feather } from "@expo/vector-icons";
import React from "react";
import { StyleProp, View, ViewStyle } from "react-native";
import Svg, { G, Path } from "react-native-svg";

import {
  backLogoContainerStyle,
  backLogoFrameStyle,
} from "@/components/brand/logoPresentation";
import { Colors } from "@/constants/colors";

/**
 * THE LocalCheck logo mark — the single place the in-app logo comes from.
 *
 * Renders the exact path data from `assets/brand/logo-mark.svg` (viewBox
 * 0 0 1024 1024) through react-native-svg, so the mark stays crisp at any
 * size instead of scaling a raster export. To change the mark: edit the
 * paths below and `assets/brand/logo-mark.svg` together so the source file
 * and the rendered component never drift. Nothing else in the app should
 * ever require the logo file directly — always render <LogoMark />. The
 * native app icon + splash are separate build assets
 * (`assets/images/icon.png`, `assets/images/splash-icon.png`) and need a
 * tagged full build (not OTA) to change — see DESIGN.md §Brand assets.
 */
const VIEWBOX = "0 0 1024 1024";
// Fixed brand-mark gray for the viewfinder brackets — not a semantic UI
// color, so it lives here rather than in constants/colors.ts (see DESIGN.md
// §Identity: "the bracketed check mark ... is the canonical in-app mark").
const BRACKET_COLOR = "#E8E8EC";

function Brackets({ color }: { color: string }) {
  return (
    <G
      stroke={color}
      strokeLinecap="butt"
      strokeLinejoin="miter"
      strokeWidth={56}
    >
      <Path d="M 356 228 H 228 V 356" />
      <Path d="M 668 228 H 796 V 356" />
      <Path d="M 228 668 V 796 H 356" />
      <Path d="M 796 668 V 796 H 668" />
    </G>
  );
}

export function LogoMark({
  size = 64,
  style,
  variant = "mark",
}: {
  size?: number;
  style?: StyleProp<ViewStyle>;
  variant?: "mark" | "back";
}) {
  if (variant === "back") {
    return (
      <View
        accessibilityElementsHidden
        importantForAccessibility="no"
        style={backLogoContainerStyle(size)}
      >
        <Svg
          style={backLogoFrameStyle(size) as StyleProp<ViewStyle>}
          viewBox={VIEWBOX}
        >
          <Brackets color={BRACKET_COLOR} />
        </Svg>
        <Feather
          color={Colors.text}
          name="chevron-left"
          size={Math.round(size * 0.56)}
        />
      </View>
    );
  }

  return (
    <Svg
      accessibilityLabel="LocalCheck"
      style={[{ width: size, height: size }, style]}
      viewBox={VIEWBOX}
    >
      <Brackets color={BRACKET_COLOR} />
      <Path
        d="M 332 542 L 462 662 L 700 378"
        stroke={Colors.accent}
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={78}
      />
    </Svg>
  );
}
