import React from "react";
import { Pressable, ScrollView, StyleSheet, Text } from "react-native";

import { Colors, Radius } from "@/constants/colors";
import { Typography } from "@/constants/typography";

export type TimeOption = { value: string; label: string; disabled?: boolean };

const CHIP = 76;
const GAP = 6;

/**
 * One row of times you swipe left and right (shorter than a wheel), the
 * chosen one outlined. Past times are dimmed and can't be picked. Scrolls to
 * the chosen time when it changes.
 */
export function TimeStrip({
  items,
  value,
  onChange,
  accessibilityLabel = "Time",
}: {
  items: TimeOption[];
  value: string;
  onChange: (value: string) => void;
  accessibilityLabel?: string;
}) {
  const ref = React.useRef<ScrollView>(null);
  const [width, setWidth] = React.useState(0);
  const index = Math.max(0, items.findIndex((item) => item.value === value));
  React.useEffect(() => {
    if (width === 0) return;
    const x = Math.max(0, index * (CHIP + GAP) - (width - CHIP) / 2);
    ref.current?.scrollTo({ x, animated: true });
  }, [index, width]);

  return (
    <ScrollView
      accessibilityLabel={accessibilityLabel}
      contentContainerStyle={styles.row}
      horizontal
      nestedScrollEnabled
      onLayout={(event) => setWidth(event.nativeEvent.layout.width)}
      ref={ref}
      showsHorizontalScrollIndicator={false}
    >
      {items.map((item) => {
        const active = item.value === value;
        return (
          <Pressable
            accessibilityLabel={item.label}
            accessibilityRole="radio"
            accessibilityState={{ selected: active, disabled: item.disabled }}
            disabled={item.disabled}
            key={item.value}
            onPress={() => onChange(item.value)}
            style={[styles.chip, active && styles.chipActive, item.disabled && styles.chipDisabled]}
          >
            <Text style={[styles.text, active && styles.textActive]}>{item.label}</Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  row: { gap: GAP },
  chip: {
    width: CHIP,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: Radius.chip,
    borderWidth: 1,
    borderColor: Colors.hairlineCard,
    backgroundColor: Colors.panel,
  },
  chipActive: { borderColor: Colors.text, backgroundColor: Colors.tile },
  chipDisabled: { opacity: 0.3 },
  text: { fontFamily: Typography.bodySemiBold, fontSize: 12, color: Colors.textSecondary },
  textActive: { color: Colors.text },
});
