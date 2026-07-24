import { router } from "expo-router";
import React, { useEffect, useMemo, useRef, useState } from "react";
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

/**
 * Schedule — weekly heatmap for one court (design mock 6). Rows are 2-hour
 * local-time slots, columns the 7 days of the shown week; cell intensity is
 * how many people are planned there (planned visits + run RSVPs). Tapping a
 * slot shows WHO right underneath — smart avatars, not just a number.
 */

const SLOT_HOURS = [8, 10, 12, 14, 16, 18, 20];

function slotLabel(h: number): string {
  const twelve = h % 12 === 0 ? 12 : h % 12;
  return `${twelve} ${h < 12 ? "AM" : "PM"}`;
}

interface SlotAttendee {
  id: string;
  name: string;
  initials: string;
  isMine: boolean;
  /** Set when this attendance is my own planned visit (removable). */
  visitId?: string;
}

interface SlotEntry {
  attendees: SlotAttendee[];
  count: number;
}

function CourtPickerModal({
  visible,
  onClose,
  localCourt,
  onSelect,
}: {
  visible: boolean;
  onClose: () => void;
  localCourt: Court | null;
  onSelect: (c: Court) => void;
}) {
  const { top } = useSafeAreaInsets();
  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={[styles.sheet, { paddingTop: Platform.OS === "ios" ? top : top + 12 }]}>
        <View style={styles.sheetHeader}>
          <Text style={styles.sheetTitle}>PICK A COURT</Text>
          <Pressable onPress={onClose} style={styles.sheetClose} hitSlop={12}>
            <Feather name="x" size={22} color={Colors.muted} />
          </Pressable>
        </View>
        <ScrollView contentContainerStyle={styles.sheetContent} keyboardShouldPersistTaps="handled">
          {localCourt && (
            <Pressable
              style={styles.pickerLocalRow}
              onPress={() => {
                onSelect(localCourt);
                onClose();
              }}
            >
              <Feather name="map-pin" size={14} color={Colors.accent} />
              <Text style={styles.pickerLocalText}>{localCourt.name.toUpperCase()}</Text>
              <Text style={styles.pickerLocalTag}>MY COURT</Text>
            </Pressable>
          )}
          <Text style={styles.fieldLabel}>SEARCH</Text>
          <CourtField
            selected={null}
            onSelect={(c) => {
              onSelect(c);
              onClose();
            }}
            onClear={() => {}}
          />
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
  const { bottom } = useSafeAreaInsets();

  const [showHost, setShowHost] = useState(false);
  const [showPlan, setShowPlan] = useState(false);
  const [showPicker, setShowPicker] = useState(false);
  const [pickedCourt, setPickedCourt] = useState<Court | null>(null);
  const [weekOffset, setWeekOffset] = useState<0 | 1>(0);
  const [selectedSlot, setSelectedSlot] = useState<{ day: number; slot: number } | null>(null);

  // Default to the local court once it hydrates; an explicit pick wins.
  const court = pickedCourt ?? localCourt;

  // ── Week window (rolling: page 0 starts today, page 1 is days 7–13 —
  // matches the 14-day data window in AppContext) ──
  const weekStart = useMemo(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() + weekOffset * 7);
    return d;
  }, [weekOffset]);

  const weekDays = useMemo(
    () =>
      Array.from({ length: 7 }, (_, i) => {
        const d = new Date(weekStart);
        d.setDate(weekStart.getDate() + i);
        return d;
      }),
    [weekStart]
  );

  const weekLabel = useMemo(() => {
    const fmt = (d: Date) => d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
    const last = weekDays[6];
    return weekStart.getMonth() === last.getMonth()
      ? `${fmt(weekStart)}–${last.getDate()}`
      : `${fmt(weekStart)} – ${fmt(last)}`;
  }, [weekStart, weekDays]);

  // ── Bucket planned visits + run RSVPs for this court into day × slot ──
  const slotMap = useMemo(() => {
    const map = new Map<string, SlotEntry>();
    if (!court) return map;
    const add = (iso: string, a: SlotAttendee) => {
      const t = new Date(iso);
      const dayIdx = Math.floor((t.getTime() - weekStart.getTime()) / 86_400_000);
      if (dayIdx < 0 || dayIdx > 6) return;
      const h = t.getHours();
      if (h < SLOT_HOURS[0] || h >= SLOT_HOURS[SLOT_HOURS.length - 1] + 2) return;
      const slotIdx = Math.floor((h - SLOT_HOURS[0]) / 2);
      const key = `${dayIdx}:${slotIdx}`;
      const entry = map.get(key) ?? { attendees: [], count: 0 };
      if (!entry.attendees.some((x) => x.id === a.id)) {
        entry.attendees.push(a);
        entry.count = entry.attendees.length;
        map.set(key, entry);
      } else if (a.visitId) {
        // Keep the removable visit reference even if the run RSVP landed first.
        const existing = entry.attendees.find((x) => x.id === a.id);
        if (existing && !existing.visitId) existing.visitId = a.visitId;
      }
    };
    for (const v of plannedVisits) {
      if (v.courtId !== court.id) continue;
      add(v.plannedAtIso, {
        id: v.userId,
        name: v.player.name,
        initials: v.player.avatar,
        isMine: v.userId === currentUser.id,
        visitId: v.id,
      });
    }
    for (const r of runs) {
      if (r.courtId !== court.id) continue;
      for (const p of r.participants) {
        add(r.startTimeIso, {
          id: p.id,
          name: p.name,
          initials: p.avatar,
          isMine: p.id === currentUser.id,
        });
      }
    }
    return map;
  }, [court, plannedVisits, runs, weekStart, currentUser.id]);

  const courtRuns = useMemo(() => {
    if (!court) return [];
    const end = new Date(weekStart);
    end.setDate(weekStart.getDate() + 7);
    return runs
      .filter((r) => {
        if (r.courtId !== court.id) return false;
        const t = new Date(r.startTimeIso).getTime();
        return t >= weekStart.getTime() && t < end.getTime();
      })
      .sort((a, b) => a.startTimeIso.localeCompare(b.startTimeIso));
  }, [court, runs, weekStart]);

  const selectedEntry = selectedSlot
    ? slotMap.get(`${selectedSlot.day}:${selectedSlot.slot}`)
    : undefined;
  const selectedDate = selectedSlot ? weekDays[selectedSlot.day] : null;

  const heatStyle = (count: number) => {
    if (count >= 5) return styles.heatHigh;
    if (count >= 2) return styles.heatMid;
    if (count >= 1) return styles.heatLow;
    return null;
  };

  const todayKey = new Date().toDateString();

  return (
    <View style={styles.container}>
      <ScreenHeader
        title="SCHEDULE"
        right={
          <Pressable
            onPress={() => router.push(`/player/${currentUser.id}`)}
            accessibilityLabel="My profile"
            style={{ marginBottom: 2 }}
          >
            <PlayerAvatar initials={currentUser.avatar} size={34} />
          </Pressable>
        }
      />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: (Platform.OS === "web" ? 84 : bottom + 96) + 68 }}
      >
        {/* ── Court selector ── */}
        <Pressable style={styles.courtSelector} onPress={() => setShowPicker(true)} testID="schedule-court-selector">
          <Feather name="map-pin" size={13} color={Colors.accent} />
          <Text style={styles.courtSelectorText} numberOfLines={1}>
            {court ? court.name : "Pick a court"}
          </Text>
          <Feather name="chevron-right" size={15} color={Colors.muted} />
        </Pressable>

        {/* ── Week nav ── */}
        <View style={styles.weekNav}>
          <Text style={styles.weekLabel}>{weekLabel}</Text>
          <View style={styles.weekArrows}>
            <Pressable
              style={[styles.weekArrow, weekOffset === 0 && styles.weekArrowDisabled]}
              disabled={weekOffset === 0}
              onPress={() => {
                setWeekOffset(0);
                setSelectedSlot(null);
              }}
            >
              <Feather name="chevron-left" size={16} color={weekOffset === 0 ? Colors.mutedDark : Colors.text} />
            </Pressable>
            <Pressable
              style={[styles.weekArrow, weekOffset === 1 && styles.weekArrowDisabled]}
              disabled={weekOffset === 1}
              onPress={() => {
                setWeekOffset(1);
                setSelectedSlot(null);
              }}
            >
              <Feather name="chevron-right" size={16} color={weekOffset === 1 ? Colors.mutedDark : Colors.text} />
            </Pressable>
          </View>
        </View>

        {/* ── Heatmap ── */}
        <View style={styles.heatmap}>
          {/* Day header row */}
          <View style={styles.heatRow}>
            <View style={styles.heatTimeCol} />
            {weekDays.map((d, i) => {
              const isToday = d.toDateString() === todayKey;
              return (
                <View key={i} style={styles.heatDayHeader}>
                  <Text style={[styles.heatDayName, isToday && styles.heatDayNameToday]}>
                    {DAYS[d.getDay()]}
                  </Text>
                  <Text style={[styles.heatDayDate, isToday && styles.heatDayDateToday]}>
                    {d.getDate()}
                  </Text>
                </View>
              );
            })}
          </View>
          {SLOT_HOURS.map((h, slotIdx) => (
            <View key={h} style={styles.heatRow}>
              <View style={styles.heatTimeCol}>
                <Text style={styles.heatTimeText}>{slotLabel(h)}</Text>
              </View>
              {weekDays.map((_, dayIdx) => {
                const entry = slotMap.get(`${dayIdx}:${slotIdx}`);
                const count = entry?.count ?? 0;
                const isSelected =
                  selectedSlot?.day === dayIdx && selectedSlot?.slot === slotIdx;
                return (
                  <Pressable
                    key={dayIdx}
                    style={[styles.heatCell, heatStyle(count), isSelected && styles.heatCellSelected]}
                    onPress={() =>
                      setSelectedSlot(isSelected ? null : { day: dayIdx, slot: slotIdx })
                    }
                    testID={`heat-${dayIdx}-${slotIdx}`}
                  >
                    {(isSelected || count >= 5) && count > 0 ? (
                      <Text style={styles.heatCellCount}>{count}</Text>
                    ) : null}
                  </Pressable>
                );
              })}
            </View>
          ))}
          {/* Legend */}
          <View style={styles.legendRow}>
            <View style={styles.legendScale}>
              <Text style={styles.legendText}>Quiet</Text>
              <View style={[styles.legendSwatch, { backgroundColor: Colors.surface }]} />
              <View style={[styles.legendSwatch, { backgroundColor: Colors.accentDim }]} />
              <View style={[styles.legendSwatch, { backgroundColor: Colors.accentGlow }]} />
              <View style={[styles.legendSwatch, { backgroundColor: Colors.accent }]} />
              <Text style={styles.legendText}>Busy</Text>
            </View>
            <Text style={styles.legendText}>Local time · 2-hr slots</Text>
          </View>
        </View>

        {/* ── Selected slot detail ── */}
        {selectedSlot && selectedDate && (
          <View style={styles.slotCard}>
            <Text style={styles.slotCardTitle}>
              {DAYS[selectedDate.getDay()]} {selectedDate.getDate()} · {slotLabel(SLOT_HOURS[selectedSlot.slot])}
              {"  "}
              <Text style={styles.slotCardGoing}>
                — {selectedEntry?.count ?? 0} GOING
              </Text>
            </Text>
            {selectedEntry && selectedEntry.count > 0 ? (
              <View style={styles.slotAvatars}>
                {selectedEntry.attendees.slice(0, 8).map((a) => (
                  <Pressable
                    key={a.id}
                    style={styles.slotAvatarItem}
                    onPress={() => router.push(`/player/${a.id}`)}
                  >
                    <PlayerAvatar initials={a.initials} size={36} accent={a.isMine} />
                    <Text style={styles.slotAvatarName} numberOfLines={1}>
                      {a.isMine ? "You" : a.name.split(" ")[0]}
                    </Text>
                  </Pressable>
                ))}
                {selectedEntry.count > 8 && (
                  <View style={styles.slotAvatarItem}>
                    <View style={styles.slotMore}>
                      <Text style={styles.slotMoreText}>+{selectedEntry.count - 8}</Text>
                    </View>
                  </View>
                )}
              </View>
            ) : (
              <Text style={styles.slotEmpty}>
                Nobody yet — post your time so people know to pull up.
              </Text>
            )}
            {(() => {
              const mine = selectedEntry?.attendees.find((a) => a.isMine && a.visitId);
              if (!mine?.visitId) return null;
              const visitId = mine.visitId;
              return (
                <Pressable
                  style={styles.slotRemoveBtn}
                  onPress={() => removePlannedVisit(visitId)}
                  testID={`remove-visit-${visitId}`}
                >
                  <Feather name="x" size={11} color={Colors.loss} />
                  <Text style={styles.slotRemoveText}>REMOVE MY TIME</Text>
                </Pressable>
              );
            })()}
          </View>
        )}

        {/* ── Scheduled runs ── */}
        <View style={styles.runsSection}>
          <Text style={styles.runsTitle}>Scheduled Runs</Text>
          {courtRuns.length === 0 ? (
            <View style={styles.runsEmpty}>
              <Text style={styles.runsEmptyText}>
                No runs at this court this week. Put one on the board.
              </Text>
            </View>
          ) : (
            courtRuns.map((run) => (
              <Pressable
                key={run.id}
                style={({ pressed }) => [styles.runCard, pressed && styles.pressed]}
                onPress={() => router.push(`/run/${run.id}`)}
              >
                <View style={{ flex: 1 }}>
                  <Text style={styles.runEyebrow}>
                    {run.date === "TODAY" ? "TONIGHT" : run.date} · {run.time}
                  </Text>
                  <Text style={styles.runTitle}>{run.title}</Text>
                  <View style={styles.runAvatarRow}>
                    {run.participants.slice(0, 4).map((p) => (
                      <PlayerAvatar key={p.id} initials={p.avatar} size={22} />
                    ))}
                    {run.participants.length > 4 && (
                      <Text style={styles.runAvatarMore}>+{run.participants.length - 4}</Text>
                    )}
                    {run.participants.length === 0 && (
                      <Text style={styles.runAvatarMore}>0/{run.maxPlayers}</Text>
                    )}
                  </View>
                </View>
                <Text style={styles.runViewLink}>View run ›</Text>
              </Pressable>
            ))
          )}
        </View>
      </ScrollView>

      {/* ── Bottom actions ── */}
      <View style={[styles.bottomBar, { paddingBottom: (Platform.OS === "web" ? 84 : bottom + 84) }]}>
        <Pressable style={styles.bottomBtn} onPress={() => setShowHost(true)} testID="host-run-add-btn">
          <Feather name="plus" size={14} color={Colors.text} />
          <Text style={styles.bottomBtnText}>CREATE RUN</Text>
        </Pressable>
        <Pressable style={styles.bottomBtn} onPress={() => setShowPlan(true)} testID="plan-visit-btn">
          <Feather name="clock" size={14} color={Colors.text} />
          <Text style={styles.bottomBtnText}>MY TIMES</Text>
        </Pressable>
      </View>

      <HostRunModal
        visible={showHost}
        onClose={() => setShowHost(false)}
        defaultCourt={court}
        organizerId={currentUser.id}
        onCreated={refreshRuns}
      />

      <PlanVisitModal
        visible={showPlan}
        onClose={() => setShowPlan(false)}
        defaultCourt={court}
        defaultDayIndex={selectedSlot ? weekOffset * 7 + selectedSlot.day : 0}
        onSubmit={addPlannedVisit}
      />

      <CourtPickerModal
        visible={showPicker}
        onClose={() => setShowPicker(false)}
        localCourt={localCourt}
        onSelect={setPickedCourt}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  pressed: { backgroundColor: Colors.surfaceHigh },

  // ── Court selector + week nav ──
  courtSelector: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: 0.5,
    borderBottomColor: Colors.border,
  },
  courtSelectorText: {
    flex: 1,
    fontFamily: Typography.bodySemiBold,
    fontSize: 13,
    color: Colors.text,
    letterSpacing: 0.3,
  },
  weekNav: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 10,
  },
  weekLabel: {
    fontFamily: Typography.heading,
    fontSize: 18,
    color: Colors.text,
    letterSpacing: 0.5,
  },
  weekArrows: { flexDirection: "row", gap: 8 },
  weekArrow: {
    width: 32,
    height: 32,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.sm,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: Colors.surface,
  },
  weekArrowDisabled: { opacity: 0.4 },

  // ── Heatmap ──
  heatmap: { paddingHorizontal: 20 },
  heatRow: { flexDirection: "row", gap: 4, marginBottom: 4, alignItems: "center" },
  heatTimeCol: { width: 40 },
  heatTimeText: {
    fontFamily: Typography.bodyMedium,
    fontSize: 9,
    color: Colors.muted,
    letterSpacing: 0.5,
  },
  heatDayHeader: { flex: 1, alignItems: "center", paddingBottom: 4 },
  heatDayName: {
    fontFamily: Typography.bodySemiBold,
    fontSize: 8,
    color: Colors.muted,
    letterSpacing: 1,
  },
  heatDayNameToday: { color: Colors.accent },
  heatDayDate: {
    fontFamily: Typography.heading,
    fontSize: 13,
    color: Colors.textSecondary,
    marginTop: 1,
  },
  heatDayDateToday: { color: Colors.text },
  heatCell: {
    flex: 1,
    height: 28,
    borderRadius: Radius.sm,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.borderSubtle,
    alignItems: "center",
    justifyContent: "center",
  },
  heatLow: { backgroundColor: Colors.accentDim, borderColor: Colors.borderSubtle },
  heatMid: { backgroundColor: Colors.accentGlow, borderColor: Colors.borderSubtle },
  heatHigh: { backgroundColor: Colors.accent, borderColor: Colors.accent },
  heatCellSelected: { borderColor: Colors.white, borderWidth: 1.5 },
  heatCellCount: {
    fontFamily: Typography.heading,
    fontSize: 12,
    color: Colors.text,
  },
  legendRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 8,
  },
  legendScale: { flexDirection: "row", alignItems: "center", gap: 5 },
  legendSwatch: {
    width: 10,
    height: 10,
    borderRadius: 2,
    borderWidth: 0.5,
    borderColor: Colors.borderSubtle,
  },
  legendText: {
    fontFamily: Typography.body,
    fontSize: 9,
    color: Colors.muted,
  },

  // ── Slot detail card ──
  slotCard: {
    marginHorizontal: 20,
    marginTop: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: Colors.accent,
    borderRadius: Radius.md,
    backgroundColor: Colors.surface,
  },
  slotCardTitle: {
    fontFamily: Typography.heading,
    fontSize: 14,
    color: Colors.text,
    letterSpacing: 1,
    marginBottom: 12,
  },
  slotCardGoing: { color: Colors.accent },
  slotAvatars: { flexDirection: "row", flexWrap: "wrap", gap: 12 },
  slotAvatarItem: { alignItems: "center", width: 44 },
  slotAvatarName: {
    fontFamily: Typography.bodyMedium,
    fontSize: 9,
    color: Colors.textSecondary,
    marginTop: 4,
  },
  slotMore: {
    width: 36,
    height: 36,
    borderRadius: 7,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: "center",
    justifyContent: "center",
  },
  slotMoreText: {
    fontFamily: Typography.heading,
    fontSize: 11,
    color: Colors.muted,
  },
  slotEmpty: {
    fontFamily: Typography.body,
    fontSize: 12,
    color: Colors.muted,
    lineHeight: 17,
  },
  slotRemoveBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    alignSelf: "flex-start",
    marginTop: 12,
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderWidth: 0.5,
    borderColor: Colors.loss,
    borderRadius: Radius.xs,
  },
  slotRemoveText: {
    fontFamily: Typography.bodyBold,
    fontSize: 9,
    color: Colors.loss,
    letterSpacing: 1.5,
  },

  // ── Scheduled runs ──
  runsSection: { paddingHorizontal: 20, paddingTop: 24 },
  runsTitle: {
    fontFamily: Typography.heading,
    fontSize: 17,
    color: Colors.text,
    letterSpacing: 0.5,
    marginBottom: 12,
  },
  runsEmpty: { paddingVertical: 8 },
  runsEmptyText: {
    fontFamily: Typography.body,
    fontSize: 12,
    color: Colors.muted,
    lineHeight: 18,
  },
  runCard: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.md,
    backgroundColor: Colors.surface,
    padding: 14,
    marginBottom: 10,
  },
  runEyebrow: {
    fontFamily: Typography.bodySemiBold,
    fontSize: 9,
    color: Colors.muted,
    letterSpacing: 1.5,
    marginBottom: 3,
  },
  runTitle: {
    fontFamily: Typography.heading,
    fontSize: 16,
    color: Colors.text,
    letterSpacing: 0.3,
    marginBottom: 8,
  },
  runAvatarRow: { flexDirection: "row", alignItems: "center", gap: 4 },
  runAvatarMore: {
    fontFamily: Typography.bodyMedium,
    fontSize: 10,
    color: Colors.muted,
    marginLeft: 4,
  },
  runViewLink: {
    fontFamily: Typography.bodyBold,
    fontSize: 11,
    color: Colors.accent,
    letterSpacing: 0.5,
    paddingLeft: 12,
  },

  // ── Bottom actions ──
  bottomBar: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: "row",
    gap: 10,
    paddingHorizontal: 20,
    paddingTop: 10,
    backgroundColor: Colors.background,
    borderTopWidth: 0.5,
    borderTopColor: Colors.border,
  },
  bottomBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 7,
    minHeight: 46,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.sm,
    backgroundColor: Colors.surfaceHigh,
  },
  bottomBtnText: {
    fontFamily: Typography.heading,
    fontSize: 12,
    color: Colors.text,
    letterSpacing: 1.5,
  },

  // ── Court picker ──
  pickerLocalRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.surface,
    borderRadius: Radius.xs,
    paddingHorizontal: 12,
    minHeight: 48,
    marginTop: 20,
  },
  pickerLocalText: {
    flex: 1,
    fontFamily: Typography.heading,
    fontSize: 13,
    color: Colors.text,
    letterSpacing: 0.5,
  },
  pickerLocalTag: {
    fontFamily: Typography.bodyBold,
    fontSize: 8,
    color: Colors.accent,
    letterSpacing: 1.5,
  },

  // ── Create-run / plan-visit page sheets (used by the modals above) ──
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
