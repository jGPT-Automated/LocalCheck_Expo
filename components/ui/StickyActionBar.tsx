import { Feather } from "@expo/vector-icons";
import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { Colors, Radius } from "@/constants/colors";
import { Layout, Space } from "@/constants/layout";
import { Typography } from "@/constants/typography";

interface StickyAction {
  label: string;
  onPress: () => void;
  icon?: React.ComponentProps<typeof Feather>["name"];
  disabled?: boolean;
}

export function StickyActionBar({
  primary,
  secondary,
  bottomInset = 0,
}: {
  primary: StickyAction;
  secondary?: StickyAction;
  bottomInset?: number;
}) {
  return (
    <View style={[styles.bar, { paddingBottom: Math.max(bottomInset, Space.md) }]}>
      {secondary ? <Action action={secondary} /> : null}
      <Action action={primary} primary />
    </View>
  );
}

function Action({ action, primary = false }: { action: StickyAction; primary?: boolean }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: action.disabled }}
      disabled={action.disabled}
      onPress={action.onPress}
      style={({ pressed }) => [
        styles.action,
        primary ? styles.primary : styles.secondary,
        action.disabled && styles.disabled,
        pressed && styles.pressed,
      ]}
    >
      {action.icon ? (
        <Feather color={primary ? Colors.black : Colors.text} name={action.icon} size={16} />
      ) : null}
      <Text style={[styles.label, primary && styles.primaryLabel]}>{action.label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  bar: {
    paddingTop: Space.md,
    paddingHorizontal: Layout.screenGutter,
    flexDirection: "row",
    gap: Space.md,
    backgroundColor: Colors.surfaceDark,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: Colors.border,
  },
  action: {
    flex: 1,
    minHeight: 50,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: Space.sm,
    borderRadius: Radius.md,
  },
  primary: { backgroundColor: Colors.accent, borderWidth: 1, borderColor: Colors.accent },
  secondary: { backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border },
  label: { fontFamily: Typography.heading, fontSize: 11, color: Colors.text, letterSpacing: 1.25 },
  primaryLabel: { color: Colors.black },
  disabled: { opacity: 0.45 },
  pressed: { opacity: 0.74, transform: [{ scale: 0.985 }] },
});
