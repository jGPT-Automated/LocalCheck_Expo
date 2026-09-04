import React from "react";
import { Pressable, ScrollView, StyleSheet, Text } from "react-native";

import { Colors, Radius } from "@/constants/colors";
import { Typography } from "@/constants/typography";

const DAY_MS = 86_400_000;

function ymd(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/**
 * Compact "recent day" picker: one row of chips for the last `daysBack` days,
 * today first. A game is logged close to when it was played, so there is no
 * calendar and no older-week paging — that would only invite stale results.
 */
export function RecentDatePicker({
  value,
  onChange,
  daysBack = 7,
  accessibilityLabel = "Game date",
}: {
  value: string;
  onChange: (value: string) => void;
  daysBack?: number;
  accessibilityLabel?: string;
}) {
  const days = React.useMemo(() => {
    const start = new Date();
    start.setHours(12, 0, 0, 0);
    return Array.from(
      { length: Math.max(1, daysBack) },
      (_, index) => new Date(start.getTime() - index * DAY_MS),
    );
  }, [daysBack]);

  return (
    <ScrollView
      accessibilityLabel={accessibilityLabel}
      contentContainerStyle={styles.row}
      horizontal
      keyboardShouldPersistTaps="handled"
      showsHorizontalScrollIndicator={false}
    >
      {days.map((date, index) => {
        const dateValue = ymd(date);
        const active = dateValue === value;
        return (
          <Pressable
            accessibilityLabel={date.toLocaleDateString("en-US", {
              weekday: "long",
              month: "long",
              day: "numeric",
            })}
            accessibilityRole="button"
            accessibilityState={{ selected: active }}
            key={dateValue}
            onPress={() => onChange(dateValue)}
            style={[styles.chip, active && styles.chipActive]}
          >
            <Text style={[styles.weekday, active && styles.textActive]}>
              {index === 0
                ? "TODAY"
                : date
                    .toLocaleDateString("en-US", { weekday: "short" })
                    .toUpperCase()}
            </Text>
            <Text style={[styles.day, active && styles.textActive]}>
              {date.getDate()}
            </Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  row: { gap: 6, paddingVertical: 2 },
  chip: {
    minWidth: 52,
    minHeight: 56,
    paddingHorizontal: 10,
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.border,
    borderRadius: Radius.sm,
    backgroundColor: Colors.surface,
  },
  chipActive: { borderColor: Colors.accent, backgroundColor: Colors.accent },
  weekday: {
    fontFamily: Typography.bodyBold,
    fontSize: 9,
    letterSpacing: 1,
    color: Colors.muted,
  },
  day: {
    fontFamily: Typography.heading,
    fontSize: 16,
    lineHeight: 18,
    color: Colors.text,
  },
  textActive: { color: Colors.black },
});
