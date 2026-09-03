import { Feather } from "@expo/vector-icons";
import React from "react";
import {
  NativeScrollEvent,
  NativeSyntheticEvent,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";

import { Colors, Radius } from "@/constants/colors";
import { Space } from "@/constants/layout";
import { TextStyles, Typography } from "@/constants/typography";

const DAY_MS = 86_400_000;
const WEEK_COUNT = 13;

function localDateValue(date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function startOfWeek(date: Date): Date {
  const result = new Date(date);
  result.setHours(12, 0, 0, 0);
  result.setDate(result.getDate() - result.getDay());
  return result;
}

function weekAt(index: number): Date[] {
  const start = startOfWeek(new Date());
  start.setDate(start.getDate() - index * 7);
  return Array.from(
    { length: 7 },
    (_, day) => new Date(start.getTime() + day * DAY_MS),
  );
}

function weekRange(days: Date[]): string {
  const first = days[0];
  const last = days[6];
  const sameMonth = first.getMonth() === last.getMonth();
  const firstLabel = first.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
  const lastLabel = last.toLocaleDateString("en-US", {
    month: sameMonth ? undefined : "short",
    day: "numeric",
  });
  return `${firstLabel} – ${lastLabel}`.toUpperCase();
}

export function WeekDatePicker({
  accessibilityLabel = "Game date",
  onChange,
  value,
}: {
  accessibilityLabel?: string;
  onChange: (value: string) => void;
  value: string;
}) {
  const [open, setOpen] = React.useState(false);
  const [pageWidth, setPageWidth] = React.useState(0);
  const [weekIndex, setWeekIndex] = React.useState(0);
  const weeks = React.useMemo(
    () => Array.from({ length: WEEK_COUNT }, (_, index) => weekAt(index)),
    [],
  );
  const selected = new Date(`${value}T12:00:00`);
  const formatted = selected.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
  const today = localDateValue();

  if (Platform.OS === "web") {
    return React.createElement("input", {
      "aria-label": accessibilityLabel,
      max: today,
      onChange: (event: React.ChangeEvent<HTMLInputElement>) =>
        onChange(event.currentTarget.value),
      style: {
        width: "100%",
        height: 48,
        padding: "0 14px",
        color: Colors.text,
        backgroundColor: Colors.surface,
        border: `1px solid ${Colors.border}`,
        borderRadius: Radius.xs,
        fontFamily: Typography.bodySemiBold,
        fontSize: 14,
        colorScheme: "dark",
        cursor: "pointer",
      },
      type: "date",
      value,
    });
  }

  const onMomentumEnd = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    if (!pageWidth) return;
    setWeekIndex(
      Math.max(
        0,
        Math.min(
          WEEK_COUNT - 1,
          Math.round(event.nativeEvent.contentOffset.x / pageWidth),
        ),
      ),
    );
  };

  return (
    <View>
      <Pressable
        accessibilityLabel={`${accessibilityLabel}, ${formatted}`}
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        onPress={() => setOpen((shown) => !shown)}
        style={styles.trigger}
      >
        <View style={styles.triggerCopy}>
          <Feather color={Colors.accent} name="calendar" size={16} />
          <Text numberOfLines={1} style={styles.triggerText}>
            {formatted.toUpperCase()}
          </Text>
        </View>
        <Feather
          color={Colors.muted}
          name={open ? "chevron-up" : "chevron-down"}
          size={16}
        />
      </Pressable>

      {open ? (
        <View
          onLayout={(event) => setPageWidth(event.nativeEvent.layout.width)}
          style={styles.picker}
        >
          <View style={styles.pickerHeader}>
            <Text style={styles.pickerEyebrow}>
              {weekIndex === 0
                ? "THIS WEEK"
                : `${weekIndex} WEEK${weekIndex === 1 ? "" : "S"} AGO`}
            </Text>
            <Text style={styles.pickerRange}>
              {weekRange(weeks[weekIndex])}
            </Text>
          </View>
          {pageWidth > 0 ? (
            <ScrollView
              accessibilityLabel="Choose a game date by week"
              decelerationRate="fast"
              disableIntervalMomentum
              horizontal
              keyboardShouldPersistTaps="handled"
              onMomentumScrollEnd={onMomentumEnd}
              showsHorizontalScrollIndicator={false}
              snapToInterval={pageWidth}
            >
              {weeks.map((days, page) => (
                <View
                  key={localDateValue(days[0])}
                  style={[styles.week, { width: pageWidth }]}
                >
                  {days.map((date) => {
                    const dateValue = localDateValue(date);
                    const active = dateValue === value;
                    const disabled = dateValue > today;
                    return (
                      <Pressable
                        accessibilityLabel={date.toLocaleDateString("en-US", {
                          weekday: "long",
                          month: "long",
                          day: "numeric",
                        })}
                        accessibilityRole="button"
                        accessibilityState={{ disabled, selected: active }}
                        disabled={disabled}
                        key={dateValue}
                        onPress={() => {
                          onChange(dateValue);
                          setOpen(false);
                        }}
                        style={[styles.day, active && styles.dayActive]}
                      >
                        <Text
                          style={[
                            styles.weekday,
                            disabled && styles.disabled,
                            active && styles.dayTextActive,
                          ]}
                        >
                          {date.toLocaleDateString("en-US", {
                            weekday: "narrow",
                          })}
                        </Text>
                        <Text
                          style={[
                            styles.dayNumber,
                            disabled && styles.disabled,
                            active && styles.dayTextActive,
                          ]}
                        >
                          {date.getDate()}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              ))}
            </ScrollView>
          ) : null}
          <Text style={styles.swipeHint}>SWIPE LEFT FOR EARLIER WEEKS</Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  trigger: {
    minHeight: 48,
    paddingHorizontal: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: Space.sm,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.xs,
    backgroundColor: Colors.surface,
  },
  triggerCopy: {
    minWidth: 0,
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: Space.sm,
  },
  triggerText: { ...TextStyles.listName, flexShrink: 1, color: Colors.text },
  picker: {
    marginTop: Space.sm,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.md,
    backgroundColor: Colors.surface,
  },
  pickerHeader: {
    paddingHorizontal: Space.md,
    paddingTop: Space.md,
    paddingBottom: Space.sm,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: Space.sm,
  },
  pickerEyebrow: {
    ...TextStyles.labelSmall,
    color: Colors.accent,
    letterSpacing: 1.1,
  },
  pickerRange: { ...TextStyles.caption, color: Colors.textSecondary },
  week: {
    paddingHorizontal: Space.sm,
    paddingBottom: Space.sm,
    flexDirection: "row",
    gap: 2,
  },
  day: {
    flex: 1,
    minHeight: 54,
    alignItems: "center",
    justifyContent: "center",
    gap: 3,
    borderRadius: Radius.sm,
  },
  dayActive: { backgroundColor: Colors.accent },
  weekday: {
    ...TextStyles.caption,
    color: Colors.muted,
    textTransform: "uppercase",
  },
  dayNumber: { ...TextStyles.listName, color: Colors.text },
  dayTextActive: { color: Colors.black },
  disabled: { color: Colors.mutedDark, opacity: 0.45 },
  swipeHint: {
    ...TextStyles.caption,
    paddingHorizontal: Space.md,
    paddingBottom: Space.md,
    color: Colors.mutedDark,
    letterSpacing: 0.6,
    textAlign: "center",
  },
});
