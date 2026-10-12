import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { Colors, Radius } from "@/constants/colors";
import { Typography } from "@/constants/typography";

/**
 * One iOS-style segmented control: a single track with the chosen segment
 * raised. For two or three short, mutually exclusive choices (Ranked / Casual).
 */
export function SegmentedControl<T extends string>({
  items,
  value,
  onChange,
  accessibilityLabel,
}: {
  items: ReadonlyArray<{ value: T; label: string }>;
  value: T;
  onChange: (value: T) => void;
  accessibilityLabel?: string;
}) {
  return (
    <View accessibilityLabel={accessibilityLabel} accessibilityRole="radiogroup" style={styles.track}>
      {items.map((item) => {
        const selected = item.value === value;
        return (
          <Pressable
            accessibilityRole="radio"
            accessibilityState={{ selected }}
            key={item.value}
            onPress={() => onChange(item.value)}
            style={[styles.segment, selected && styles.segmentSelected]}
          >
            <Text numberOfLines={1} style={[styles.text, selected && styles.textSelected]}>
              {item.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  track: {
    flexDirection: "row",
    padding: 3,
    borderRadius: Radius.md,
    backgroundColor: Colors.background,
  },
  segment: {
    flex: 1,
    minHeight: 40,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: Radius.sm,
  },
  segmentSelected: { backgroundColor: Colors.surfaceHigh },
  text: {
    fontFamily: Typography.heading,
    fontSize: 14,
    letterSpacing: 0.5,
    color: Colors.muted,
  },
  textSelected: { color: Colors.text },
});
