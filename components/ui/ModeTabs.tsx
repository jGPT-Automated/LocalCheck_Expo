import { Feather } from "@expo/vector-icons";
import type { ComponentProps } from "react";
import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { Colors } from "@/constants/colors";
import { TextStyles } from "@/constants/typography";

type FeatherName = ComponentProps<typeof Feather>["name"];

export function ModeTabs<T extends string>({
  items,
  value,
  onChange,
}: {
  items: ReadonlyArray<{ label: string; value: T; icon: FeatherName; accessibilityLabel?: string }>;
  value: T;
  onChange: (value: T) => void;
}) {
  return (
    <View accessibilityRole="tablist" style={styles.container}>
      {items.map((item) => {
        const selected = item.value === value;
        return (
          <Pressable
            accessibilityLabel={item.accessibilityLabel ?? item.label}
            accessibilityRole="tab"
            accessibilityState={{ selected }}
            key={item.value}
            onPress={() => onChange(item.value)}
            style={[styles.tab, selected && styles.tabActive]}
          >
            <Feather color={selected ? Colors.text : Colors.muted} name={item.icon} size={14} />
            <Text style={[styles.label, selected && styles.labelActive]}>{item.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    minHeight: 44,
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    backgroundColor: Colors.surface,
  },
  tab: {
    flex: 1,
    minHeight: 44,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    borderBottomWidth: 2,
    borderBottomColor: "transparent",
  },
  tabActive: { backgroundColor: Colors.surfaceHigh, borderBottomColor: Colors.accent },
  label: { ...TextStyles.labelSmall, color: Colors.muted, letterSpacing: 1.5 },
  labelActive: { color: Colors.text },
});
