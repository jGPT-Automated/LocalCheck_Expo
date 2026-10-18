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
  compact = false,
}: {
  items: ReadonlyArray<{ value: T; label: string }>;
  value: T;
  onChange: (value: T) => void;
  accessibilityLabel?: string;
  /** Short caps labels (sort pickers): Inter bold 11, a 36pt track. */
  compact?: boolean;
}) {
  return (
    <View accessibilityLabel={accessibilityLabel} accessibilityRole="radiogroup" style={[styles.track, compact && styles.trackCompact]}>
      {items.map((item) => {
        const selected = item.value === value;
        return (
          <Pressable
            accessibilityRole="radio"
            accessibilityState={{ selected }}
            key={item.value}
            onPress={() => onChange(item.value)}
            style={[styles.segment, compact && styles.segmentCompact, selected && styles.segmentSelected]}
          >
            <Text numberOfLines={1} style={[styles.text, compact && styles.textCompact, selected && styles.textSelected]}>
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
  trackCompact: { backgroundColor: Colors.panel, borderWidth: 1, borderColor: Colors.hairline },
  segmentCompact: { minHeight: 34 },
  textCompact: { fontFamily: Typography.bodyBold, fontSize: 11, letterSpacing: 1.1, textTransform: "uppercase" },
  segmentSelected: { backgroundColor: Colors.surfaceHigh },
  text: {
    fontFamily: Typography.heading,
    fontSize: 14,
    letterSpacing: 0.5,
    color: Colors.muted,
  },
  textSelected: { color: Colors.text },
});
