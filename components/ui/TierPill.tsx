import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { Colors, Radius } from "@/constants/colors";
import { Typography } from "@/constants/typography";

/**
 * The one bordered-rectangle pill treatment for a short status label —
 * originally the Settings tier badge (LOCALPLUS/LOCALLITE). Reused as-is
 * for anything else that needs the same "active vs not" look (e.g. the
 * court screen's LOCAL / SET LOCAL button) instead of a second, similar-
 * but-not-identical style living in another file.
 */
export function TierPill({
  active,
  children,
  icon,
  onPress,
  accessibilityLabel,
  accessibilityHint,
}: {
  active: boolean;
  children: string;
  icon?: React.ReactNode;
  onPress?: () => void;
  accessibilityLabel?: string;
  accessibilityHint?: string;
}) {
  const content = (
    <>
      {icon}
      <Text style={[styles.text, active && styles.textActive]}>{children}</Text>
    </>
  );
  if (onPress) {
    return (
      <Pressable
        accessibilityHint={accessibilityHint}
        accessibilityLabel={accessibilityLabel}
        accessibilityRole="button"
        accessibilityState={{ selected: active }}
        hitSlop={8}
        onPress={onPress}
        style={({ pressed }) => [
          styles.pill,
          active && styles.pillActive,
          pressed && styles.pressed,
        ]}
      >
        {content}
      </Pressable>
    );
  }
  return <View style={[styles.pill, active && styles.pillActive]}>{content}</View>;
}

const styles = StyleSheet.create({
  pill: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: Radius.sm,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: "transparent",
  },
  pillActive: {
    borderColor: Colors.accentBorder,
    backgroundColor: Colors.accentDim,
  },
  text: {
    fontFamily: Typography.bodyBold,
    fontSize: 10,
    letterSpacing: 1.4,
    color: Colors.muted,
  },
  textActive: { color: Colors.accent },
  pressed: { opacity: 0.72 },
});
