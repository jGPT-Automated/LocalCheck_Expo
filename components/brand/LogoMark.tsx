import React from "react";
import { View } from "react-native";
import Svg, { Path, Polygon, Rect } from "react-native-svg";

import { Colors } from "@/constants/colors";

const FULL_LOCKUP_RATIO = 1290 / 202;
const WORDMARK_RATIO = 1022 / 110;

function CornerFrame() {
  return (
    <>
      <Rect fill={Colors.white} height="16" width="65" x="0" y="0" />
      <Rect fill={Colors.white} height="68" width="16" x="0" y="0" />
      <Rect fill={Colors.white} height="16" width="65" x="145" y="0" />
      <Rect fill={Colors.white} height="68" width="16" x="194" y="0" />
      <Rect fill={Colors.white} height="17" width="65" x="0" y="185" />
      <Rect fill={Colors.white} height="68" width="16" x="0" y="134" />
      <Rect fill={Colors.white} height="17" width="65" x="145" y="185" />
      <Rect fill={Colors.white} height="68" width="16" x="194" y="134" />
      <Polygon fill={Colors.brandMark} points="45,110 60,96 87,122 155,53 170,67 87,151" />
    </>
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
