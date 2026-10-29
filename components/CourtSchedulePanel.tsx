import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import { SlotCard, type SlotAttendee } from "@/components/court/SlotCard";
import { Colors } from "@/constants/colors";
import type { Court, GameRun } from "@/constants/data";
import { Layout } from "@/constants/layout";
import { Typography } from "@/constants/typography";
import { useApp } from "@/context/AppContext";
import { fetchCourtPlannedTimes } from "@/services/plannedVisitService";

const DAYS = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"];
/** Two-hour rows, 7 AM to 11 PM; a row covers its start hour and the next. */
const ROW_HOURS = [7, 9, 11, 13, 15, 17, 19, 21];
const FIRST_HOUR = ROW_HOURS[0];
const LAST_HOUR = 22;
const LEGEND = [Colors.heat0, Colors.heat1, Colors.heat2, Colors.heat3, Colors.accent];

interface SlotEntry {
  attendees: SlotAttendee[];
  plannedVisible: number;
  runs: GameRun[];
}

function rowLabel(hour: number): string {
  return `${hour % 12 === 0 ? 12 : hour % 12}${hour >= 12 ? "P" : "A"}`;
}

function longLabel(hour: number): string {
  return `${hour % 12 === 0 ? 12 : hour % 12} ${hour >= 12 ? "PM" : "AM"}`;
}

/** 0 quiet … 4 busiest, the five swatches in the legend. */
function heatLevel(count: number): number {
  if (count >= 7) return 4;
  if (count >= 4) return 3;
  if (count >= 2) return 2;
  return count >= 1 ? 1 : 0;
}

/**
 * Week › planned visits: Monday to Sunday across, two-hour rows down, busier
 * cells brighter, a white dot where a game is scheduled. The selected slot's
 * card below lists who's going and the games, with a + to add yourself.
 */
export function CourtSchedulePanel({
  court,
  bottomInset = 0,
}: {
  court: Court;
  /** Space under the last card (the home-indicator inset). */
  bottomInset?: number;
}) {
  const { currentUser, plannedVisits, runs } = useApp();
  const dayStamp = new Date().toDateString();
  const weekStart = useMemo(() => {
    const value = new Date(dayStamp);
    value.setHours(0, 0, 0, 0);
    value.setDate(value.getDate() - ((value.getDay() + 6) % 7)); // Monday
    return value;
  }, [dayStamp]);
  const weekDays = useMemo(
    () =>
      Array.from({ length: 7 }, (_, index) => {
        const value = new Date(weekStart);
        value.setDate(weekStart.getDate() + index);
        return value;
      }),
    [weekStart],
  );
  const todayIndex = (new Date(dayStamp).getDay() + 6) % 7;
  const nowHour = new Date().getHours();
  const currentRow = Math.max(0, Math.min(ROW_HOURS.length - 1, Math.floor((nowHour - FIRST_HOUR) / 2)));
  const [selected, setSelected] = useState({ day: todayIndex, row: currentRow });
  const [plannedBuckets, setPlannedBuckets] = useState<Record<string, number>>({});

  const bucketKey = useCallback(
    (iso: string): string | null => {
      const value = new Date(iso);
      const localDay = new Date(value);
      localDay.setHours(0, 0, 0, 0);
      const day = Math.round((localDay.getTime() - weekStart.getTime()) / 86_400_000);
      const hour = value.getHours();
      if (day < 0 || day > 6 || hour < FIRST_HOUR || hour > LAST_HOUR) return null;
      return `${day}:${Math.floor((hour - FIRST_HOUR) / 2)}`;
    },
    [weekStart],
  );

  useEffect(() => {
    let cancelled = false;
    const end = new Date(weekStart);
    end.setDate(end.getDate() + 7);
    void fetchCourtPlannedTimes(court.id, weekStart, end).then((times) => {
      if (cancelled) return;
      const next: Record<string, number> = {};
      times.forEach((time) => {
        const key = bucketKey(time.toISOString());
        if (key) next[key] = (next[key] ?? 0) + 1;
      });
      setPlannedBuckets(next);
    });
    return () => {
      cancelled = true;
    };
  }, [court.id, weekStart, bucketKey, plannedVisits]);

  const slotMap = useMemo(() => {
    const map = new Map<string, SlotEntry>();
    const entryFor = (key: string) => {
      const entry = map.get(key) ?? { attendees: [], plannedVisible: 0, runs: [] };
      map.set(key, entry);
      return entry;
    };
    const add = (iso: string, attendee: SlotAttendee, planned: boolean) => {
      const key = bucketKey(iso);
      if (!key) return;
      const entry = entryFor(key);
      const existing = entry.attendees.find((item) => item.id === attendee.id);
      if (!existing) {
        entry.attendees.push(attendee);
        if (planned) entry.plannedVisible += 1;
      } else if (attendee.visitId && !existing.visitId) {
        existing.visitId = attendee.visitId;
      }
    };
    plannedVisits.forEach((visit) => {
      if (visit.courtId !== court.id) return;
      add(
        visit.plannedAtIso,
        {
          id: visit.userId,
          name: visit.player.name,
          initials: visit.player.avatar,
          isMine: visit.userId === currentUser.id,
          visitId: visit.id,
        },
        true,
      );
    });
    runs.forEach((run) => {
      if (run.courtId !== court.id) return;
      const key = bucketKey(run.startTimeIso);
      if (key) entryFor(key).runs.push(run);
      run.participants.forEach((player) =>
        add(
          run.startTimeIso,
          { id: player.id, name: player.name, initials: player.avatar, isMine: player.id === currentUser.id },
          false,
        ),
      );
    });
    return map;
  }, [bucketKey, court.id, currentUser.id, plannedVisits, runs]);

  const hiddenCount = useCallback(
    (key: string) =>
      Math.max(0, (plannedBuckets[key] ?? 0) - (slotMap.get(key)?.plannedVisible ?? 0)),
    [plannedBuckets, slotMap],
  );
  const slotTotal = useCallback(
    (key: string) => (slotMap.get(key)?.attendees.length ?? 0) + hiddenCount(key),
    [hiddenCount, slotMap],
  );

  let busiest: { key: string; total: number } | null = null;
  for (let day = 0; day < 7; day += 1) {
    for (let row = 0; row < ROW_HOURS.length; row += 1) {
      const key = `${day}:${row}`;
      const total = slotTotal(key);
      if (total > (busiest?.total ?? 0)) busiest = { key, total };
    }
  }
  const busiestLabel = busiest
    ? (() => {
        const [day, row] = busiest.key.split(":").map(Number);
        return `Busiest: ${DAYS[weekDays[day].getDay()]} ${longLabel(ROW_HOURS[row])}`;
      })()
    : "No plans yet";

  const selectedKey = `${selected.day}:${selected.row}`;
  const selectedEntry = slotMap.get(selectedKey);
  const selectedRuns = selectedEntry?.runs ?? [];
  const myVisit = selectedEntry?.attendees.find((attendee) => attendee.isMine && attendee.visitId);
  const selectedDate = new Date(weekDays[selected.day]);
  selectedDate.setHours(ROW_HOURS[selected.row], 0, 0, 0);
  const slotTitle = `${selected.day === todayIndex ? "Today" : DAYS[selectedDate.getDay()]} · ${longLabel(ROW_HOURS[selected.row])}`;

  return (
    <ScrollView
      alwaysBounceVertical={false}
      contentContainerStyle={[styles.panel, { paddingBottom: bottomInset + 12 }]}
      showsVerticalScrollIndicator={false}
      style={styles.scroll}
    >
      <View style={styles.card}>
        <View style={styles.cardHead}>
          <Text style={styles.cardTitle}>Planned visits · this week</Text>
          <Text numberOfLines={1} style={styles.cardMeta}>{busiestLabel}</Text>
        </View>
        <View style={styles.gridRow}>
          <View style={styles.timeColumn} />
          {weekDays.map((date, index) => (
            <Text key={date.toISOString()} style={[styles.dayName, index === todayIndex && styles.dayToday]}>
              {DAYS[date.getDay()]}
            </Text>
          ))}
        </View>
        {ROW_HOURS.map((hour, row) => (
          <View key={hour} style={styles.gridRow}>
            <View style={styles.timeColumn}>
              <Text style={styles.timeLabel}>{rowLabel(hour)}</Text>
            </View>
            {weekDays.map((date, day) => {
              const key = `${day}:${row}`;
              const count = slotTotal(key);
              const runCount = slotMap.get(key)?.runs.length ?? 0;
              const active = selected.day === day && selected.row === row;
              const cellEnd = new Date(date);
              cellEnd.setHours(hour + 2, 0, 0, 0);
              const past = cellEnd.getTime() <= Date.now();
              return (
                <Pressable
                  accessibilityLabel={`${DAYS[date.getDay()]} ${date.getDate()}, ${longLabel(hour)}, ${count} going${runCount > 0 ? `, ${runCount} scheduled ${runCount === 1 ? "game" : "games"}` : ""}`}
                  accessibilityRole="button"
                  accessibilityState={{ selected: active, disabled: past }}
                  disabled={past}
                  key={key}
                  onPress={() => {
                    setSelected({ day, row });
                  }}
                  style={[
                    styles.cell,
                    { backgroundColor: LEGEND[heatLevel(count)] },
                    past && styles.cellPast,
                    active && styles.cellSelected,
                  ]}
                  testID={`week-${day}-${row}`}
                >
                  {runCount > 0 ? <View style={styles.gameDot} /> : null}
                </Pressable>
              );
            })}
          </View>
        ))}
        <View style={styles.legend}>
          <View style={styles.legendScale}>
            <Text style={styles.legendText}>Fewer</Text>
            {LEGEND.map((color) => (
              <View key={color} style={[styles.swatch, { backgroundColor: color }]} />
            ))}
            <Text style={styles.legendText}>More</Text>
          </View>
          <View style={styles.legendScale}>
            <View style={styles.gameDot2} />
            <Text style={styles.legendText}>Game</Text>
          </View>
        </View>
      </View>

      <SlotCard
        attendees={selectedEntry?.attendees ?? []}
        hidden={hiddenCount(selectedKey)}
        mine={Boolean(myVisit)}
        mode="view"
        runs={selectedRuns}
        title={slotTitle}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1, minHeight: 0 },
  panel: { paddingHorizontal: Layout.screenGutter - 8, paddingTop: 12, gap: 12 },
  card: {
    padding: 14,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: Colors.hairlineCard,
    backgroundColor: Colors.panel,
  },
  cardHead: { marginBottom: 10, flexDirection: "row", alignItems: "baseline", justifyContent: "space-between", gap: 10 },
  cardTitle: { fontFamily: Typography.bodyBold, fontSize: 11, letterSpacing: 1.2, textTransform: "uppercase", color: Colors.text },
  cardMeta: { flexShrink: 1, fontFamily: Typography.bodySemiBold, fontSize: 11, color: Colors.muted },
  gridRow: { flexDirection: "row", alignItems: "center", gap: 4, marginBottom: 4 },
  timeColumn: { width: 26 },
  timeLabel: { fontFamily: Typography.bodyBold, fontSize: 11, color: Colors.muted },
  dayName: { flex: 1, flexBasis: 0, textAlign: "center", fontFamily: Typography.bodyBold, fontSize: 11, letterSpacing: 0.4, color: Colors.muted },
  dayToday: { color: Colors.text },
  cell: {
    flex: 1,
    flexBasis: 0,
    height: 34,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: "transparent",
  },
  cellPast: { opacity: 0.4 },
  cellSelected: { borderColor: Colors.text, opacity: 1 },
  gameDot: { position: "absolute", top: 3, right: 3, width: 7, height: 7, borderRadius: 4, backgroundColor: Colors.text },
  gameDot2: { width: 7, height: 7, borderRadius: 4, backgroundColor: Colors.text },
  legend: { marginTop: 6, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  legendScale: { flexDirection: "row", alignItems: "center", gap: 5 },
  legendText: { fontFamily: Typography.bodySemiBold, fontSize: 11, color: Colors.muted },
  swatch: { width: 11, height: 11, borderRadius: 3, borderWidth: StyleSheet.hairlineWidth, borderColor: Colors.hairlineChrome },
});
