import React from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import { Colors, Radius } from "@/constants/colors";
import { Typography } from "@/constants/typography";

export type Choice<T extends string> = { value: T; label: string };

/** Single-choice chips, same look as the Create game format picker. Wraps
 * into a horizontal scroller when `scroll` is set (day pickers). */
export function ChoiceChips<T extends string>({
  choices,
  value,
  onChange,
  scroll = false,
}: {
  choices: Choice<T>[];
  value: T;
  onChange: (value: T) => void;
  scroll?: boolean;
}) {
  const chips = choices.map((choice) => {
    const active = choice.value === value;
    return (
      <Pressable
        accessibilityRole="radio"
        accessibilityState={{ selected: active }}
        key={choice.value}
        onPress={() => onChange(choice.value)}
        style={({ pressed }) => [
          styles.chip,
          !scroll && styles.chipFill,
          active && styles.chipActive,
          pressed && styles.pressed,
        ]}
      >
        <Text numberOfLines={1} style={[styles.text, active && styles.textActive]}>
          {choice.label}
        </Text>
      </Pressable>
    );
  });
  if (scroll) {
    return (
      <ScrollView
        contentContainerStyle={styles.row}
        horizontal
        showsHorizontalScrollIndicator={false}
      >
        {chips}
      </ScrollView>
    );
  }
  return <View style={[styles.row, styles.rowFill]}>{chips}</View>;
}

const styles = StyleSheet.create({
  row: { gap: 8 },
  rowFill: { flexDirection: "row" },
  chip: {
    minHeight: 44,
    paddingHorizontal: 14,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: Radius.sm,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.surface,
  },
  chipFill: { flex: 1 },
  chipActive: { borderColor: Colors.accent, backgroundColor: Colors.accentDim },
  pressed: { opacity: 0.72 },
  text: {
    fontFamily: Typography.heading,
    fontSize: 14,
    letterSpacing: 0.5,
    color: Colors.textSecondary,
  },
  textActive: { color: Colors.accent },
});
