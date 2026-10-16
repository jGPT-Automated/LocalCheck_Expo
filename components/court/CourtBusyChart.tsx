import { Feather } from "@expo/vector-icons";
import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { SectionHead } from "@/components/court/CourtParts";
import { Colors } from "@/constants/colors";
import type { GameRun } from "@/constants/data";
import { Typography } from "@/constants/typography";
import type { CheckInSpan } from "@/lib/courtHours";
import { busyCaption, busyDay, busyDayLabel, hourLabel } from "@/lib/courtBusyModel";
import { fetchCourtWeekSpans } from "@/services/courtService";
import { fetchCourtPlannedTimes } from "@/services/plannedVisitService";

const DAYS_BACK = 6;
const DAYS_AHEAD = 6;

/**
 * How busy the court gets through a day, like a maps app's popular times.
 * Hours gone show who was actually on court (check-ins), hours ahead show
 * planned visits plus players signed up for games (outlined), and this hour
 * is orange. Step a week back or a week ahead with the arrows. Used at the
 * top of the court page's Live tab and as Today in the expanded drawer.
 */
export function CourtBusyChart({
  courtId,
  games,
  title = "Busy times",
  height = 52,
  refreshKey,
}: {
  courtId: string;
  games: GameRun[];
  title?: string;
  height?: number;
  /** Re-read when this changes (presence changed). */
  refreshKey?: number | string;
}) {
  const [dayOffset, setDayOffset] = React.useState(0);
  const [spans, setSpans] = React.useState<CheckInSpan[]>([]);
  const [planned, setPlanned] = React.useState<Date[]>([]);

  React.useEffect(() => {
    let cancelled = false;
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    const end = new Date(start);
    end.setDate(end.getDate() + DAYS_AHEAD + 1);
    void Promise.all([fetchCourtWeekSpans(courtId), fetchCourtPlannedTimes(courtId, start, end)]).then(
      ([nextSpans, nextPlanned]) => {
        if (cancelled) return;
        setSpans(nextSpans);
        setPlanned(nextPlanned);
      },
    );
    return () => { cancelled = true; };
  }, [courtId, refreshKey]);

  const now = Date.now();
  const bars = busyDay({
    dayOffset,
    now,
    spans,
    planned,
    games: games.map((game) => ({ startIso: game.startTimeIso, going: game.participants.length })),
  });
  const max = Math.max(4, ...bars.map((bar) => bar.value));
  const labelEvery = 4;

  return (
    <View>
      <SectionHead meta={busyCaption(bars, dayOffset)} title={title} />
      <View style={styles.stepper}>
        <Pressable
          accessibilityLabel="Previous day"
          accessibilityRole="button"
          disabled={dayOffset <= -DAYS_BACK}
          hitSlop={10}
          onPress={() => setDayOffset((day) => Math.max(-DAYS_BACK, day - 1))}
          style={[styles.step, dayOffset <= -DAYS_BACK && styles.stepOff]}
        >
          <Feather color={Colors.textSecondary} name="chevron-left" size={16} />
        </Pressable>
        <Text style={[styles.dayLabel, dayOffset === 0 && styles.dayLabelToday]}>{busyDayLabel(dayOffset, now)}</Text>
        <Pressable
          accessibilityLabel="Next day"
          accessibilityRole="button"
          disabled={dayOffset >= DAYS_AHEAD}
          hitSlop={10}
          onPress={() => setDayOffset((day) => Math.min(DAYS_AHEAD, day + 1))}
          style={[styles.step, dayOffset >= DAYS_AHEAD && styles.stepOff]}
        >
          <Feather color={Colors.textSecondary} name="chevron-right" size={16} />
        </Pressable>
      </View>
      <View
        accessibilityLabel={`${busyDayLabel(dayOffset, now)}: ${busyCaption(bars, dayOffset)}`}
        style={[styles.bars, { height }]}
      >
        {bars.map((bar) => (
          <View
            key={bar.hour}
            style={[
              styles.bar,
              { height: Math.max(3, Math.round((bar.value / max) * height)) },
              bar.kind === "past" && styles.barPast,
              bar.kind === "now" && styles.barNow,
              bar.kind === "planned" && (bar.value > 0 ? styles.barPlanned : styles.barEmpty),
            ]}
          />
        ))}
      </View>
      <View style={styles.labels}>
        {bars.map((bar, index) => {
          const show = bar.kind === "now" || (index % labelEvery === 0 && !bars.slice(Math.max(0, index - 1), index + 2).some((b) => b.kind === "now"));
          return (
            <Text key={bar.hour} numberOfLines={1} style={[styles.label, bar.kind === "now" && styles.labelNow]}>
              {show ? (bar.kind === "now" ? "Now" : hourLabel(bar.hour)) : ""}
            </Text>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  stepper: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 8 },
  step: { width: 24, height: 24, alignItems: "center", justifyContent: "center", borderRadius: 12, borderWidth: 1, borderColor: "rgba(242,242,246,0.12)" },
  stepOff: { opacity: 0.35 },
  dayLabel: { fontFamily: Typography.bodyBold, fontSize: 9.5, letterSpacing: 1.3, textTransform: "uppercase", color: Colors.textSecondary },
  dayLabelToday: { color: Colors.text },
  bars: { flexDirection: "row", alignItems: "flex-end", gap: 3 },
  bar: { flex: 1, borderRadius: 3 },
  barPast: { backgroundColor: Colors.grabber },
  barNow: { backgroundColor: Colors.accent },
  barPlanned: { borderWidth: 1, borderColor: Colors.inkSoft, backgroundColor: "transparent" },
  barEmpty: { backgroundColor: Colors.surfaceHigh },
  labels: { flexDirection: "row", gap: 3, marginTop: 5 },
  label: { flex: 1, textAlign: "center", fontFamily: Typography.bodyBold, fontSize: 7.5, letterSpacing: 0.4, textTransform: "uppercase", color: Colors.muted },
  labelNow: { color: Colors.liveInk },
});
