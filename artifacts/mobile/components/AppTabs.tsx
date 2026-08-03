import React from "react";
import {
  Pressable,
  StyleProp,
  StyleSheet,
  Text,
  View,
  ViewStyle,
} from "react-native";

import { Colors, Radius } from "@/constants/colors";
import { ControlSize, Spacing } from "@/constants/layout";
import { Typography } from "@/constants/typography";

export type AppTabItem<T extends string> = {
  value: T;
  label: string;
  disabled?: boolean;
  badge?: boolean;
  testID?: string;
  icon?: (active: boolean) => React.ReactNode;
};

export function AppTabs<T extends string>({
  items,
  value,
  onChange,
  variant = "underline",
  style,
}: {
  items: ReadonlyArray<AppTabItem<T>>;
  value: T;
  onChange: (value: T) => void;
  variant?: "underline" | "segmented";
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <View
      accessibilityRole="tablist"
      style={[styles.base, variant === "segmented" ? styles.segmented : styles.underline, style]}
    >
      {items.map((item) => {
        const active = item.value === value;
        return (
          <Pressable
            key={item.value}
            testID={item.testID}
            disabled={item.disabled}
            accessibilityRole="tab"
            accessibilityState={{ selected: active, disabled: item.disabled }}
            onPress={() => onChange(item.value)}
            style={({ pressed }) => [
              styles.tab,
              variant === "segmented" ? styles.segment : styles.underlineTab,
              active && (variant === "segmented" ? styles.segmentActive : styles.underlineActive),
              item.disabled && styles.disabled,
              pressed && !item.disabled && styles.pressed,
            ]}
          >
            {item.icon?.(active)}
            <Text style={[styles.label, active && styles.labelActive]} numberOfLines={1}>
              {item.label}
            </Text>
            {item.badge ? <View style={styles.badge} /> : null}
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  base: { flexDirection: "row" },
  underline: {
    paddingHorizontal: Spacing.screen,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.border,
    backgroundColor: Colors.background,
  },
  segmented: {
    padding: 4,
    gap: 4,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.border,
    borderRadius: Radius.md,
    backgroundColor: Colors.surface,
  },
  tab: {
    flex: 1,
    minHeight: ControlSize.minimum,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 7,
    paddingHorizontal: Spacing.xs,
  },
  underlineTab: { borderBottomWidth: 2, borderBottomColor: "transparent" },
  underlineActive: { borderBottomColor: Colors.accent },
  segment: { borderRadius: Radius.sm, backgroundColor: "transparent" },
  segmentActive: { backgroundColor: Colors.surfaceHigh },
  label: {
    fontFamily: Typography.bodyBold,
    fontSize: 11,
    lineHeight: 14,
    color: Colors.muted,
    letterSpacing: 1.1,
    textTransform: "uppercase",
  },
  labelActive: { color: Colors.text },
  badge: { width: 5, height: 5, borderRadius: 3, backgroundColor: Colors.accent },
  disabled: { opacity: 0.35 },
  pressed: { opacity: 0.7 },
});
