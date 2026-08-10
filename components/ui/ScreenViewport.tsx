import React from "react";
import { StyleProp, StyleSheet, View, ViewStyle } from "react-native";

import { Colors } from "@/constants/colors";

export function ScreenViewport({
  children,
  style,
}: {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  return <View style={[styles.viewport, style]}>{children}</View>;
}

const styles = StyleSheet.create({
  viewport: {
    flex: 1,
    minHeight: 0,
    backgroundColor: Colors.background,
    overflow: "hidden",
  },
});
