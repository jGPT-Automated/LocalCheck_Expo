import React, { useState } from "react";
import {
  type GestureResponderEvent,
  Pressable,
  type PressableProps,
  type StyleProp,
  StyleSheet,
  type ViewStyle,
} from "react-native";
import Animated, { useReducedMotion } from "react-native-reanimated";

import { CssEase, Durations, PRESS_SCALE } from "@/constants/motion";

/**
 * The one press feedback for cards and buttons: shrinks to 0.97 on press-in
 * (120 ms) and springs back on release. Full-width list rows should highlight
 * their background instead (a scaling row reads as the screen squishing).
 * Reduce Motion turns the scale off.
 *
 * `style` goes on the moving surface; `containerStyle` on the touch area
 * (put flex / alignSelf there when the card sits in a row).
 */
// Where the card sits (its slot in the parent) belongs on the touch area, not
// on the surface that scales.
const OUTER_KEYS = new Set([
  "flex", "flexGrow", "flexShrink", "flexBasis", "alignSelf",
  "width", "minWidth", "maxWidth",
  "margin", "marginTop", "marginBottom", "marginLeft", "marginRight",
  "marginHorizontal", "marginVertical", "marginStart", "marginEnd",
  "position", "top", "bottom", "left", "right", "zIndex",
]);

function splitStyle(style: StyleProp<ViewStyle>): [ViewStyle, ViewStyle] {
  const flat = (StyleSheet.flatten(style) ?? {}) as Record<string, unknown>;
  const outer: Record<string, unknown> = {};
  const inner: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(flat)) {
    (OUTER_KEYS.has(key) ? outer : inner)[key] = value;
  }
  // The surface fills its slot when the slot is sized by flex or width.
  if ("flex" in outer || "flexGrow" in outer || "width" in outer) inner.flexGrow = 1;
  return [outer as ViewStyle, inner as ViewStyle];
}

export function PressableScale({
  children,
  style,
  containerStyle,
  scaleTo = PRESS_SCALE,
  onPressIn,
  onPressOut,
  ...rest
}: Omit<PressableProps, "style" | "children"> & {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  containerStyle?: StyleProp<ViewStyle>;
  scaleTo?: number;
}) {
  const [pressed, setPressed] = useState(false);
  const reduced = useReducedMotion();
  const [outer, inner] = containerStyle ? [containerStyle, style] : splitStyle(style);
  const active = pressed && !reduced && !rest.disabled;
  return (
    <Pressable
      {...rest}
      onPressIn={(event: GestureResponderEvent) => {
        setPressed(true);
        onPressIn?.(event);
      }}
      onPressOut={(event: GestureResponderEvent) => {
        setPressed(false);
        onPressOut?.(event);
      }}
      pressRetentionOffset={{ top: 12, bottom: 12, left: 12, right: 12 }}
      style={outer}
    >
      <Animated.View
        style={[
          inner,
          {
            transform: [{ scale: active ? scaleTo : 1 }],
            transitionProperty: "transform",
            transitionDuration: Durations.press,
            transitionTimingFunction: CssEase.out,
          },
        ]}
      >
        {children}
      </Animated.View>
    </Pressable>
  );
}
