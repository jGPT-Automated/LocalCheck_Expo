import { Feather } from "@expo/vector-icons";
import { router } from "expo-router";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import { Colors, Radius } from "@/constants/colors";
import { Court, GameRun } from "@/constants/data";
import { Typography } from "@/constants/typography";
import { useApp } from "@/context/AppContext";
import { fetchCourtPlannedTimes } from "@/services/plannedVisitService";
import { scheduleSlotIndex, scheduleSlotLabel, SLOT_HOURS } from "@/components/schedule/scheduleModel";
import { formatForMaxPlayers } from "@/components/schedule/scheduledGameModel";
import { PlayerAvatar } from "./PlayerAvatar";

const DAYS = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"];
interface SlotAttendee {
  id: string;
  name: string;
  initials: string;
  isMine: boolean;
  visitId?: string;
}

interface SlotEntry {
  attendees: SlotAttendee[];
  plannedVisible: number;
  runCount: number;
  runs: GameRun[];
}

export function CourtSchedulePanel({
  court,
  interactive = true,
}: {
  court: Court;
  interactive?: boolean;
}) {
  const {
    currentUser,
    plannedVisits,
    runs,
    addPlannedVisit,
    removePlannedVisit,
  } = useApp();
  const currentSlot = Math.max(
    0,
    Math.min(
      SLOT_HOURS.length - 1,
      scheduleSlotIndex(new Date().getHours()),
    ),
  );
  const [selected, setSelected] = useState<{
    day: number;
    slot: number;
  } | null>({ day: 0, slot: currentSlot });
  const [plannedBuckets, setPlannedBuckets] = useState<Record<string, number>>(
    {},
  );
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const dayStamp = new Date().toDateString();
  const weekStart = useMemo(() => {
    const value = new Date(dayStamp);
    value.setHours(0, 0, 0, 0);
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
  const monthLabel = useMemo(
    () =>
      weekDays[0]
        .toLocaleDateString("en-US", { month: "short" })
        .toUpperCase(),
    [weekDays],
  );

  const bucketKey = useCallback(
    (iso: string): string | null => {
      const value = new Date(iso);
      const localDay = new Date(value);
      localDay.setHours(0, 0, 0, 0);
      const day = Math.round(
        (localDay.getTime() - weekStart.getTime()) / 86_400_000,
      );
      if (day < 0 || day > 6) return null;
      const hour = value.getHours();
      if (hour < SLOT_HOURS[0] || hour >= SLOT_HOURS[SLOT_HOURS.length - 1] + 1)
        return null;
      return `${day}:${hour - SLOT_HOURS[0]}`;
    },
    [weekStart],
  );

  useEffect(() => {
    let cancelled = false;
    const end = new Date(weekStart);
    end.setDate(end.getDate() + 7);
    fetchCourtPlannedTimes(court.id, weekStart, end).then((times) => {
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
    const add = (iso: string, attendee: SlotAttendee, planned: boolean) => {
      const key = bucketKey(iso);
      if (!key) return;
      const entry = map.get(key) ?? {
        attendees: [],
        plannedVisible: 0,
        runCount: 0,
        runs: [],
      };
      const existing = entry.attendees.find((item) => item.id === attendee.id);
      if (!existing) {
        entry.attendees.push(attendee);
        if (planned) entry.plannedVisible += 1;
      } else if (attendee.visitId && !existing.visitId) {
        existing.visitId = attendee.visitId;
      }
      map.set(key, entry);
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
      if (key) {
        const entry = map.get(key) ?? {
          attendees: [],
          plannedVisible: 0,
          runCount: 0,
          runs: [],
        };
        entry.runCount += 1;
        entry.runs.push(run);
        map.set(key, entry);
      }
      run.participants.forEach((player) =>
        add(
          run.startTimeIso,
          {
            id: player.id,
            name: player.name,
            initials: player.avatar,
            isMine: player.id === currentUser.id,
          },
          false,
        ),
      );
    });
    return map;
  }, [bucketKey, court.id, currentUser.id, plannedVisits, runs]);

  const hiddenCount = useCallback(
    (key: string) => {
      const anonymousCount = plannedBuckets[key] ?? 0;
      const visiblePlanned = slotMap.get(key)?.plannedVisible ?? 0;
      return Math.max(0, anonymousCount - visiblePlanned);
    },
    [plannedBuckets, slotMap],
  );
  const slotTotal = useCallback(
    (key: string) =>
      (slotMap.get(key)?.attendees.length ?? 0) + hiddenCount(key),
    [hiddenCount, slotMap],
  );

  const selectedKey = selected ? `${selected.day}:${selected.slot}` : null;
  const selectedEntry = selectedKey ? slotMap.get(selectedKey) : undefined;
  const selectedRuns = selectedEntry?.runs ?? [];
  const myVisit = selectedEntry?.attendees.find(
    (attendee) => attendee.isMine && attendee.visitId,
  );
  const selectedDate = selected ? new Date(weekDays[selected.day]) : null;
  if (selectedDate && selected)
    selectedDate.setHours(SLOT_HOURS[selected.slot], 0, 0, 0);

  const handleAttendance = async () => {
    if (!selectedDate || saving) return;
    const plannedAt = new Date(
      Math.max(selectedDate.getTime(), Date.now() + 60_000),
    );
    setSaving(true);
    setNotice(null);
    const ok = myVisit?.visitId
      ? await removePlannedVisit(myVisit.visitId)
      : await addPlannedVisit(
          court.id,
          plannedAt.toISOString(),
          undefined,
          "public",
        );
    setSaving(false);
    if (!ok) setNotice("COULD NOT SAVE YOUR TIME. TRY AGAIN.");
  };

  const heatStyle = (count: number) => {
    if (count >= 5) return styles.heatHigh;
    if (count >= 2) return styles.heatMid;
    if (count >= 1) return styles.heatLow;
    return null;
  };

  return (
    <View style={styles.panel}>
      <View style={styles.heatmap}>
        <View style={styles.heatRow}>
          <View style={[styles.timeColumn, styles.monthCorner]}>
            <Text style={styles.monthLabel}>{monthLabel}</Text>
          </View>
          {weekDays.map((date, index) => (
            <View key={date.toISOString()} style={styles.dayHeader}>
              <Text style={[styles.dayName, index === 0 && styles.today]}>
                {DAYS[date.getDay()]}
              </Text>
              <Text style={[styles.dayDate, index === 0 && styles.today]}>
                {date.getDate()}
              </Text>
            </View>
          ))}
        </View>
        <View style={styles.scrollCue} pointerEvents="none">
          <Feather color={Colors.muted} name="chevrons-down" size={12} />
        </View>
        <ScrollView
          contentContainerStyle={styles.timeRows}
          nestedScrollEnabled
          showsVerticalScrollIndicator={false}
          style={styles.timeScroller}
        >
        {SLOT_HOURS.map((hour, slot) => (
          <View key={hour} style={styles.heatRow}>
            <View style={styles.timeColumn}>
              <Text style={styles.timeLabel}>{scheduleSlotLabel(hour)}</Text>
            </View>
            {weekDays.map((date, day) => {
              const key = `${day}:${slot}`;
              const count = slotTotal(key);
              const active = selected?.day === day && selected.slot === slot;
              const cellDate = new Date(date);
              cellDate.setHours(hour + 1, 0, 0, 0);
              const past = cellDate.getTime() <= Date.now();
              return (
                <Pressable
                  key={key}
                  onPress={() => {
                    setSelected({ day, slot });
                    setNotice(null);
                  }}
                  disabled={past}
                  style={[
                    styles.cell,
                    heatStyle(count),
                    active && styles.cellSelected,
                    past && styles.cellPast,
                  ]}
                  accessibilityRole="button"
                  accessibilityLabel={`${DAYS[date.getDay()]} ${date.getDate()}, ${scheduleSlotLabel(hour)}, ${count} going${(slotMap.get(key)?.runCount ?? 0) > 0 ? `, ${slotMap.get(key)?.runCount} scheduled ${(slotMap.get(key)?.runCount ?? 0) === 1 ? "game" : "games"}` : ""}`}
                  accessibilityState={{
                    selected: active,
                    disabled: past,
                  }}
                >
                  {(active || count >= 5) && count > 0 ? (
                    <Text style={styles.cellCount}>{count}</Text>
                  ) : null}
                  {(slotMap.get(key)?.runCount ?? 0) > 0 ? (
                    <View style={styles.runBadge}>
                      <Feather color={Colors.black} name="calendar" size={9} />
                    </View>
                  ) : null}
                </Pressable>
              );
            })}
          </View>
        ))}
        </ScrollView>
        <View style={styles.legend}>
          <View style={styles.legendScale}>
            <Text style={styles.legendText}>QUIET</Text>
            {[
              Colors.surface,
              Colors.accentDim,
              Colors.accentGlow,
              Colors.accent,
            ].map((color) => (
              <View
                key={color}
                style={[styles.legendSwatch, { backgroundColor: color }]}
              />
            ))}
            <Text style={styles.legendText}>BUSY</Text>
          </View>
          <Text style={styles.legendText}>LOCAL TIME</Text>
        </View>
      </View>

      {selected && selectedKey && selectedDate ? (
        <View style={styles.slotCard}>
          <View style={styles.slotHeader}>
            <Text style={styles.slotTitle}>
              {DAYS[selectedDate.getDay()]} {selectedDate.getDate()} · {scheduleSlotLabel(SLOT_HOURS[selected.slot])}
            </Text>
            <Text style={styles.slotMeta}>
              {slotTotal(selectedKey)} GOING
              {selectedRuns.length > 0
                ? ` · ${selectedRuns.length} ${selectedRuns.length === 1 ? "GAME" : "GAMES"}`
                : ""}
            </Text>
          </View>
          <View style={styles.slotContent}>
            <View style={styles.peopleArea}>
              <Text style={styles.sectionLabel}>WHO'S GOING</Text>
              <ScrollView
                contentContainerStyle={styles.avatars}
                horizontal
                showsHorizontalScrollIndicator={false}
              >
                {(selectedEntry?.attendees ?? []).slice(0, 5).map((attendee) => (
                  <Pressable
                    key={attendee.id}
                    style={styles.avatar}
                    onPress={() => router.push(`/player/${attendee.id}`)}
                  >
                    <PlayerAvatar
                      initials={attendee.initials}
                      name={attendee.name}
                      playerId={attendee.id}
                      size={30}
                      accent={attendee.isMine}
                    />
                    <Text style={styles.avatarName} numberOfLines={1}>
                      {attendee.isMine ? "YOU" : attendee.name.split(" ")[0]}
                    </Text>
                  </Pressable>
                ))}
                {hiddenCount(selectedKey) > 0 ? (
                  <View style={styles.avatar}>
                    <View style={styles.hiddenAvatar}>
                      <Text style={styles.hiddenText}>
                        +{hiddenCount(selectedKey)}
                      </Text>
                    </View>
                    <Text style={styles.avatarName}>PRIVATE</Text>
                  </View>
                ) : null}
                {slotTotal(selectedKey) === 0 ? (
                  <Text style={styles.empty}>NOBODY YET.</Text>
                ) : null}
              </ScrollView>
            </View>
            <View style={styles.gameArea}>
              <Text style={styles.sectionLabel}>{selectedRuns.length === 1 ? "GAME" : "GAMES"}</Text>
              {selectedRuns.length > 0 ? (
                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                  {selectedRuns.map((run) => {
                    const format = formatForMaxPlayers(run.maxPlayers) ?? "GAME";
                    const spots = Math.max(0, run.maxPlayers - run.participants.length);
                    return (
                      <Pressable
                        accessibilityHint="Opens scheduled game details"
                        accessibilityLabel={`${format}, ${run.participants.length} joined, ${spots} open`}
                        accessibilityRole="button"
                        key={run.id}
                        onPress={() => router.push(`/run/${run.id}`)}
                        style={({ pressed }) => [styles.gameTile, pressed && styles.gameTilePressed]}
                      >
                        <View style={styles.gameIcon}>
                          <Feather color={Colors.black} name="calendar" size={11} />
                        </View>
                        <View style={styles.gameCopy}>
                          <Text style={styles.gameTitle}>{format}</Text>
                          <Text style={styles.gameMeta}>{run.participants.length}/{run.maxPlayers} JOINED · {spots} OPEN</Text>
                        </View>
                        <Feather color={Colors.textSecondary} name="chevron-right" size={13} />
                      </Pressable>
                    );
                  })}
                </ScrollView>
              ) : (
                <Text style={styles.noGame}>NO GAME SCHEDULED</Text>
              )}
            </View>
          </View>
          {interactive ? (
            <View style={styles.actions}>
              <Pressable
                style={[styles.action, (!selectedDate || saving) && styles.actionDisabled]}
                onPress={() => void handleAttendance()}
                disabled={!selectedDate || saving}
              >
                <Text style={styles.actionText}>
                  {saving ? "SAVING…" : myVisit ? "I'M NOT COMING" : "I'M COMING"}
                </Text>
              </Pressable>
              <Pressable
                style={styles.action}
                onPress={() =>
                  router.push({
                    pathname: "/(tabs)/schedule",
                    params: { courtId: court.id, openCreate: "1" },
                  })
                }
              >
                <Text style={styles.actionText}>CREATE A GAME</Text>
              </Pressable>
            </View>
          ) : null}
          {notice ? <Text style={styles.notice}>{notice}</Text> : null}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  panel: { flex: 1, minHeight: 0, paddingVertical: 10 },
  heatmap: { paddingHorizontal: 12 },
  timeScroller: { maxHeight: 220 },
  timeRows: { paddingBottom: 2 },
  scrollCue: {
    height: 13,
    paddingRight: 2,
    alignItems: "flex-end",
    justifyContent: "center",
  },
  heatRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    marginBottom: 3,
  },
  timeColumn: { width: 42 },
  monthCorner: {
    height: 31,
    alignItems: "flex-start",
    justifyContent: "center",
  },
  monthLabel: {
    fontFamily: Typography.bodyBold,
    fontSize: 8,
    color: Colors.textSecondary,
    letterSpacing: 1,
  },
  timeLabel: {
    fontFamily: Typography.bodyMedium,
    fontSize: 7,
    color: Colors.muted,
    letterSpacing: 0.2,
  },
  dayHeader: {
    flex: 1,
    height: 31,
    alignItems: "center",
    justifyContent: "center",
  },
  dayName: {
    fontFamily: Typography.bodyBold,
    fontSize: 7,
    color: Colors.muted,
    letterSpacing: 0.7,
  },
  dayDate: {
    fontFamily: Typography.heading,
    fontSize: 12,
    color: Colors.textSecondary,
    marginTop: 1,
  },
  today: { color: Colors.accent },
  cell: {
    position: "relative",
    flex: 1,
    height: 27,
    borderRadius: Radius.xs,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.borderSubtle,
    alignItems: "center",
    justifyContent: "center",
  },
  heatLow: { backgroundColor: Colors.accentDim },
  heatMid: { backgroundColor: Colors.accentGlow },
  heatHigh: { backgroundColor: Colors.accent, borderColor: Colors.accent },
  cellSelected: { borderWidth: 1.5, borderColor: Colors.text },
  cellPast: { opacity: 0.34 },
  cellCount: {
    fontFamily: Typography.heading,
    fontSize: 11,
    color: Colors.text,
  },
  runBadge: {
    position: "absolute",
    right: 2,
    top: 2,
    width: 14,
    height: 14,
    borderRadius: Radius.xs,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: Colors.accent,
  },
  legend: {
    marginTop: 7,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  legendScale: { flexDirection: "row", alignItems: "center", gap: 4 },
  legendText: {
    fontFamily: Typography.bodyBold,
    fontSize: 6,
    color: Colors.muted,
    letterSpacing: 0.7,
  },
  legendSwatch: {
    width: 9,
    height: 9,
    borderRadius: 2,
    borderWidth: 0.5,
    borderColor: Colors.borderSubtle,
  },
  slotCard: {
    minHeight: 105,
    marginHorizontal: 12,
    marginTop: 10,
    borderWidth: 1,
    borderTopColor: Colors.border,
    borderColor: Colors.border,
    borderRadius: Radius.sm,
    backgroundColor: Colors.surface,
    overflow: "hidden",
  },
  slotHeader: {
    minHeight: 29,
    paddingHorizontal: 10,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.border,
  },
  slotTitle: {
    fontFamily: Typography.bodyBold,
    fontSize: 8,
    color: Colors.text,
    letterSpacing: 1,
  },
  slotMeta: {
    fontFamily: Typography.bodyBold,
    fontSize: 7,
    color: Colors.accent,
    letterSpacing: 0.8,
    textAlign: "right",
  },
  slotContent: {
    minHeight: 74,
    flexDirection: "row",
  },
  peopleArea: {
    flex: 1,
    minWidth: 0,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  gameArea: {
    width: 148,
    paddingHorizontal: 9,
    paddingVertical: 8,
    borderLeftWidth: StyleSheet.hairlineWidth,
    borderLeftColor: Colors.border,
  },
  sectionLabel: {
    marginBottom: 6,
    fontFamily: Typography.bodyBold,
    fontSize: 6,
    color: Colors.muted,
    letterSpacing: 0.9,
  },
  avatars: { flexDirection: "row", alignItems: "flex-start", gap: 7 },
  avatar: { width: 34, alignItems: "center" },
  avatarName: {
    width: 34,
    marginTop: 3,
    textAlign: "center",
    fontFamily: Typography.bodyBold,
    fontSize: 6,
    color: Colors.muted,
    letterSpacing: 0.4,
  },
  hiddenAvatar: {
    width: 30,
    height: 30,
    borderRadius: Radius.sm,
    borderWidth: 1,
    borderStyle: "dashed",
    borderColor: Colors.border,
    alignItems: "center",
    justifyContent: "center",
  },
  hiddenText: {
    fontFamily: Typography.heading,
    fontSize: 10,
    color: Colors.muted,
  },
  empty: {
    paddingTop: 9,
    fontFamily: Typography.body,
    fontSize: 8,
    color: Colors.muted,
  },
  gameTile: {
    width: 128,
    minHeight: 43,
    paddingRight: 5,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderWidth: 1,
    borderColor: Colors.accentBorder,
    borderRadius: Radius.xs,
    backgroundColor: Colors.accentDim,
  },
  gameTilePressed: { backgroundColor: Colors.accentGlow },
  gameIcon: {
    width: 27,
    alignSelf: "stretch",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: Colors.accent,
  },
  gameCopy: { flex: 1, minWidth: 0 },
  gameTitle: {
    fontFamily: Typography.heading,
    fontSize: 12,
    color: Colors.text,
  },
  gameMeta: {
    marginTop: 1,
    fontFamily: Typography.bodyBold,
    fontSize: 5.5,
    color: Colors.textSecondary,
    letterSpacing: 0.35,
  },
  noGame: {
    paddingTop: 11,
    fontFamily: Typography.bodyMedium,
    fontSize: 7,
    color: Colors.muted,
    letterSpacing: 0.6,
  },
  actions: {
    minHeight: 40,
    paddingHorizontal: 8,
    paddingBottom: 8,
    flexDirection: "row",
    gap: 7,
  },
  action: {
    flex: 1,
    minHeight: 38,
    paddingHorizontal: 8,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.sm,
    backgroundColor: Colors.surfaceHigh,
  },
  actionDisabled: { opacity: 0.45 },
  actionText: {
    fontFamily: Typography.bodyBold,
    fontSize: 7,
    color: Colors.text,
    letterSpacing: 0.7,
    textAlign: "center",
  },
  notice: {
    paddingHorizontal: 10,
    paddingBottom: 8,
    fontFamily: Typography.bodyBold,
    fontSize: 8,
    color: Colors.loss,
    letterSpacing: 0.6,
  },
});
