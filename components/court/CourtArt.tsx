// Minimal court trace from the Claude Design handoff (rn/CourtArt.tsx): one
// hairline in the sport color, no glow, fading out to the left. A fixed
// 160×132 box pinned top-right, the same on the Home card and the court page.
import React from "react";
import { View } from "react-native";
import Svg, { Circle, Defs, G, Line, LinearGradient, Mask, Path, Rect, Stop } from "react-native-svg";

import { Colors } from "@/constants/colors";
import type { CourtSport } from "@/constants/data";

const W = 160;
const H = 132;

/** `faint` dims the trace further where text sits over it (court page header). */
export function CourtArt({
  sport,
  top = 0,
  faint = false,
  local = false,
}: {
  sport: CourtSport;
  top?: number;
  faint?: boolean;
  /** Your local court: the trace turns orange. */
  local?: boolean;
}) {
  const pickleball = sport === "PICKLEBALL";
  const stroke = local ? "rgba(252,76,2,0.42)" : pickleball ? Colors.pickleballTrace : Colors.basketballTrace;
  return (
    <View pointerEvents="none" style={{ position: "absolute", top, right: 0, width: W, height: H, opacity: faint ? 0.35 : 1 }}>
      <Svg height={H} width={W}>
        <Defs>
          <LinearGradient gradientUnits="userSpaceOnUse" id="courtArtFade" x1={W} x2="0" y1="0" y2="0">
            <Stop offset="0" stopColor="#fff" stopOpacity={1} />
            <Stop offset="0.45" stopColor="#fff" stopOpacity={0.5} />
            <Stop offset="1" stopColor="#fff" stopOpacity={0} />
          </LinearGradient>
          <Mask height={H} id="courtArtMask" maskUnits="userSpaceOnUse" width={W} x="0" y="0">
            <Rect fill="url(#courtArtFade)" height={H} width={W} />
          </Mask>
        </Defs>
        <G fill="none" mask="url(#courtArtMask)" stroke={stroke} strokeWidth={1}>
          {pickleball ? (
            <>
              <Path d="M160 12.5H20.5V119.5H160" />
              <Line strokeDasharray="3 3" x1={20.5} x2={20.5} y1={12} y2={120} />
              <Line x1={66.5} x2={66.5} y1={12} y2={120} />
              <Line x1={66} x2={160} y1={66.5} y2={66.5} />
            </>
          ) : (
            <>
              <Circle cx={138} cy={66} r={117.5} />
              <Path d="M160 34.5H84.5V97.5H160" />
              <Circle cx={84} cy={66} r={31.5} />
              <Circle cx={138} cy={66} r={4.5} />
            </>
          )}
        </G>
      </Svg>
    </View>
  );
}
