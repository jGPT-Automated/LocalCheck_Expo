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
 * is orange. Step a week back or a week ahead with the arrows. Used in the
 * court page header (`variant="header"`: today only, no title, stepper or
 * caption) and as Today in the expanded drawer.
 */
export function CourtBusyChart({
  courtId,
  games,
  title = "Busy times",
  height = 52,
  refreshKey,
  variant = "section",
  maxBack = DAYS_BACK,
  selected = null,
  onSelect,
}: {
  courtId: string;
  games: GameRun[];
  title?: string;
  height?: number;
  /** Re-read when this changes (presence changed). */
  refreshKey?: number | string;
  variant?: "section" | "header" | "inline";
  /** How many days back the arrows go (Home looks ahead only). */
  maxBack?: number;
  /** The tapped hour, highlighted when it is on the day being shown. */
  selected?: { dayOffset: number; hour: number } | null;
  /** Makes today-and-later bars tappable (past hours have no plans to show). */
  onSelect?: (pick: { dayOffset: number; hour: number }) => void;
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

  const caption = busyCaption(bars, dayOffset);
  const header = variant === "header";
  const inline = variant === "inline";
  const peak = bars.reduce((best, bar) => (bar.value > best.value ? bar : best), bars[0]);
  const peakCaption = peak && peak.value > 0 ? `Most active at ${peak.hour % 12 === 0 ? 12 : peak.hour % 12} ${peak.hour < 12 ? "AM" : "PM"}` : "Quiet day";

  return (
    <View>
      {header || inline ? null : <SectionHead meta={caption} title={title} />}
      {header ? null : (
      <View style={styles.stepper}>
          <Pressable
            accessibilityLabel="Previous day"
            accessibilityRole="button"
            disabled={dayOffset <= -maxBack}
            hitSlop={10}
            onPress={() => setDayOffset((day) => Math.max(-maxBack, day - 1))}
            style={[styles.step, dayOffset <= -maxBack && styles.stepOff]}
          >
            <View style={styles.stepRing}><Feather color={Colors.textSecondary} name="chevron-left" size={16} /></View>
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
            <View style={styles.stepRing}><Feather color={Colors.textSecondary} name="chevron-right" size={16} /></View>
          </Pressable>
        {inline ? <Text numberOfLines={1} style={styles.inlineCaption}>{peakCaption}</Text> : null}
          </View>
      )}
      <View
        accessibilityLabel={`${busyDayLabel(dayOffset, now)}: ${caption}`}
        style={[styles.bars, { height }]}
      >
        {bars.map((bar) => {
          const pickable = Boolean(onSelect) && bar.kind !== "past";
          const isSelected = selected?.dayOffset === dayOffset && selected.hour === bar.hour;
          return (
            <Pressable
              accessibilityLabel={`${hourLabel(bar.hour)}, ${bar.value} going`}
              accessibilityRole={pickable ? "button" : undefined}
              accessibilityState={{ selected: isSelected }}
              disabled={!pickable}
              key={bar.hour}
              onPress={() => onSelect?.({ dayOffset, hour: bar.hour })}
              style={styles.barSlot}
            >
              <View
                style={[
                  styles.bar,
                  { height: Math.max(3, Math.round((bar.value / max) * height)) },
                  bar.kind === "past" && styles.barPast,
                  bar.kind === "now" && styles.barNow,
                  bar.kind === "planned" && (bar.value > 0 ? styles.barPlanned : styles.barEmpty),
                  isSelected && styles.barSelected,
                ]}
              />
            </Pressable>
          );
        })}
      </View>
      {/* Labels sit centred under their bar but may be wider than it, so
          "Now" never clips to a bar's width. */}
      <View style={styles.labels}>
        {bars.map((bar, index) => {
          const show = bar.kind === "now" || (index % labelEvery === 0 && !bars.slice(Math.max(0, index - 1), index + 2).some((b) => b.kind === "now"));
          if (!show) return null;
          return (
            <Text
              key={bar.hour}
              numberOfLines={1}
              style={[styles.label, { left: `${((index + 0.5) / bars.length) * 100}%` }, bar.kind === "now" && styles.labelNow]}
            >
              {bar.kind === "now" ? "Now" : hourLabel(bar.hour)}
            </Text>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  stepper: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 8 },
  // A 44pt hit box around the 24pt ring; the negative margin keeps the row tight.
  step: { width: 44, height: 44, margin: -10, alignItems: "center", justifyContent: "center" },
  stepRing: { width: 24, height: 24, alignItems: "center", justifyContent: "center", borderRadius: 12, borderWidth: 1, borderColor: "rgba(242,242,246,0.12)" },
  stepOff: { opacity: 0.35 },
  dayLabel: { fontFamily: Typography.bodyBold, fontSize: 11, letterSpacing: 1.3, textTransform: "uppercase", color: Colors.textSecondary },
  dayLabelToday: { color: Colors.text },
  bars: { flexDirection: "row", alignItems: "flex-end", gap: 3 },
  inlineCaption: { flex: 1, minWidth: 0, textAlign: "right", fontFamily: Typography.bodySemiBold, fontSize: 11, color: Colors.muted },
  barSlot: { flex: 1, height: "100%", justifyContent: "flex-end" },
  bar: { borderRadius: 3 },
  barSelected: { borderWidth: 2, borderColor: Colors.text },
  barPast: { backgroundColor: Colors.grabber },
  barNow: { backgroundColor: Colors.accent },
  barPlanned: { borderWidth: 1, borderColor: Colors.inkSoft, backgroundColor: "transparent" },
  barEmpty: { backgroundColor: Colors.surfaceHigh },
  labels: { height: 12, marginTop: 6 },
  label: { position: "absolute", top: 0, width: 36, marginLeft: -18, textAlign: "center", fontFamily: Typography.bodyBold, fontSize: 11, lineHeight: 12, letterSpacing: 0.2, textTransform: "uppercase", color: Colors.muted },
  labelNow: { color: Colors.liveInk },
});
