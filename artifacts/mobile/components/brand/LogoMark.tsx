import React from "react";
import { StyleProp, ViewStyle } from "react-native";
import Svg, { G, Path } from "react-native-svg";

import { Colors } from "@/constants/colors";

/**
 * THE LocalCheck logo mark — the single place the in-app logo comes from.
 *
 * This component renders the approved editable vector geometry directly so
 * the in-app mark stays crisp at both header and boot sizes. The native app
 * icon + splash are separate build assets
 * (`assets/images/icon.png`, `assets/images/splash-icon.png`) and need a
 * tagged full build (not OTA) to change — see DESIGN.md §Brand assets.
 */
export function LogoMark({
  size = 64,
  style,
  accessible = true,
}: {
  size?: number;
  style?: StyleProp<ViewStyle>;
  accessible?: boolean;
}) {
  return (
    <Svg
      width={size}
      height={size}
      viewBox="0 0 40 40"
      fill="none"
      style={style}
      accessible={accessible}
      accessibilityLabel={accessible ? "LocalCheck" : undefined}
    >
      <G
        stroke={Colors.text}
        strokeWidth={1.6}
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <Path d="M13 4H4v9" />
        <Path d="M27 4h9v9" />
        <Path d="M36 27v9h-9" />
        <Path d="M4 27v9h9" />
      </G>
      <Path
        d="M13.5 20.4 18 25l9-9.6"
        stroke={Colors.accent}
        strokeWidth={2.6}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}
