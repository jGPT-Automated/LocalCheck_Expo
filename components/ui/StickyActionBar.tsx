import { Feather } from "@expo/vector-icons";
import React from "react";
import { StyleSheet, Text, View } from "react-native";

import { PressableScale } from "@/components/ui/PressableScale";

import { Colors, Radius } from "@/constants/colors";
import { Layout, Space } from "@/constants/layout";
import { Typography } from "@/constants/typography";

interface StickyAction {
  label: string;
  onPress: () => void;
  icon?: React.ComponentProps<typeof Feather>["name"];
  disabled?: boolean;
  /** "light" = white button with black text (Challenge). Default orange. */
  tone?: "accent" | "light";
}

interface StickyIconAction {
  icon: React.ComponentProps<typeof Feather>["name"];
  accessibilityLabel: string;
  onPress: () => void;
}

export function StickyActionBar({
  primary,
  secondary,
  leading,
  top,
  bottomInset = 0,
}: {
  primary: StickyAction;
  secondary?: StickyAction;
  /** Square icon-only button on the far left (e.g. add / remove friend). */
  leading?: StickyIconAction;
  /** A row that belongs with the actions, above them (e.g. Hide score). */
  top?: React.ReactNode;
  bottomInset?: number;
}) {
  return (
    <View style={[styles.wrap, { paddingBottom: Math.max(bottomInset, Space.md) }]}>
      {top}
      <View style={styles.bar}>
      {leading ? (
        <PressableScale
          accessibilityLabel={leading.accessibilityLabel}
          accessibilityRole="button"
          onPress={leading.onPress}
          style={styles.iconAction}
        >
          <Feather color={Colors.textSecondary} name={leading.icon} size={18} />
        </PressableScale>
      ) : null}
      {secondary ? <Action action={secondary} /> : null}
      <Action action={primary} primary />
      </View>
    </View>
  );
}

function Action({ action, primary = false }: { action: StickyAction; primary?: boolean }) {
  return (
    <PressableScale
      accessibilityRole="button"
      accessibilityState={{ disabled: action.disabled }}
      disabled={action.disabled}
      onPress={action.onPress}
      style={[
        styles.action,
        primary ? (action.tone === "light" ? styles.light : styles.primary) : styles.secondary,
        action.disabled && styles.disabled,
      ]}
    >
      {action.icon ? (
        <Feather color={primary ? Colors.background : Colors.text} name={action.icon} size={16} />
      ) : null}
      <Text numberOfLines={1} style={[styles.label, primary && styles.primaryLabel]}>{action.label}</Text>
    </PressableScale>
  );
}

// Court-flow action bar: 4pt buttons, Inter bold uppercase labels, the page
// background behind them and one hairline above.
const styles = StyleSheet.create({
  wrap: {
    paddingTop: Space.md,
    paddingHorizontal: Layout.screenGutter,
    gap: Space.sm,
    backgroundColor: Colors.background,
    borderTopWidth: 1,
    borderTopColor: Colors.hairline,
  },
  // The buttons share the row equally and sit centred in it.
  bar: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10 },
  action: {
    flex: 1,
    minHeight: 52,
    paddingHorizontal: 10,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: Space.sm,
    borderRadius: Radius.button,
  },
  primary: { backgroundColor: Colors.accent, borderWidth: 1, borderColor: Colors.accent },
  light: { backgroundColor: Colors.text, borderWidth: 1, borderColor: Colors.text },
  iconAction: {
    width: 52,
    minHeight: 52,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: Radius.button,
    borderWidth: 1,
    borderColor: Colors.hairlineChrome,
    backgroundColor: Colors.panel,
  },
  secondary: { backgroundColor: Colors.panel, borderWidth: 1, borderColor: Colors.hairlineChrome },
  label: { flexShrink: 1, fontFamily: Typography.bodyBold, fontSize: 11.5, color: Colors.text, letterSpacing: 1.1, textTransform: "uppercase" },
  primaryLabel: { color: Colors.background },
  disabled: { opacity: 0.45 },
});
