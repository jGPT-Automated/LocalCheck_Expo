import { Feather } from "@expo/vector-icons";
import React from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";

import { Colors } from "@/constants/colors";
import type { GameRun } from "@/constants/data";
import { Typography } from "@/constants/typography";
import { useApp } from "@/context/AppContext";
import type { CourtActivityData } from "@/hooks/useCourtActivity";
import {
  chartHourAt,
  courtHourSlot,
  type CourtHourPick,
} from "@/lib/courtActivityModel";
import {
  busyCaption,
  busyDay,
  busyDayLabel,
  hourLabel,
} from "@/lib/courtBusyModel";

interface ChartProps {
  courtId: string;
  games: GameRun[];
  liveCount?: number;
  title?: string;
  height?: number;
  refreshKey?: number | string;
  variant?: "section" | "header" | "inline";
  maxBack?: number;
  selected?: CourtHourPick | null;
  onSelect?: (pick: CourtHourPick) => void;
  allowPast?: boolean;
  dayOffset?: number;
  onDayChange?: (day: number) => void;
  onNow?: () => void;
  /** Show the selected day, hour, and count as one dashboard header. */
  selectionHeader?: boolean;
  /** Feed supplies its snapshot so chart and rows cannot disagree. */
  data: CourtActivityData;
}

/** One day label, graph-end day arrows, tap/drag to scrub; vertical drags yield. */
export function CourtBusyChart({
  courtId,
  games,
  liveCount,
  height = 52,
  variant = "section",
  maxBack = 6,
  selected = null,
  onSelect,
  allowPast = false,
  dayOffset: controlledDay,
  onDayChange,
  onNow,
  selectionHeader = false,
  data,
}: ChartProps) {
  const [ownDay, setOwnDay] = React.useState(0);
  React.useEffect(() => setOwnDay(0), [courtId]);
  const dayOffset = controlledDay ?? ownDay;
  const width = React.useRef(1);
  const { currentUser } = useApp();
  const now = data.now;
  const header = variant === "header";
  const setDay = (day: number) => {
    const next = Math.max(-maxBack, Math.min(6, day));
    setOwnDay(next);
    onDayChange?.(next);
  };
  const bars = busyDay({
    dayOffset,
    now,
    spans: data.spans,
    planned: data.planned,
    games: [],
  }).map((bar) =>
    bar.kind === "now" && liveCount !== undefined
      ? { ...bar, value: liveCount }
      : bar.kind === "planned"
        ? {
            ...bar,
            value: courtHourSlot({
              courtId,
              now,
              pick: { dayOffset, hour: bar.hour },
              visits: data.visits,
              anonymousTimes: data.planned,
              games,
              meId: currentUser.id,
            }).total,
          }
        : bar,
  );
  const max = Math.max(4, ...bars.map((b) => b.value));
  const picked =
    selected?.dayOffset === dayOffset
      ? bars.find((b) => b.hour === selected.hour)
      : undefined;
  const caption = picked
    ? `${picked.kind === "now" ? "Now" : hourLabel(picked.hour)} · ${picked.value} ${picked.kind === "planned" ? "going" : "on court"}`
    : busyCaption(bars, dayOffset);
  // Gesture Handler can deliver a callback from the previous render after a
  // day change. Read the latest committed chart state when the gesture fires.
  const gestureState = React.useRef({ dayOffset, bars, selected, onSelect, allowPast, setDay });
  React.useLayoutEffect(() => {
    gestureState.current = { dayOffset, bars, selected, onSelect, allowPast, setDay };
  });
  const scrub = (x: number) => {
    const { dayOffset, bars, selected, onSelect, allowPast } = gestureState.current;
    const hour = chartHourAt(x, width.current, bars[0].hour, bars[bars.length - 1].hour);
    if (!allowPast && bars.find((bar) => bar.hour === hour)?.kind === "past")
      return;
    if (selected?.dayOffset !== dayOffset || selected.hour !== hour)
      onSelect?.({ dayOffset, hour });
  };
  const pan = Gesture.Pan()
    .enabled(Boolean(onSelect))
    .activeOffsetX([-8, 8])
    .failOffsetY([-8, 8])
    .runOnJS(true)
    .onStart((e) => scrub(e.x))
    .onUpdate((e) => scrub(e.x));
  const tap = Gesture.Tap()
    .enabled(Boolean(onSelect))
    .maxDistance(8)
    .runOnJS(true)
    .onEnd((e, success) => {
      if (success) scrub(e.x);
    });
  const daySwipe = Gesture.Pan()
    .enabled(!header)
    .activeOffsetX([-24, 24])
    .failOffsetY([-8, 8])
    .runOnJS(true)
    .onEnd((e) => {
      if (Math.abs(e.translationX) > 40) {
        const { dayOffset, setDay } = gestureState.current;
        setDay(dayOffset + (e.translationX < 0 ? 1 : -1));
      }
    });
  return (
    <View>
      {!header ? (
        <GestureDetector gesture={daySwipe}>
          <View style={[styles.heading, selectionHeader && picked && styles.selectionHeading]} testID="court-day-heading">
            {selectionHeader && picked ? (
              <>
                <Text accessibilityLiveRegion="polite" style={styles.selectionDay}>{busyDayLabel(dayOffset, now)}</Text>
                <View style={styles.selectionSummary}>
                  <Text numberOfLines={1} style={styles.selectionHour}>{`${picked.hour % 12 || 12} ${picked.hour < 12 ? "AM" : "PM"}`}</Text>
                  {data.loading ? <ActivityIndicator color={Colors.textSecondary} size="small" /> : (
                    <Text numberOfLines={1} style={styles.selectionCount}>{picked.value} {picked.kind === "planned" ? "going" : "on court"}</Text>
                  )}
                </View>
              </>
            ) : (
              <>
                <Text accessibilityLiveRegion="polite" style={styles.dayLabel}>{busyDayLabel(dayOffset, now)}</Text>
                {onNow ? <Pressable accessibilityRole="button" accessibilityLabel="Now" onPress={onNow} style={{ minWidth: 44, minHeight: 44, justifyContent: "center", alignItems: "center" }}><Text style={[styles.dayLabel, { color: Colors.liveInk }]}>Now</Text></Pressable> : null}
                {data.loading ? <ActivityIndicator color={Colors.textSecondary} size="small" /> : (
                  <Text numberOfLines={1} style={styles.caption}>{caption}</Text>
                )}
              </>
            )}
          </View>
        </GestureDetector>
      ) : null}
      <View style={styles.graphRow}>
        {!header ? (
          <DayArrow
            direction="left"
            disabled={dayOffset <= -maxBack}
            onPress={() => setDay(dayOffset - 1)}
          />
        ) : null}
        <GestureDetector gesture={Gesture.Race(pan, tap)}>
          <View
            accessible={Boolean(onSelect)}
            accessibilityRole={onSelect ? "adjustable" : undefined}
            accessibilityLabel={`${busyDayLabel(dayOffset, now)} activity, ${caption}`}
            accessibilityHint="Drag across the chart to select an hour"
            accessibilityValue={
              picked
                ? {
                    min: bars[0].hour,
                    max: bars[bars.length - 1].hour,
                    now: picked.hour,
                    text: hourLabel(picked.hour),
                  }
                : undefined
            }
            accessibilityActions={
              onSelect
                ? [
                    { name: "increment", label: "Next hour" },
                    { name: "decrement", label: "Previous hour" },
                  ]
                : undefined
            }
            onAccessibilityAction={(e) =>
              onSelect?.({
                dayOffset,
                hour: Math.max(
                  6,
                  Math.min(
                    22,
                    (picked?.hour ?? new Date(now).getHours()) +
                      (e.nativeEvent.actionName === "increment" ? 1 : -1),
                  ),
                ),
              })
            }
            onLayout={(e) => {
              width.current = e.nativeEvent.layout.width;
            }}
            style={styles.graph}
            testID="court-time-chart"
          >
            <View pointerEvents="none">
              <View style={[styles.bars, { height: Math.max(44, height) }]}>
                {bars.map((bar) => (
                  <View key={bar.hour} style={styles.barSlot}>
                    <View
                      style={[
                        styles.bar,
                        {
                          height: Math.max(
                            4,
                            Math.round((bar.value / max) * height),
                          ),
                        },
                        bar.kind === "past" && styles.barPast,
                        bar.kind === "now" && styles.barNow,
                        bar.kind === "planned" && styles.barPlanned,
                        picked?.hour === bar.hour && styles.barSelected,
                      ]}
                    />
                  </View>
                ))}
              </View>
              <View style={styles.labels}>
                {bars.map((bar, i) => {
                  const show =
                    bar.kind === "now" ||
                    (i % 4 === 0 &&
                      !bars
                        .slice(Math.max(0, i - 1), i + 2)
                        .some((b) => b.kind === "now"));
                  return show ? (
                    <Text
                      key={bar.hour}
                      style={[
                        styles.label,
                        { left: `${((i + 0.5) / bars.length) * 100}%` },
                        bar.kind === "now" && styles.labelNow,
                      ]}
                    >
                      {bar.kind === "now" ? "Now" : hourLabel(bar.hour)}
                    </Text>
                  ) : null;
                })}
              </View>
            </View>
          </View>
        </GestureDetector>
        {!header ? (
          <DayArrow
            direction="right"
            disabled={dayOffset >= 6}
            onPress={() => setDay(dayOffset + 1)}
          />
        ) : null}
      </View>
      {data.error ? (
        <Pressable
          accessibilityRole="button"
          onPress={data.refresh}
          style={styles.retry}
        >
          <Text style={styles.retryText}>
            Couldn't load activity. Try again.
          </Text>
        </Pressable>
      ) : null}
    </View>
  );
}
function DayArrow({
  direction,
  disabled,
  onPress,
}: {
  direction: "left" | "right";
  disabled: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityLabel={direction === "left" ? "Previous day" : "Next day"}
      accessibilityRole="button"
      disabled={disabled}
      onPress={onPress}
      style={[styles.step, disabled && styles.stepOff]}
    >
      <Feather
        name={direction === "left" ? "chevron-left" : "chevron-right"}
        color={Colors.textSecondary}
        size={18}
      />
    </Pressable>
  );
}
const styles = StyleSheet.create({
  heading: {
    minHeight: 32,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  selectionHeading: { minHeight: 0, alignItems: "stretch", flexDirection: "column", gap: 2, marginBottom: 8 },
  selectionDay: { fontFamily: Typography.bodyBold, fontSize: 11, letterSpacing: 1.3, textTransform: "uppercase", color: Colors.textSecondary },
  selectionSummary: { flexDirection: "row", alignItems: "baseline", justifyContent: "space-between", gap: 10 },
  selectionHour: { flexShrink: 1, fontFamily: Typography.headingSemiBold, fontSize: 20, color: Colors.text },
  selectionCount: { fontFamily: Typography.bodyMedium, fontSize: 12, color: Colors.textSecondary },
  dayLabel: {
    fontFamily: Typography.bodyBold,
    fontSize: 11,
    letterSpacing: 1.3,
    textTransform: "uppercase",
    color: Colors.text,
  },
  caption: {
    flex: 1,
    minWidth: 0,
    textAlign: "right",
    fontFamily: Typography.bodyMedium,
    fontSize: 11,
    color: Colors.textSecondary,
  },
  graphRow: {
    flexDirection: "row",
    alignItems: "center",
    marginHorizontal: -16,
  },
  step: {
    width: 44,
    height: 60,
    alignItems: "center",
    justifyContent: "center",
  },
  stepOff: { opacity: 0.35 },
  graph: { flex: 1, minWidth: 0 },
  bars: { flexDirection: "row", alignItems: "flex-end", gap: 3 },
  barSlot: { flex: 1, minWidth: 0 },
  bar: { borderRadius: 3 },
  barPast: { backgroundColor: Colors.grabber },
  barNow: { backgroundColor: Colors.accent },
  barPlanned: {
    borderWidth: 1,
    borderColor: Colors.borderLight,
    backgroundColor: "transparent",
  },
  barSelected: { borderWidth: 2, borderColor: Colors.text },
  labels: { height: 18, marginTop: 6 },
  label: {
    position: "absolute",
    width: 32,
    marginLeft: -16,
    fontFamily: Typography.bodyBold,
    fontSize: 11,
    textAlign: "center",
    color: Colors.muted,
  },
  labelNow: { color: Colors.liveInk },
  retry: { minHeight: 44, justifyContent: "center" },
  retryText: {
    fontFamily: Typography.bodyMedium,
    fontSize: 12,
    color: Colors.textSecondary,
  },
});
