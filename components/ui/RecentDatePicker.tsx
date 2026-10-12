import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { Colors } from "@/constants/colors";
import { Typography } from "@/constants/typography";

const DAY_MS = 86_400_000;
/** A game is logged right after it is played: today and the 4 days before. */
export const MAX_LOOKBACK_DAYS = 5;

function ymd(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/**
 * Compact "recent day" strip: one plain row of the last 5 days, weekday above
 * the number, the chosen day an orange circle. Oldest on the left, TODAY on the
 * right like a calendar week; there is no future date and no older paging.
 * `daysBack` is capped at 5 so every caller (Log Game, a revision) offers the
 * same days.
 */
export function RecentDatePicker({
  value,
  onChange,
  daysBack = MAX_LOOKBACK_DAYS,
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
    const count = Math.min(MAX_LOOKBACK_DAYS, Math.max(1, daysBack));
    // Oldest first, today last.
    return Array.from(
      { length: count },
      (_, index) => new Date(start.getTime() - (count - 1 - index) * DAY_MS),
    );
  }, [daysBack]);

  return (
    <View accessibilityLabel={accessibilityLabel} accessibilityRole="radiogroup" style={styles.row}>
      {days.map((date, index) => {
        const dateValue = ymd(date);
        const active = dateValue === value;
        const isToday = index === days.length - 1;
        return (
          <Pressable
            accessibilityLabel={date.toLocaleDateString("en-US", {
              weekday: "long",
              month: "long",
              day: "numeric",
            })}
            accessibilityRole="radio"
            accessibilityState={{ selected: active }}
            key={dateValue}
            onPress={() => onChange(dateValue)}
            style={styles.cell}
          >
            <Text numberOfLines={1} style={[styles.weekday, active && styles.weekdayActive]}>
              {isToday
                ? "TODAY"
                : date.toLocaleDateString("en-US", { weekday: "short" }).toUpperCase()}
            </Text>
            <View style={[styles.circle, active && styles.circleActive]}>
              <Text style={[styles.day, active && styles.dayActive]}>{date.getDate()}</Text>
            </View>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row" },
  cell: { flex: 1, minWidth: 0, alignItems: "center", gap: 6, paddingVertical: 2 },
  weekday: {
    fontFamily: Typography.bodyBold,
    fontSize: 9,
    letterSpacing: 1,
    color: Colors.muted,
  },
  weekdayActive: { color: Colors.text },
  circle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  circleActive: { backgroundColor: Colors.accent },
  day: { fontFamily: Typography.heading, fontSize: 18, lineHeight: 22, color: Colors.text },
  dayActive: { color: Colors.black },
});
