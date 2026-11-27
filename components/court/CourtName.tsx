import React from "react";
import { StyleSheet, Text, type TextProps } from "react-native";

/** Native text fitting; the web adapter supplies the missing RN Web behavior. */
export function CourtName(props: TextProps & { children: string }) {
  const baseSize = StyleSheet.flatten(props.style)?.fontSize ?? 30;
  return <Text {...props} adjustsFontSizeToFit minimumFontScale={11 / baseSize} numberOfLines={1} />;
}
