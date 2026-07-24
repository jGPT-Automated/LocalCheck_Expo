import { router } from "expo-router";
import React, { useEffect, useRef, useState } from "react";
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
import { Court, PlannedVisit, getSportColor } from "@/constants/data";
import { PlayerAvatar } from "@/components/PlayerAvatar";
import { ScreenHeader } from "@/components/ScreenHeader";
import { Typography } from "@/constants/typography";
import { useApp } from "@/context/AppContext";
import { createScheduledGame } from "@/services/scheduledGameService";
import { searchCourts } from "@/services/courtService";

const DAYS = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"];

const RUN_TIMES = ["06:00", "08:00", "10:00", "12:00", "14:00", "16:00", "17:00", "18:00", "19:00", "20:00"];
const RUN_SIZES = [4, 6, 8, 10];

// Rolling next-7-days window (today first) — matches the product model of
// "who's going this week" and the [today, +7d] data fetch window. A calendar
// Sun–Sat strip showed past days whose runs the fetch window excludes, which
// made freshly created runs invisible ("NO RUNS SCHEDULED" bug, 2026-07-17).
function getWeekDays(): { label: string; dayOfWeek: string; isToday: boolean; date: number }[] {
  const today = new Date();
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(today);
    d.setDate(today.getDate() + i);
    return {
      label: DAYS[d.getDay()],
      dayOfWeek: DAYS[d.getDay()],
      isToday: i === 0,
      date: d.getDate(),
    };
  });
}

// ── Shared modal pieces (native page-sheet, court field, day/time grids) ──

const MAX_SEARCH_RESULTS = 6;
const TIME_COLS = 4;

/** Next 7 days starting today — symmetric picker, no dead/disabled cells. */
function getNextDays(): { initial: string; date: number; offset: number }[] {
  const today = new Date();
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(today);
    d.setDate(today.getDate() + i);
    return { initial: DAYS[d.getDay()][0], date: d.getDate(), offset: i };
  });
}

/** Date for `offset` days from today at time `t` ("HH:MM"). */
function offsetDate(offset: number, t: string) {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  const [h, m] = t.split(":").map(Number);
  d.setHours(h, m, 0, 0);
  return d;
}

/**
 * Single court field: prefilled with the selected court (✕ to clear); when
 * empty it becomes a debounced search typeahead over all courts.
 */
function CourtField({
  selected,
  onSelect,
  onClear,
}: {
  selected: Court | null;
  onSelect: (c: Court) => void;
  onClear: () => void;
}) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Court[]>([]);
  const [searching, setSearching] = useState(false);

  useEffect(() => {
    const trimmed = query.trim();
    if (trimmed.length < 2) {
      setResults([]);
      setSearching(false);
      return;
    }
    setSearching(true);
    let cancelled = false;
    const timer = setTimeout(async () => {
      const found = await searchCourts(trimmed);
      if (cancelled) return;
      setResults(found.slice(0, MAX_SEARCH_RESULTS));
      setSearching(false);
    }, 300);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [query]);

  if (selected) {
    return (
      <View style={styles.courtField}>
        <View style={styles.courtFieldInfo}>
          <Text style={styles.courtFieldName} numberOfLines={1}>
            {selected.name.toUpperCase()}
          </Text>
          {(selected.neighborhood || selected.city) ? (
            <Text style={styles.courtFieldSub} numberOfLines={1}>
              {[selected.neighborhood, selected.city].filter(Boolean).join(" · ")}
            </Text>
          ) : null}
        </View>
        <Pressable
          onPress={onClear}
          hitSlop={12}
          style={styles.courtFieldClear}
          testID="court-field-clear"
        >
          <Feather name="x" size={16} color={Colors.muted} />
        </Pressable>
      </View>
    );
  }

  const trimmed = query.trim();
  return (
    <View>
      <View style={styles.courtSearchBox}>
        <Feather name="search" size={14} color={Colors.muted} />
        <TextInput
          style={styles.courtSearchInput}
          value={query}
          onChangeText={setQuery}
          placeholder="Search courts"
          placeholderTextColor={Colors.mutedDark}
          autoCorrect={false}
          autoCapitalize="none"
          testID="court-search-input"
        />
      </View>
      {trimmed.length >= 2 && (
        <View style={styles.courtResults}>
          {results.map((c) => (
            <Pressable
              key={c.id}
              style={({ pressed }) => [styles.courtResultRow, pressed && styles.pressed]}
              onPress={() => {
                onSelect(c);
                setQuery("");
                setResults([]);
              }}
            >
              <View style={styles.courtFieldInfo}>
                <Text style={styles.courtFieldName} numberOfLines={1}>
                  {c.name.toUpperCase()}
                </Text>
                <Text style={styles.courtFieldSub} numberOfLines={1}>
                  {[
                    c.city,
                    c.distanceKm != null ? `${c.distanceKm.toFixed(1)} KM` : null,
                  ]
                    .filter(Boolean)
                    .join(" · ") || c.neighborhood}
                </Text>
              </View>
            </Pressable>
          ))}
          {!searching && results.length === 0 && (
            <Text style={styles.courtResultsEmpty}>NO COURTS FOUND</Text>
          )}
          {searching && results.length === 0 && (
            <Text style={styles.courtResultsEmpty}>SEARCHING…</Text>
          )}
        </View>
      )}
    </View>
  );
}

/** Symmetric 7-cell day row: weekday initial + day number, accent fill when selected. */
function DayGrid({ selected, onSelect }: { selected: number; onSelect: (offset: number) => void }) {
  return (
    <View style={styles.dayGrid}>
      {getNextDays().map((d) => {
        const active = selected === d.offset;
        return (
          <Pressable
            key={d.offset}
            style={[styles.dayGridCell, active && styles.dayGridCellActive]}
            onPress={() => onSelect(d.offset)}
          >
            <Text style={[styles.dayGridInitial, active && styles.dayGridInitialActive]}>
              {d.initial}
            </Text>
            <Text style={[styles.dayGridDate, active && styles.dayGridDateActive]}>
              {d.date}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

/** Time chips in equal-width rows of 4 — past slots (today only) disabled. */
function TimeGrid({
  selected,
  dayOffset,
  onSelect,
}: {
  selected: string;
  dayOffset: number;
  onSelect: (t: string) => void;
}) {
  const rows: string[][] = [];
  for (let i = 0; i < RUN_TIMES.length; i += TIME_COLS) {
    rows.push(RUN_TIMES.slice(i, i + TIME_COLS));
  }
  return (
    <View>
      {rows.map((row, ri) => (
        <View key={ri} style={styles.gridRow}>
          {row.map((t) => {
            const disabled = offsetDate(dayOffset, t).getTime() <= Date.now();
            const active = selected === t;
            return (
              <Pressable
                key={t}
                style={[styles.gridCell, active && styles.gridCellActive, disabled && styles.gridCellDisabled]}
                onPress={() => onSelect(t)}
                disabled={disabled}
              >
                <Text style={[styles.gridCellText, active && styles.gridCellTextActive]}>{t}</Text>
              </Pressable>
            );
          })}
          {Array.from({ length: TIME_COLS - row.length }).map((_, i) => (
            <View key={`spacer-${i}`} style={styles.gridCellSpacer} />
          ))}
        </View>
      ))}
    </View>
  );
}

function HostRunModal({
  visible,
  onClose,
  defaultCourt,
  organizerId,
  onCreated,
}: {
  visible: boolean;
  onClose: () => void;
  defaultCourt: Court | null;
  organizerId: string;
  onCreated: () => Promise<void>;
}) {
  const { top } = useSafeAreaInsets();

  const [title, setTitle] = useState("");
  const [note, setNote] = useState("");
  const [court, setCourt] = useState<Court | null>(defaultCourt);
  const [dayOffset, setDayOffset] = useState(0);
  const [time, setTime] = useState("18:00");
  const [maxPlayers, setMaxPlayers] = useState(10);
  const [submitting, setSubmitting] = useState(false);
  const [failed, setFailed] = useState(false);

  // Re-default the court each time the sheet opens (ref so the 30s context
  // poll can't reset a court the user picked mid-edit).
  const defaultCourtRef = useRef(defaultCourt);
  defaultCourtRef.current = defaultCourt;
  useEffect(() => {
    if (visible) {
      setCourt(defaultCourtRef.current);
      setDayOffset(0);
      setFailed(false);
    }
  }, [visible]);

  // Past times are disabled in the picker — never silently reschedule a past
  // slot to a different date than the one the user tapped.
  const startTime = offsetDate(dayOffset, time);
  const canSubmit = !!court && startTime.getTime() > Date.now() && !submitting;

  const handleCreate = async () => {
    if (!canSubmit || !court) return;
    setSubmitting(true);
    setFailed(false);
    const created = await createScheduledGame({
      courtId: court.id,
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
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={[styles.sheet, { paddingTop: Platform.OS === "ios" ? top : top + 12 }]}>
        <View style={styles.sheetHeader}>
          <Text style={styles.sheetTitle}>HOST A RUN</Text>
          <Pressable onPress={onClose} style={styles.sheetClose} hitSlop={12}>
            <Feather name="x" size={22} color={Colors.muted} />
          </Pressable>
        </View>
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.sheetContent}
          keyboardShouldPersistTaps="handled"
        >
          <Text style={styles.fieldLabel}>TITLE</Text>
          <TextInput
            style={styles.fieldInput}
            value={title}
            onChangeText={setTitle}
            placeholder="PICKUP RUN"
            placeholderTextColor={Colors.mutedDark}
          />

          <Text style={styles.fieldLabel}>COURT</Text>
          <CourtField selected={court} onSelect={setCourt} onClear={() => setCourt(null)} />

          <Text style={styles.fieldLabel}>DAY</Text>
          <DayGrid selected={dayOffset} onSelect={setDayOffset} />

          <Text style={styles.fieldLabel}>START TIME</Text>
          <TimeGrid selected={time} dayOffset={dayOffset} onSelect={setTime} />

          <Text style={styles.fieldLabel}>MAX PLAYERS</Text>
          <View style={styles.gridRow}>
            {RUN_SIZES.map((n) => (
              <Pressable
                key={n}
                style={[styles.gridCell, maxPlayers === n && styles.gridCellActive]}
                onPress={() => setMaxPlayers(n)}
              >
                <Text style={[styles.gridCellText, maxPlayers === n && styles.gridCellTextActive]}>
                  {n}
                </Text>
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
    </Modal>
  );
}

function PlanVisitModal({
  visible,
  onClose,
  defaultCourt,
  defaultDayIndex,
  onSubmit,
}: {
  visible: boolean;
  onClose: () => void;
  defaultCourt: Court | null;
  defaultDayIndex: number;
  onSubmit: (courtId: string, plannedAtIso: string, note?: string) => Promise<boolean>;
}) {
  const { top } = useSafeAreaInsets();

  const [note, setNote] = useState("");
  const [court, setCourt] = useState<Court | null>(defaultCourt);
  const [dayOffset, setDayOffset] = useState(0);
  const [time, setTime] = useState("18:00");
  const [submitting, setSubmitting] = useState(false);
  const [failed, setFailed] = useState(false);

  // Re-default court + day each time the sheet opens. defaultDayIndex is the
  // page's week-strip index (Sun=0); convert to an offset from today.
  const defaultsRef = useRef({ defaultCourt, defaultDayIndex });
  defaultsRef.current = { defaultCourt, defaultDayIndex };
  useEffect(() => {
    if (visible) {
      const { defaultCourt: dc, defaultDayIndex: di } = defaultsRef.current;
      setCourt(dc);
      // Page strip is rolling now: its index IS the offset from today.
      setDayOffset(Math.min(6, Math.max(0, di)));
      setFailed(false);
    }
  }, [visible]);

  const plannedAt = offsetDate(dayOffset, time);
  const canSubmit = !!court && plannedAt.getTime() > Date.now() && !submitting;

  const handleSubmit = async () => {
    if (!canSubmit || !court) return;
    setSubmitting(true);
    setFailed(false);
    const ok = await onSubmit(court.id, plannedAt.toISOString(), note.trim() || undefined);
    setSubmitting(false);
    if (!ok) {
      setFailed(true);
      return;
    }
    setNote("");
    onClose();
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={[styles.sheet, { paddingTop: Platform.OS === "ios" ? top : top + 12 }]}>
        <View style={styles.sheetHeader}>
          <Text style={styles.sheetTitle}>I'LL BE THERE</Text>
          <Pressable onPress={onClose} style={styles.sheetClose} hitSlop={12}>
            <Feather name="x" size={22} color={Colors.muted} />
          </Pressable>
        </View>
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.sheetContent}
          keyboardShouldPersistTaps="handled"
        >
          <Text style={styles.fieldLabel}>COURT</Text>
          <CourtField selected={court} onSelect={setCourt} onClear={() => setCourt(null)} />

          <Text style={styles.fieldLabel}>DAY</Text>
          <DayGrid selected={dayOffset} onSelect={setDayOffset} />

          <Text style={styles.fieldLabel}>AROUND WHAT TIME</Text>
          <TimeGrid selected={time} dayOffset={dayOffset} onSelect={setTime} />

          <Text style={styles.fieldLabel}>NOTE (OPTIONAL)</Text>
          <TextInput
            style={styles.fieldInput}
            value={note}
            onChangeText={setNote}
            placeholder="Looking for 2v2"
            placeholderTextColor={Colors.mutedDark}
          />

          {failed && (
            <Text style={styles.createError}>COULD NOT POST — TRY AGAIN</Text>
          )}

          <Pressable
            style={[styles.createBtn, !canSubmit && styles.createBtnDisabled]}
            onPress={handleSubmit}
            disabled={!canSubmit}
          >
            <Text style={styles.createBtnText}>
              {submitting ? "POSTING…" : "POST MY TIME"}
            </Text>
          </Pressable>
        </ScrollView>
      </View>
    </Modal>
  );
}

export default function ScheduleScreen() {
  const {
    localCourt,
    runs,
    plannedVisits,
    currentUser,
    refreshRuns,
    addPlannedVisit,
    removePlannedVisit,
  } = useApp();
  const { top, bottom } = useSafeAreaInsets();
  const topPad = Platform.OS === "web" ? 67 : top;
  const [showHost, setShowHost] = useState(false);
  const [showPlan, setShowPlan] = useState(false);

  const weekDays = getWeekDays();
  const todayIndex = weekDays.findIndex((d) => d.isToday);
  const [selectedDay, setSelectedDay] = useState(todayIndex);

  // Match runs to the selected day by actual start time. selectedDay is now a
  // rolling offset from today (0 = today).
  const selectedDate = (() => {
    const d = new Date();
    d.setDate(d.getDate() + selectedDay);
    return d.toDateString();
  })();
  const runsForDay = runs.filter((r) => new Date(r.startTimeIso).toDateString() === selectedDate);

  // Planned visits ("pulling up") for the selected day, grouped by court in
  // time order — this is the page's primary content.
  const visitsForDay = plannedVisits.filter(
    (v) => new Date(v.plannedAtIso).toDateString() === selectedDate
  );
  const visitsByCourt: { courtId: string; courtName: string; sport: PlannedVisit["sport"]; visits: PlannedVisit[] }[] = [];
  for (const v of visitsForDay) {
    const group = visitsByCourt.find((g) => g.courtId === v.courtId);
    if (group) group.visits.push(v);
    else visitsByCourt.push({ courtId: v.courtId, courtName: v.courtName, sport: v.sport, visits: [v] });
  }

  const selectedDayInfo = weekDays[selectedDay];

  return (
    <View style={styles.container}>
      <ScreenHeader
        title="SCHEDULE"
        subtitle="WHO'S PULLING UP THIS WEEK"
        right={
          <Pressable style={styles.addBtn} onPress={() => setShowHost(true)} testID="host-run-add-btn">
            <Feather name="plus" size={18} color={Colors.black} />
          </Pressable>
        }
      />

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

        {/* ── Pulling Up (planned presence — the page's primary content) ── */}
        <View style={styles.pullingSection}>
          <View style={styles.pullingHeader}>
            <Text style={styles.pullingTitle}>PULLING UP</Text>
            <Pressable
              style={styles.planBtn}
              onPress={() => setShowPlan(true)}
              disabled={selectedDay < todayIndex}
              testID="plan-visit-btn"
            >
              <Text style={[styles.planBtnText, selectedDay < todayIndex && styles.planBtnTextDisabled]}>
                + I'LL BE THERE
              </Text>
            </Pressable>
          </View>

          {visitsForDay.length === 0 ? (
            <Text style={styles.pullingEmpty}>
              Nobody's posted a time yet. Say when you're coming so people know to show up.
            </Text>
          ) : (
            visitsByCourt.map((group) => (
              <View key={group.courtId} style={styles.courtGroup}>
                <Pressable
                  style={styles.courtGroupHeader}
                  onPress={() => router.push(`/court/${group.courtId}`)}
                >
                  <View style={[styles.courtGroupDot, { backgroundColor: getSportColor(group.sport) }]} />
                  <Text style={styles.courtGroupName}>{group.courtName.toUpperCase()}</Text>
                  <Text style={styles.courtGroupCount}>
                    {group.visits.length} COMING
                  </Text>
                </Pressable>
                {group.visits.map((visit) => {
                  const isMine = visit.userId === currentUser.id;
                  return (
                    <View key={visit.id} style={styles.visitRow}>
                      <Text style={styles.visitTime}>{visit.time}</Text>
                      <Pressable
                        style={styles.visitPlayer}
                        onPress={() => router.push(`/player/${visit.userId}`)}
                      >
                        <PlayerAvatar initials={visit.player.avatar} size={26} />
                        <Text style={styles.visitName}>
                          {visit.player.name.split(" ")[0].toUpperCase()}
                          {isMine ? "  · YOU" : ""}
                        </Text>
                      </Pressable>
                      {visit.note != null && (
                        <Text style={styles.visitNote} numberOfLines={1}>{visit.note}</Text>
                      )}
                      {isMine && (
                        <Pressable
                          hitSlop={10}
                          onPress={() => removePlannedVisit(visit.id)}
                          testID={`remove-visit-${visit.id}`}
                        >
                          <Feather name="x" size={14} color={Colors.loss} />
                        </Pressable>
                      )}
                    </View>
                  );
                })}
              </View>
            ))
          )}
        </View>

        {/* ── Runs for selected day ── */}
        <View style={styles.dayHeaderRow}>
          <Text style={styles.runsSectionTitle}>RUNS</Text>
        </View>
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
            const filled = run.participants.length;
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
            const filled = run.participants.length;
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
        defaultCourt={localCourt}
        organizerId={currentUser.id}
        onCreated={refreshRuns}
      />

      <PlanVisitModal
        visible={showPlan}
        onClose={() => setShowPlan(false)}
        defaultCourt={localCourt}
        defaultDayIndex={selectedDay}
        onSubmit={addPlannedVisit}
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

  // ── Pulling Up ──
  pullingSection: {
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 16,
    borderBottomWidth: 0.5,
    borderBottomColor: Colors.border,
  },
  pullingHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  pullingTitle: {
    fontFamily: Typography.heading,
    fontSize: 12,
    color: Colors.text,
    letterSpacing: 3,
  },
  planBtn: {
    borderWidth: 0.5,
    borderColor: Colors.accent,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: Radius.xs,
  },
  planBtnText: {
    fontFamily: Typography.heading,
    fontSize: 10,
    color: Colors.accent,
    letterSpacing: 1.5,
  },
  planBtnTextDisabled: { color: Colors.mutedDark },
  pullingEmpty: {
    fontFamily: Typography.body,
    fontSize: 12,
    color: Colors.muted,
    lineHeight: 18,
  },
  courtGroup: { marginBottom: 14 },
  courtGroupHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  courtGroupDot: { width: 8, height: 8, borderRadius: 4 },
  courtGroupName: {
    flex: 1,
    fontFamily: Typography.heading,
    fontSize: 13,
    color: Colors.text,
    letterSpacing: 0.5,
  },
  courtGroupCount: {
    fontFamily: Typography.bodyBold,
    fontSize: 9,
    color: Colors.accent,
    letterSpacing: 1.5,
  },
  visitRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 8,
    borderBottomWidth: 0.5,
    borderBottomColor: Colors.border,
  },
  visitTime: {
    fontFamily: Typography.heading,
    fontSize: 14,
    color: Colors.text,
    width: 48,
    fontVariant: ["tabular-nums"] as any,
  },
  visitPlayer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    flexShrink: 0,
  },
  visitName: {
    fontFamily: Typography.bodyBold,
    fontSize: 11,
    color: Colors.text,
    letterSpacing: 0.5,
  },
  visitNote: {
    flex: 1,
    fontFamily: Typography.body,
    fontSize: 10,
    color: Colors.muted,
    marginLeft: 2,
  },
  runsSectionTitle: {
    fontFamily: Typography.heading,
    fontSize: 12,
    color: Colors.muted,
    letterSpacing: 3,
  },

  // ── Create-run / plan-visit page sheets ──
  sheet: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  sheetHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderColor: Colors.border,
  },
  sheetTitle: {
    fontFamily: Typography.heading,
    fontSize: 16,
    color: Colors.text,
    letterSpacing: 3,
  },
  sheetClose: { padding: 4 },
  sheetContent: {
    paddingHorizontal: 20,
    paddingBottom: 40,
  },
  fieldLabel: {
    fontFamily: Typography.bodyBold,
    fontSize: 11,
    color: Colors.muted,
    letterSpacing: 2,
    textTransform: "uppercase" as const,
    marginTop: 20,
    marginBottom: 8,
  },
  fieldInput: {
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.surface,
    color: Colors.text,
    fontFamily: Typography.bodyMedium,
    fontSize: 13,
    paddingHorizontal: 12,
    minHeight: 44,
    paddingVertical: 10,
    borderRadius: Radius.xs,
  },

  // Court field (selected court w/ clear, or search typeahead)
  courtField: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.surface,
    borderRadius: Radius.xs,
    paddingLeft: 12,
    minHeight: 48,
  },
  courtFieldInfo: { flex: 1, gap: 1 },
  courtFieldName: {
    fontFamily: Typography.heading,
    fontSize: 13,
    color: Colors.text,
    letterSpacing: 0.5,
  },
  courtFieldSub: {
    fontFamily: Typography.body,
    fontSize: 11,
    color: Colors.muted,
  },
  courtFieldClear: {
    width: 44,
    alignSelf: "stretch",
    alignItems: "center",
    justifyContent: "center",
    borderLeftWidth: 1,
    borderLeftColor: Colors.border,
  },
  courtSearchBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.surface,
    borderRadius: Radius.xs,
    paddingHorizontal: 12,
    minHeight: 48,
  },
  courtSearchInput: {
    flex: 1,
    color: Colors.text,
    fontFamily: Typography.bodyMedium,
    fontSize: 13,
    paddingVertical: 12,
  },
  courtResults: {
    borderWidth: 1,
    borderTopWidth: 0,
    borderColor: Colors.border,
    backgroundColor: Colors.surface,
    borderRadius: Radius.xs,
  },
  courtResultRow: {
    minHeight: 48,
    justifyContent: "center",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderBottomWidth: 0.5,
    borderBottomColor: Colors.border,
  },
  courtResultsEmpty: {
    fontFamily: Typography.bodyBold,
    fontSize: 10,
    color: Colors.mutedDark,
    letterSpacing: 2,
    textAlign: "center",
    paddingVertical: 14,
  },

  // Day grid (7 equal cells)
  dayGrid: {
    flexDirection: "row",
    gap: 6,
  },
  dayGridCell: {
    flex: 1,
    minHeight: 52,
    alignItems: "center",
    justifyContent: "center",
    gap: 2,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.surface,
    borderRadius: Radius.xs,
  },
  dayGridCellActive: {
    backgroundColor: Colors.accent,
    borderColor: Colors.accent,
  },
  dayGridInitial: {
    fontFamily: Typography.bodyBold,
    fontSize: 9,
    color: Colors.muted,
    letterSpacing: 1,
  },
  dayGridInitialActive: { color: Colors.black },
  dayGridDate: {
    fontFamily: Typography.heading,
    fontSize: 15,
    color: Colors.text,
    lineHeight: 17,
  },
  dayGridDateActive: { color: Colors.black },

  // Time / size grids (equal-width rows of 4)
  gridRow: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 8,
  },
  gridCell: {
    flex: 1,
    minHeight: 44,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.surface,
    borderRadius: Radius.xs,
  },
  gridCellActive: {
    borderColor: Colors.accent,
    backgroundColor: Colors.accentDim,
  },
  gridCellDisabled: { opacity: 0.35 },
  gridCellSpacer: { flex: 1 },
  gridCellText: {
    fontFamily: Typography.heading,
    fontSize: 11,
    color: Colors.muted,
    letterSpacing: 1,
  },
  gridCellTextActive: { color: Colors.accent },
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
