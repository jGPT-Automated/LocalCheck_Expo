import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { Colors } from "@/constants/colors";
import type { CourtSport } from "@/constants/data";
import { Typography } from "@/constants/typography";

const DAY_MS = 86_400_000;
/** A game can be logged up to a week back: today and the 6 days before. */
export const MAX_LOOKBACK_DAYS = 7;

function ymd(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/**
 * Compact day strip: one plain row of 7 days, weekday above the number, the
 * chosen day a circle outlined in the sport colour. By default the last 7 days
 * (oldest left, TODAY right); `ahead` shows today and the next 6 (challenges).
 * `daysBack` is capped at 7 so every caller (Log Game, a revision) offers the
 * same days.
 */
export function RecentDatePicker({
  value,
  onChange,
  daysBack = MAX_LOOKBACK_DAYS,
  ahead = false,
  sport,
  accessibilityLabel = "Game date",
}: {
  value: string;
  onChange: (value: string) => void;
  daysBack?: number;
  /** Today and the 6 days after it (a challenge), instead of the week back. */
  ahead?: boolean;
  /** The chosen circle is outlined in the sport's colour. */
  sport?: CourtSport | null;
  accessibilityLabel?: string;
}) {
  const days = React.useMemo(() => {
    const start = new Date();
    start.setHours(12, 0, 0, 0);
    const count = Math.min(MAX_LOOKBACK_DAYS, Math.max(1, daysBack));
    // Back: oldest first, today last. Ahead: today first.
    return Array.from({ length: count }, (_, index) =>
      ahead
        ? new Date(start.getTime() + index * DAY_MS)
        : new Date(start.getTime() - (count - 1 - index) * DAY_MS),
    );
  }, [daysBack, ahead]);
  const ring = sport === "PICKLEBALL" ? Colors.pickleballMeta : Colors.accent;

  return (
    <View accessibilityLabel={accessibilityLabel} accessibilityRole="radiogroup" style={styles.row}>
      {days.map((date, index) => {
        const dateValue = ymd(date);
        const active = dateValue === value;
        const isToday = ahead ? index === 0 : index === days.length - 1;
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
            <View style={[styles.circle, active && [styles.circleActive, { borderColor: ring }]]}>
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
  // The chosen day: outlined in the sport colour (orange for basketball).
  circleActive: { borderWidth: 2, backgroundColor: Colors.tile },
  day: { fontFamily: Typography.heading, fontSize: 18, lineHeight: 22, color: Colors.text },
  dayActive: { color: Colors.text },
});
