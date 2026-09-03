import { Feather } from "@expo/vector-icons";
import type { ComponentProps } from "react";
import React, { useCallback, useEffect, useState } from "react";
import { Pressable, StyleSheet, Text, View, type LayoutChangeEvent } from "react-native";
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from "react-native-reanimated";

import { Colors } from "@/constants/colors";
import { TextStyles, Typography } from "@/constants/typography";

type FeatherName = ComponentProps<typeof Feather>["name"];

// Matches PanelUI's Tabs indicator spring (packages/panelui/src/components/tabs) —
// one indicator measured against real trigger layouts, not a per-tab style toggle.
const SPRING = { damping: 22, stiffness: 260, mass: 0.7 } as const;

type TabLayout = { x: number; width: number };

export function ModeTabs<T extends string>({
  items,
  value,
  onChange,
  prominent = false,
}: {
  items: ReadonlyArray<{ label: string; value: T; icon?: FeatherName; accessibilityLabel?: string }>;
  value: T;
  onChange: (value: T) => void;
  prominent?: boolean;
}) {
  const [layouts, setLayouts] = useState<Partial<Record<string, TabLayout>>>({});
  const indicatorX = useSharedValue(0);
  const indicatorWidth = useSharedValue(0);
  const initialized = useSharedValue(0);

  const activeLayout = layouts[value];

  useEffect(() => {
    if (!activeLayout) return;
    if (initialized.value === 0) {
      indicatorX.value = activeLayout.x;
      indicatorWidth.value = activeLayout.width;
      initialized.value = 1;
    } else {
      indicatorX.value = withSpring(activeLayout.x, SPRING);
      indicatorWidth.value = withSpring(activeLayout.width, SPRING);
    }
  }, [activeLayout, indicatorX, indicatorWidth, initialized]);

  const indicatorStyle = useAnimatedStyle(() => ({
    opacity: initialized.value,
    transform: [{ translateX: indicatorX.value }],
    width: indicatorWidth.value,
  }));

  const handleLayout = useCallback(
    (tabValue: T) => (event: LayoutChangeEvent) => {
      const { x, width } = event.nativeEvent.layout;
      setLayouts((current) => {
        const existing = current[tabValue];
        if (existing && existing.x === x && existing.width === width) return current;
        return { ...current, [tabValue]: { x, width } };
      });
    },
    []
  );

  return (
    <View
      accessibilityRole="tablist"
      style={[styles.container, prominent && styles.containerProminent]}
    >
      <Animated.View style={[styles.indicator, indicatorStyle]} />
      {items.map((item) => {
        const selected = item.value === value;
        return (
          <Pressable
            accessibilityLabel={item.accessibilityLabel ?? item.label}
            accessibilityRole="tab"
            accessibilityState={{ selected }}
            key={item.value}
            onLayout={handleLayout(item.value)}
            onPress={() => onChange(item.value)}
            style={[
              styles.tab,
              prominent && styles.tabProminent,
              selected && !prominent && styles.tabActive,
            ]}
          >
            {item.icon ? (
              <Feather color={selected ? Colors.text : Colors.muted} name={item.icon} size={14} />
            ) : null}
            <Text
              style={[
                styles.label,
                prominent && styles.labelProminent,
                selected && styles.labelActive,
              ]}
            >
              {item.label}
            </Text>
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
  containerProminent: {
    minHeight: 52,
    backgroundColor: Colors.background,
  },
  indicator: {
    position: "absolute",
    bottom: 0,
    height: 2,
    backgroundColor: Colors.accent,
  },
  tab: {
    flex: 1,
    minHeight: 44,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  tabActive: { backgroundColor: Colors.surfaceHigh },
  tabProminent: { minHeight: 52 },
  label: { ...TextStyles.labelSmall, color: Colors.muted, letterSpacing: 1.5 },
  labelActive: { color: Colors.text },
  labelProminent: {
    fontFamily: Typography.heading,
    fontSize: 16,
    lineHeight: 20,
    letterSpacing: 1.5,
  },
});
