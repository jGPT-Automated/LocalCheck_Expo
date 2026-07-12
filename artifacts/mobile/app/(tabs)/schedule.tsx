import { router } from "expo-router";
import React, { useState } from "react";
import {
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";

import { Colors, Radius } from "@/constants/colors";
import { Court, getSportColor } from "@/constants/data";
import { Typography } from "@/constants/typography";
import { useApp } from "@/context/AppContext";
import { createScheduledGame } from "@/services/scheduledGameService";

const DAYS = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"];

const RUN_TIMES = ["06:00", "08:00", "10:00", "12:00", "14:00", "16:00", "17:00", "18:00", "19:00", "20:00"];
const RUN_SIZES = [4, 6, 8, 10];

function getWeekDays(): { label: string; dayOfWeek: string; isToday: boolean; date: number }[] {
  const today = new Date();
  const dow = today.getDay();
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(today);
    d.setDate(today.getDate() - dow + i);
    return {
      label: DAYS[i],
      dayOfWeek: DAYS[i],
      isToday: i === dow,
      date: d.getDate(),
    };
  });
}

function HostRunModal({
  visible,
  onClose,
  courts,
  defaultCourt,
  organizerId,
  onCreated,
}: {
  visible: boolean;
  onClose: () => void;
  courts: Court[];
  defaultCourt: Court | null;
  organizerId: string;
  onCreated: () => Promise<void>;
}) {
  const weekDays = getWeekDays();
  const todayIndex = weekDays.findIndex((d) => d.isToday);

  const [title, setTitle] = useState("");
  const [note, setNote] = useState("");
  const [courtId, setCourtId] = useState<string>(defaultCourt?.id ?? courts[0]?.id ?? "");
  const [dayIndex, setDayIndex] = useState(todayIndex);
  const [time, setTime] = useState("18:00");
  const [maxPlayers, setMaxPlayers] = useState(10);
  const [submitting, setSubmitting] = useState(false);
  const [failed, setFailed] = useState(false);

  const courtOptions = defaultCourt && !courts.some((c) => c.id === defaultCourt.id)
    ? [defaultCourt, ...courts]
    : courts;

  const startTime = (() => {
    const now = new Date();
    const d = new Date(now);
    d.setDate(now.getDate() - now.getDay() + dayIndex);
    const [h, m] = time.split(":").map(Number);
    d.setHours(h, m, 0, 0);
    // Past slot this week → schedule it for next week.
    if (d.getTime() < now.getTime()) d.setDate(d.getDate() + 7);
    return d;
  })();

  const canSubmit = courtId !== "" && !submitting;

  const handleCreate = async () => {
    if (!canSubmit) return;
    setSubmitting(true);
    setFailed(false);
    const created = await createScheduledGame({
      courtId,
      organizerId,
      title: title.trim() || "PICKUP RUN",
      startTime: startTime.toISOString(),
      maxPlayers,
      note: note.trim() || undefined,
    });
    setSubmitting(false);
    if (!created) {
      setFailed(true);
      return;
    }
    await onCreated();
    setTitle("");
    setNote("");
    onClose();
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <View style={styles.modalCard}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>HOST A RUN</Text>
            <Pressable onPress={onClose} hitSlop={12}>
              <Feather name="x" size={20} color={Colors.muted} />
            </Pressable>
          </View>
          <ScrollView showsVerticalScrollIndicator={false}>
            <Text style={styles.fieldLabel}>TITLE</Text>
            <TextInput
              style={styles.fieldInput}
              value={title}
              onChangeText={setTitle}
              placeholder="PICKUP RUN"
              placeholderTextColor={Colors.mutedDark}
            />

            <Text style={styles.fieldLabel}>COURT</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
              {courtOptions.map((c) => (
                <Pressable
                  key={c.id}
                  style={[styles.chip, courtId === c.id && styles.chipActive]}
                  onPress={() => setCourtId(c.id)}
                >
                  <Text style={[styles.chipText, courtId === c.id && styles.chipTextActive]}>
                    {c.name.toUpperCase()}
                  </Text>
                </Pressable>
              ))}
            </ScrollView>

            <Text style={styles.fieldLabel}>DAY</Text>
            <View style={styles.chipRowWrap}>
              {weekDays.map((d, i) => (
                <Pressable
                  key={i}
                  style={[styles.chip, dayIndex === i && styles.chipActive]}
                  onPress={() => setDayIndex(i)}
                >
                  <Text style={[styles.chipText, dayIndex === i && styles.chipTextActive]}>
                    {d.isToday ? "TODAY" : `${d.label} ${d.date}`}
                  </Text>
                </Pressable>
              ))}
            </View>

            <Text style={styles.fieldLabel}>START TIME</Text>
            <View style={styles.chipRowWrap}>
              {RUN_TIMES.map((t) => (
                <Pressable
                  key={t}
                  style={[styles.chip, time === t && styles.chipActive]}
                  onPress={() => setTime(t)}
                >
                  <Text style={[styles.chipText, time === t && styles.chipTextActive]}>{t}</Text>
                </Pressable>
              ))}
            </View>

            <Text style={styles.fieldLabel}>MAX PLAYERS</Text>
            <View style={styles.chipRowWrap}>
              {RUN_SIZES.map((n) => (
                <Pressable
                  key={n}
                  style={[styles.chip, maxPlayers === n && styles.chipActive]}
                  onPress={() => setMaxPlayers(n)}
                >
                  <Text style={[styles.chipText, maxPlayers === n && styles.chipTextActive]}>{n}</Text>
                </Pressable>
              ))}
            </View>

            <Text style={styles.fieldLabel}>NOTE (OPTIONAL)</Text>
            <TextInput
              style={styles.fieldInput}
              value={note}
              onChangeText={setNote}
              placeholder="Bring a dark shirt"
              placeholderTextColor={Colors.mutedDark}
            />

            {failed && (
              <Text style={styles.createError}>COULD NOT CREATE RUN — TRY AGAIN</Text>
            )}

            <Pressable
              style={[styles.createBtn, !canSubmit && styles.createBtnDisabled]}
              onPress={handleCreate}
              disabled={!canSubmit}
            >
              <Text style={styles.createBtnText}>
                {submitting ? "CREATING…" : "CREATE RUN"}
              </Text>
            </Pressable>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

export default function ScheduleScreen() {
  const { localCourt, runs, courts, currentUser, refreshRuns } = useApp();
  const { top, bottom } = useSafeAreaInsets();
  const topPad = Platform.OS === "web" ? 67 : top;
  const [showHost, setShowHost] = useState(false);

  const weekDays = getWeekDays();
  const todayIndex = weekDays.findIndex((d) => d.isToday);
  const [selectedDay, setSelectedDay] = useState(todayIndex);

  // Map real scheduled games to days (TODAY = selectedDay if today, TOMORROW = next day)
  const runsForDay = runs.filter((r) => {
    if (selectedDay === todayIndex) return r.date === "TODAY";
    if (selectedDay === todayIndex + 1) return r.date === "TOMORROW";
    return false;
  });

  const selectedDayInfo = weekDays[selectedDay];

  return (
    <View style={styles.container}>
      {/* ── Header ── */}
      <View style={[styles.header, { paddingTop: topPad + 12 }]}>
        <View>
          <Text style={styles.headerEyebrow}>LOCALCHECK</Text>
          <Text style={styles.headerTitle}>SCHEDULE</Text>
          <Text style={styles.headerSub}>YOUR UPCOMING RUNS</Text>
        </View>
        <Pressable style={styles.addBtn} onPress={() => setShowHost(true)} testID="host-run-add-btn">
          <Feather name="plus" size={18} color={Colors.black} />
        </Pressable>
      </View>

      {/* ── Week Strip ── */}
      <View style={styles.weekStrip}>
        {weekDays.map((day, i) => (
          <Pressable
            key={i}
            style={[styles.dayCell, selectedDay === i && styles.dayCellActive]}
            onPress={() => setSelectedDay(i)}
          >
            <Text style={[styles.dayLabel, selectedDay === i && styles.dayLabelActive]}>
              {day.label}
            </Text>
            <Text style={[styles.dayDate, selectedDay === i && styles.dayDateActive]}>
              {day.date}
            </Text>
            {day.isToday && <View style={styles.todayDot} />}
          </Pressable>
        ))}
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: Platform.OS === "web" ? 84 : bottom + 100 },
        ]}
      >
        {/* Day header */}
        <View style={styles.dayHeaderRow}>
          <Text style={styles.dayHeaderText}>
            {selectedDayInfo.isToday ? "TODAY" : selectedDayInfo.dayOfWeek}
          </Text>
          <Text style={styles.dayHeaderDate}>
            {selectedDayInfo.date}
          </Text>
        </View>

        {/* ── Runs for selected day ── */}
        {runsForDay.length === 0 ? (
          <View style={styles.emptyDay}>
            <Feather name="calendar" size={24} color={Colors.mutedDark} style={styles.emptyIcon} />
            <Text style={styles.emptyTitle}>NO RUNS SCHEDULED</Text>
            <Text style={styles.emptySub}>Host a run or join one from the Explore tab.</Text>
            <Pressable
              style={styles.hostBtn}
              onPress={() => setShowHost(true)}
              testID="host-run-empty-btn"
            >
              <Text style={styles.hostBtnText}>+ HOST A RUN</Text>
            </Pressable>
          </View>
        ) : (
          runsForDay.map((run) => {
            const sportColor = getSportColor(run.sport);
            const filled =
              run.teamA.filter(Boolean).length + run.teamB.filter(Boolean).length;
            const isFull = filled >= run.maxPlayers;

            return (
              <Pressable
                key={run.id}
                style={({ pressed }) => [styles.runCard, pressed && styles.pressed]}
                onPress={() => router.push(`/run/${run.id}`)}
              >
                <View
                  style={[styles.runSportBar, { backgroundColor: sportColor }]}
                />
                <View style={styles.runBody}>
                  <View style={styles.runTop}>
                    <Text style={styles.runTime}>{run.time}</Text>
                    <View
                      style={[
                        styles.runCapBadge,
                        isFull && styles.runCapBadgeFull,
                      ]}
                    >
                      <Text
                        style={[
                          styles.runCapText,
                          isFull && styles.runCapTextFull,
                        ]}
                      >
                        {filled}/{run.maxPlayers}
                      </Text>
                    </View>
                  </View>
                  <Text style={styles.runTitle}>{run.title}</Text>
                  <Text style={styles.runMeta}>
                    {run.courtName} · {run.skillLevel}
                  </Text>
                </View>
              </Pressable>
            );
          })
        )}

        {/* ── My Local Court section ── */}
        {localCourt && (
          <View style={styles.localSection}>
            <Text style={styles.localSectionTitle}>RUNS AT MY LOCAL</Text>
            <Pressable
              style={({ pressed }) => [styles.courtLink, pressed && styles.pressed]}
              onPress={() => router.push(`/court/${localCourt.id}`)}
            >
              <View>
                <Text style={styles.courtLinkName}>{localCourt.name.toUpperCase()}</Text>
                <Text style={styles.courtLinkSub}>
                  {localCourt.neighborhood} · {localCourt.activeCount} active
                </Text>
              </View>
              <Feather name="arrow-right" size={18} color={Colors.muted} />
            </Pressable>
          </View>
        )}

        {/* ── All upcoming runs ── */}
        <View style={styles.allSection}>
          <Text style={styles.allSectionTitle}>ALL UPCOMING</Text>
          {runs.map((run) => {
            const sportColor = getSportColor(run.sport);
            const filled =
              run.teamA.filter(Boolean).length + run.teamB.filter(Boolean).length;
            return (
              <Pressable
                key={run.id}
                style={({ pressed }) => [styles.runRowFlat, pressed && styles.pressed]}
                onPress={() => router.push(`/run/${run.id}`)}
              >
                <View style={[styles.runSportDot, { backgroundColor: sportColor }]} />
                <View style={styles.runRowInfo}>
                  <Text style={styles.runRowTitle}>{run.title}</Text>
                  <Text style={styles.runRowMeta}>
                    {run.date} · {run.time} · {run.courtName}
                  </Text>
                </View>
                <View style={styles.runRowRight}>
                  <Text style={styles.runRowCount}>{filled}</Text>
                  <Text style={styles.runRowCountLabel}>IN</Text>
                </View>
              </Pressable>
            );
          })}
        </View>
      </ScrollView>

      <HostRunModal
        visible={showHost}
        onClose={() => setShowHost(false)}
        courts={courts}
        defaultCourt={localCourt}
        organizerId={currentUser.id}
        onCreated={refreshRuns}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },

  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-end",
    paddingHorizontal: 20,
    paddingBottom: 14,
    backgroundColor: Colors.surface,
    borderBottomWidth: 0.5,
    borderBottomColor: Colors.border,
  },
  headerEyebrow: {
    fontFamily: Typography.bodyBold,
    fontSize: 9,
    color: Colors.accent,
    letterSpacing: 2.5,
    textTransform: "uppercase" as const,
    marginBottom: 2,
  },
  headerTitle: {
    fontFamily: Typography.heading,
    fontSize: 32,
    color: Colors.text,
    letterSpacing: 0.5,
    lineHeight: 34,
  },
  headerSub: {
    fontFamily: Typography.bodyMedium,
    fontSize: 9,
    color: Colors.muted,
    letterSpacing: 2,
    textTransform: "uppercase" as const,
    marginTop: 2,
  },
  addBtn: {
    width: 34,
    height: 34,
    backgroundColor: Colors.accent,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: Radius.xs,
    marginBottom: 4,
  },

  // ── Week Strip ──
  weekStrip: {
    flexDirection: "row",
    backgroundColor: Colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  dayCell: {
    flex: 1,
    alignItems: "center",
    paddingVertical: 10,
    gap: 2,
    borderBottomWidth: 3,
    borderBottomColor: "transparent",
  },
  dayCellActive: { borderBottomColor: Colors.accent },
  dayLabel: {
    fontFamily: Typography.bodyMedium,
    fontSize: 8,
    color: Colors.muted,
    letterSpacing: 0.5,
    textTransform: "uppercase" as const,
  },
  dayLabelActive: { color: Colors.accent },
  dayDate: {
    fontFamily: Typography.heading,
    fontSize: 16,
    color: Colors.muted,
    lineHeight: 18,
  },
  dayDateActive: { color: Colors.text },
  todayDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: Colors.accent,
    marginTop: 2,
  },

  scrollContent: { paddingTop: 0 },

  // ── Day Header ──
  dayHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "baseline",
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 0.5,
    borderBottomColor: Colors.border,
  },
  dayHeaderText: {
    fontFamily: Typography.heading,
    fontSize: 20,
    color: Colors.text,
    letterSpacing: 2,
  },
  dayHeaderDate: {
    fontFamily: Typography.heading,
    fontSize: 14,
    color: Colors.muted,
  },

  // ── Run Card ──
  runCard: {
    flexDirection: "row",
    borderBottomWidth: 0.5,
    borderBottomColor: Colors.border,
    overflow: "hidden",
    backgroundColor: Colors.surface,
  },
  pressed: { backgroundColor: Colors.surfaceHigh },
  runSportBar: { width: 3 },
  runBody: {
    flex: 1,
    padding: 16,
    gap: 4,
  },
  runTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  runTime: {
    fontFamily: Typography.heading,
    fontSize: 18,
    color: Colors.text,
    letterSpacing: 0.5,
  },
  runCapBadge: {
    borderWidth: 0.5,
    borderColor: Colors.border,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: Radius.xs,
  },
  runCapBadgeFull: {
    backgroundColor: Colors.accentDim,
    borderColor: Colors.accent,
  },
  runCapText: {
    fontFamily: Typography.heading,
    fontSize: 11,
    color: Colors.muted,
    letterSpacing: 1,
  },
  runCapTextFull: { color: Colors.accent },
  runTitle: {
    fontFamily: Typography.heading,
    fontSize: 16,
    color: Colors.text,
    letterSpacing: 0.3,
  },
  runMeta: {
    fontFamily: Typography.body,
    fontSize: 11,
    color: Colors.muted,
  },

  // ── Empty State ──
  emptyDay: {
    alignItems: "center",
    paddingVertical: 48,
    paddingHorizontal: 40,
    borderBottomWidth: 0.5,
    borderBottomColor: Colors.border,
  },
  emptyIcon: { marginBottom: 14 },
  emptyTitle: {
    fontFamily: Typography.heading,
    fontSize: 16,
    color: Colors.text,
    letterSpacing: 2.5,
    marginBottom: 8,
  },
  emptySub: {
    fontFamily: Typography.body,
    fontSize: 12,
    color: Colors.muted,
    textAlign: "center",
    lineHeight: 18,
    marginBottom: 20,
  },
  hostBtn: {
    borderWidth: 0.5,
    borderColor: Colors.accent,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: Radius.xs,
  },
  hostBtnText: {
    fontFamily: Typography.heading,
    fontSize: 12,
    color: Colors.accent,
    letterSpacing: 2,
  },

  // ── Local Court CTA ──
  localSection: {
    paddingHorizontal: 20,
    paddingTop: 22,
    paddingBottom: 16,
    borderBottomWidth: 0.5,
    borderBottomColor: Colors.border,
  },
  localSectionTitle: {
    fontFamily: Typography.heading,
    fontSize: 10,
    color: Colors.muted,
    letterSpacing: 3,
    marginBottom: 10,
  },
  courtLink: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    borderWidth: 0.5,
    borderColor: Colors.border,
    backgroundColor: Colors.surface,
    padding: 14,
    borderRadius: Radius.xs,
  },
  courtLinkName: {
    fontFamily: Typography.heading,
    fontSize: 15,
    color: Colors.text,
    letterSpacing: 0.3,
    marginBottom: 2,
  },
  courtLinkSub: {
    fontFamily: Typography.body,
    fontSize: 11,
    color: Colors.muted,
  },

  // ── All Upcoming ──
  allSection: {
    paddingTop: 22,
  },
  allSectionTitle: {
    fontFamily: Typography.heading,
    fontSize: 10,
    color: Colors.muted,
    letterSpacing: 3,
    paddingHorizontal: 20,
    marginBottom: 2,
  },
  runRowFlat: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 14,
    paddingHorizontal: 20,
    gap: 12,
    borderBottomWidth: 0.5,
    borderBottomColor: Colors.border,
  },
  runSportDot: { width: 8, height: 8, borderRadius: 4 },
  runRowInfo: { flex: 1 },
  runRowTitle: {
    fontFamily: Typography.heading,
    fontSize: 14,
    color: Colors.text,
    letterSpacing: 0.3,
    marginBottom: 2,
  },
  runRowMeta: {
    fontFamily: Typography.body,
    fontSize: 11,
    color: Colors.muted,
  },
  runRowRight: { alignItems: "center" },
  runRowCount: {
    fontFamily: Typography.heading,
    fontSize: 18,
    color: Colors.text,
    lineHeight: 20,
  },
  runRowCountLabel: {
    fontFamily: Typography.bodyMedium,
    fontSize: 7,
    color: Colors.muted,
    letterSpacing: 1.5,
    textTransform: "uppercase" as const,
  },

  // ── Host Run Modal ──
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.75)",
    alignItems: "center",
    justifyContent: "center",
    padding: 20,
  },
  modalCard: {
    width: "100%",
    maxWidth: 380,
    maxHeight: "85%",
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 20,
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  modalTitle: {
    fontFamily: Typography.heading,
    fontSize: 16,
    color: Colors.text,
    letterSpacing: 3,
  },
  fieldLabel: {
    fontFamily: Typography.bodyBold,
    fontSize: 9,
    color: Colors.muted,
    letterSpacing: 2,
    textTransform: "uppercase" as const,
    marginTop: 14,
    marginBottom: 6,
  },
  fieldInput: {
    borderWidth: 0.5,
    borderColor: Colors.border,
    backgroundColor: Colors.surfaceHigh,
    color: Colors.text,
    fontFamily: Typography.bodyMedium,
    fontSize: 13,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: Radius.xs,
  },
  chipRow: {
    gap: 8,
  },
  chipRowWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  chip: {
    borderWidth: 0.5,
    borderColor: Colors.border,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: Radius.xs,
    backgroundColor: Colors.surfaceHigh,
  },
  chipActive: {
    borderColor: Colors.accent,
    backgroundColor: Colors.accentDim,
  },
  chipText: {
    fontFamily: Typography.heading,
    fontSize: 11,
    color: Colors.muted,
    letterSpacing: 1,
  },
  chipTextActive: { color: Colors.accent },
  createError: {
    fontFamily: Typography.bodyBold,
    fontSize: 10,
    color: Colors.loss,
    letterSpacing: 1.5,
    marginTop: 14,
    textAlign: "center",
  },
  createBtn: {
    backgroundColor: Colors.accent,
    alignItems: "center",
    paddingVertical: 13,
    borderRadius: Radius.xs,
    marginTop: 16,
  },
  createBtnDisabled: { opacity: 0.5 },
  createBtnText: {
    fontFamily: Typography.heading,
    fontSize: 12,
    color: Colors.black,
    letterSpacing: 2,
  },
});
