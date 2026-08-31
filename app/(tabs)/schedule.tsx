import { router, useFocusEffect, useLocalSearchParams } from "expo-router";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
import { Layout } from "@/constants/layout";
import { Court, PlannedVisit, getSportColor } from "@/constants/data";
import { PlayerAvatar } from "@/components/PlayerAvatar";
import { RunCard } from "@/components/RunCard";
import { ScreenHeader } from "@/components/ScreenHeader";
import { FormSheet } from "@/components/sheet/FormSheet";
import { RunFlowSheet } from "@/components/sheet/RunFlowSheet";
import { SpeedDialFab } from "@/components/ui/SpeedDialFab";
import { scheduleSlotIndex, scheduleSlotLabel, SLOT_HOURS } from "@/components/schedule/scheduleModel";
import {
  formatScheduledGameTime,
  generatedScheduledGameTitle,
  maxPlayersForFormat,
  scheduledFormatsForSport,
  shiftScheduledGameTime,
  type ScheduledGameFormat,
} from "@/components/schedule/scheduledGameModel";
import { Typography } from "@/constants/typography";
import { useApp } from "@/context/AppContext";
import { createScheduledGame } from "@/services/scheduledGameService";
import { fetchCourtPlannedTimes } from "@/services/plannedVisitService";
import { fetchCourtById, searchCourts } from "@/services/courtService";

const DAYS = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"];

const RUN_TIMES = [
  "08:00", "09:00", "10:00", "11:00", "12:00", "13:00", "14:00", "15:00",
  "16:00", "17:00", "18:00", "19:00", "20:00", "21:00", "22:00", "23:00",
];

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

/**
 * Next 14 days starting today — matches the heatmap's two-week window so a
 * next-week slot selection round-trips into these pickers without clamping.
 */
// Runs can be scheduled further out than the rolling week (they live on the
// upcoming list, not the heatmap); planned "My Times" stay a rolling 7 days.
const RUN_PICKER_DAYS = 7;
const VISIT_PICKER_DAYS = 7;
function getNextDays(count: number): { initial: string; date: number; offset: number }[] {
  const today = new Date();
  return Array.from({ length: count }, (_, i) => {
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

/** Day picker in symmetric 7-cell rows: weekday initial + day number. */
function DayGrid({
  selected,
  onSelect,
  days: dayCount = RUN_PICKER_DAYS,
}: {
  selected: number;
  onSelect: (offset: number) => void;
  days?: number;
}) {
  const days = getNextDays(dayCount);
  const rows: typeof days[] = [];
  for (let i = 0; i < days.length; i += 7) rows.push(days.slice(i, i + 7));
  return (
    <View>
      {rows.map((row, ri) => (
        <View key={ri} style={[styles.dayGrid, ri > 0 && { marginTop: 6 }]}>
          {row.map((d) => {
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
      ))}
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
  organizerName,
  onCreated,
}: {
  visible: boolean;
  onClose: () => void;
  defaultCourt: Court | null;
  organizerId: string;
  organizerName: string;
  onCreated: () => Promise<void>;
}) {
  const [note, setNote] = useState("");
  const [court, setCourt] = useState<Court | null>(defaultCourt);
  const [dayOffset, setDayOffset] = useState(0);
  const [time, setTime] = useState("18:00");
  const [format, setFormat] = useState<ScheduledGameFormat>("5V5");
  const [submitting, setSubmitting] = useState(false);
  const [failed, setFailed] = useState(false);

  const formats = scheduledFormatsForSport(court?.sport ?? "BASKETBALL");
  const generatedTitle = generatedScheduledGameTitle(organizerName, format);

  // Re-default the court each time the sheet opens (ref so the 30s context
  // poll can't reset a court the user picked mid-edit).
  const defaultCourtRef = useRef(defaultCourt);
  defaultCourtRef.current = defaultCourt;
  useEffect(() => {
    if (visible) {
      setCourt(defaultCourtRef.current);
      const nextHour = new Date().getHours() + 1;
      setDayOffset(nextHour > 23 ? 1 : 0);
      setTime(`${String(nextHour > 23 ? 18 : Math.max(8, nextHour)).padStart(2, "0")}:00`);
      setFailed(false);
    }
  }, [visible]);

  useEffect(() => {
    if (!formats.includes(format)) setFormat(formats[0]);
  }, [format, formats]);

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
      title: generatedTitle,
      startTime: startTime.toISOString(),
      maxPlayers: maxPlayersForFormat(format),
      note: note.trim() || undefined,
    });
    setSubmitting(false);
    if (!created) {
      setFailed(true);
      return;
    }
    await onCreated();
    setNote("");
    onClose();
  };

  return (
    <RunFlowSheet
      visible={visible}
      onClose={onClose}
      eyebrow="SCHEDULED GAME"
      title="Create game"
      bottomClearance={Layout.tabBarClearance}
    >
          <View style={styles.gamePreview}>
            <View style={styles.gamePreviewTop}>
              <Text style={styles.gamePreviewTitle}>{generatedTitle}</Text>
              <Text style={styles.gamePreviewTime}>{formatScheduledGameTime(time)}</Text>
            </View>
            <Text style={styles.gamePreviewCourt} numberOfLines={1}>
              {court?.name.toUpperCase() ?? "SELECT A COURT"}
            </Text>
            <Text style={styles.gamePreviewMeta}>
              ONE GAME · TWO TEAMS · OFFICIAL RESULT
            </Text>
          </View>

          <Text style={styles.fieldLabel}>FORMAT</Text>
          <View style={styles.formatRow}>
            {formats.map((option) => (
              <Pressable
                key={option}
                accessibilityRole="button"
                accessibilityState={{ selected: option === format }}
                onPress={() => setFormat(option)}
                style={[styles.formatOption, option === format && styles.formatOptionActive]}
              >
                <Text style={[styles.formatOptionText, option === format && styles.formatOptionTextActive]}>
                  {option}
                </Text>
              </Pressable>
            ))}
          </View>

          <Text style={styles.fieldLabel}>COURT</Text>
          <CourtField selected={court} onSelect={setCourt} onClear={() => setCourt(null)} />

          <Text style={styles.fieldLabel}>DAY · NEXT 7 DAYS</Text>
          <DayGrid selected={dayOffset} onSelect={setDayOffset} days={RUN_PICKER_DAYS} />

          <Text style={styles.fieldLabel}>START TIME</Text>
          <View style={styles.timeStepper}>
            <Pressable
              accessibilityLabel="One hour earlier"
              onPress={() => setTime((value) => shiftScheduledGameTime(value, -1))}
              style={styles.timeStepButton}
            >
              <Feather name="minus" size={20} color={Colors.textSecondary} />
            </Pressable>
            <View style={styles.timeStepValue}>
              <Text style={styles.timeStepText}>{formatScheduledGameTime(time)}</Text>
            </View>
            <Pressable
              accessibilityLabel="One hour later"
              onPress={() => setTime((value) => shiftScheduledGameTime(value, 1))}
              style={styles.timeStepButton}
            >
              <Feather name="plus" size={20} color={Colors.textSecondary} />
            </Pressable>
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
            <Text style={styles.createError}>COULD NOT SCHEDULE GAME — TRY AGAIN</Text>
          )}

          <Pressable
            style={[styles.createBtn, !canSubmit && styles.createBtnDisabled]}
            onPress={handleCreate}
            disabled={!canSubmit}
          >
            <Text style={styles.createBtnText}>
              {submitting ? "CREATING…" : "SCHEDULE GAME"}
            </Text>
          </Pressable>
    </RunFlowSheet>
  );
}

type Visibility = "public" | "friends" | "private";
const VISIBILITY_OPTIONS: { value: Visibility; label: string; hint: string }[] = [
  { value: "public", label: "PUBLIC", hint: "Anyone can see you're pulling up" },
  { value: "friends", label: "FRIENDS", hint: "Only friends see your name" },
  { value: "private", label: "PRIVATE", hint: "Just for you — still counts on the heatmap" },
];

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
  onSubmit: (courtId: string, plannedAtIso: string, note?: string, visibility?: Visibility) => Promise<boolean>;
}) {

  const [note, setNote] = useState("");
  const [court, setCourt] = useState<Court | null>(defaultCourt);
  const [dayOffset, setDayOffset] = useState(0);
  const [time, setTime] = useState("18:00");
  const [visibility, setVisibility] = useState<Visibility>("public");
  const [submitting, setSubmitting] = useState(false);
  const [failed, setFailed] = useState(false);

  // Re-default court + day each time the sheet opens. defaultDayIndex is a
  // rolling offset from today (0 = today); clamp to the rolling-week picker.
  const defaultsRef = useRef({ defaultCourt, defaultDayIndex });
  defaultsRef.current = { defaultCourt, defaultDayIndex };
  useEffect(() => {
    if (visible) {
      const { defaultCourt: dc, defaultDayIndex: di } = defaultsRef.current;
      setCourt(dc);
      setDayOffset(Math.min(VISIT_PICKER_DAYS - 1, Math.max(0, di)));
      setFailed(false);
    }
  }, [visible]);

  const plannedAt = offsetDate(dayOffset, time);
  const canSubmit = !!court && plannedAt.getTime() > Date.now() && !submitting;

  const handleSubmit = async () => {
    if (!canSubmit || !court) return;
    setSubmitting(true);
    setFailed(false);
    const ok = await onSubmit(court.id, plannedAt.toISOString(), note.trim() || undefined, visibility);
    setSubmitting(false);
    if (!ok) {
      setFailed(true);
      return;
    }
    setNote("");
    onClose();
  };

  const activeHint = VISIBILITY_OPTIONS.find((o) => o.value === visibility)?.hint;

  return (
    <FormSheet visible={visible} onClose={onClose} title="I'll be there">
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.sheetContent}
          keyboardShouldPersistTaps="handled"
        >
          <Text style={styles.fieldLabel}>COURT</Text>
          <CourtField selected={court} onSelect={setCourt} onClear={() => setCourt(null)} />

          <Text style={styles.fieldLabel}>DAY</Text>
          <DayGrid selected={dayOffset} onSelect={setDayOffset} days={VISIT_PICKER_DAYS} />

          <Text style={styles.fieldLabel}>AROUND WHAT TIME</Text>
          <TimeGrid selected={time} dayOffset={dayOffset} onSelect={setTime} />

          <Text style={styles.fieldLabel}>WHO CAN SEE THIS</Text>
          <View style={styles.gridRow}>
            {VISIBILITY_OPTIONS.map((opt) => (
              <Pressable
                key={opt.value}
                style={[styles.gridCell, visibility === opt.value && styles.gridCellActive]}
                onPress={() => setVisibility(opt.value)}
                testID={`visibility-${opt.value}`}
              >
                <Text style={[styles.gridCellText, visibility === opt.value && styles.gridCellTextActive]}>
                  {opt.label}
                </Text>
              </Pressable>
            ))}
          </View>
          {activeHint ? <Text style={styles.visibilityHint}>{activeHint}</Text> : null}

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
    </FormSheet>
  );
}

/**
 * Schedule — weekly heatmap for one court. Rows are 1-hour
 * local-time slots, columns the 7 days of the shown week; cell intensity is
 * how many people are planned there (planned visits + run RSVPs). Tapping a
 * slot shows WHO right underneath — smart avatars, not just a number.
 */

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
  /** Distinct visible planned-visit users in this slot (for hidden-count math). */
  plannedVisible: number;
  runCount: number;
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
  return (
    <FormSheet visible={visible} onClose={onClose} title="Pick a court">
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
    </FormSheet>
  );
}

export default function ScheduleScreen() {
  const {
    courts,
    localCourt,
    runs,
    plannedVisits,
    currentUser,
    refreshRuns,
    removePlannedVisit,
    savePlannedVisitBatch,
  } = useApp();
  const params = useLocalSearchParams<{ courtId?: string; openCreate?: string }>();
  const { top, bottom } = useSafeAreaInsets();

  const [showHost, setShowHost] = useState(false);
  const [showPicker, setShowPicker] = useState(false);
  const [pickedCourt, setPickedCourt] = useState<Court | null>(null);
  const [selectedSlot, setSelectedSlot] = useState<{ day: number; slot: number } | null>(null);
  const [scheduleMode, setScheduleMode] = useState<"VIEW" | "EDIT">("VIEW");
  const [pendingKeys, setPendingKeys] = useState<Set<string>>(new Set());
  const [editVisibility, setEditVisibility] = useState<Visibility>("public");
  const [savingTimes, setSavingTimes] = useState(false);
  // Null when there is nothing to say. Any string here is shown verbatim, so a
  // save can never look successful when nothing actually reached the database.
  const [saveNotice, setSaveNotice] = useState<string | null>(null);
  // Anonymous planned-time counts per slot (from court_planned_times RPC):
  // includes friends-only/private plans so heatmap intensity is honest without
  // exposing who they are.
  const [plannedBuckets, setPlannedBuckets] = useState<Record<string, number>>({});
  const consumedCourtParamRef = useRef<string | null>(null);
  const consumedCreateParamRef = useRef<string | null>(null);
  const saveNoticeTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    return () => {
      if (saveNoticeTimeoutRef.current) clearTimeout(saveNoticeTimeoutRef.current);
    };
  }, []);

  // Default to the local court once it hydrates; an explicit pick wins.
  const court = pickedCourt ?? localCourt;

  // Court Details deep-links here with the court already selected. Resolve it
  // from the in-memory discovery set first, then fall back to one direct read.
  useEffect(() => {
    const requestedId = typeof params.courtId === "string" ? params.courtId : null;
    if (!requestedId || consumedCourtParamRef.current === requestedId) return;
    consumedCourtParamRef.current = requestedId;
    const known = courts.find((item) => item.id === requestedId);
    if (known) {
      setPickedCourt(known);
      return;
    }
    let cancelled = false;
    fetchCourtById(requestedId).then((result) => {
      if (!cancelled && result) setPickedCourt(result);
    });
    return () => {
      cancelled = true;
    };
  }, [params.courtId, courts]);

  // A Court Details "Create a run" handoff opens the form exactly once after
  // the requested court is selected. Later manual court choices stay manual.
  useEffect(() => {
    const requestedId = typeof params.courtId === "string" ? params.courtId : null;
    const openCreate = params.openCreate === "1";
    const requestKey = openCreate ? `${requestedId ?? "local"}:create` : null;
    if (!requestKey || consumedCreateParamRef.current === requestKey) return;
    if (requestedId && court?.id !== requestedId) return;
    consumedCreateParamRef.current = requestKey;
    setShowHost(true);
  }, [params.courtId, params.openCreate, court?.id]);

  // ── Rolling week: today + next 6 days. Deliberately NOT paginated — planned
  // "My Times" is a near-term "who's pulling up this week" signal; scheduling
  // further out lives on runs (the upcoming list below), not the heatmap. ──
  const dayStamp = new Date().toDateString();
  const weekStart = useMemo(() => {
    const d = new Date(dayStamp);
    d.setHours(0, 0, 0, 0);
    return d;
  }, [dayStamp]);

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

  const bucketKey = useCallback(
    (iso: string): string | null => {
      const t = new Date(iso);
      const dayIdx = Math.floor((t.getTime() - weekStart.getTime()) / 86_400_000);
      if (dayIdx < 0 || dayIdx > 6) return null;
      const h = t.getHours();
      if (h < SLOT_HOURS[0] || h >= SLOT_HOURS[SLOT_HOURS.length - 1] + 1) return null;
      return `${dayIdx}:${h - SLOT_HOURS[0]}`;
    },
    [weekStart]
  );

  // Pull the anonymous planned-time counts for the visible court + week. Re-runs
  // when the user's own planned visits change so a post reflects immediately.
  useEffect(() => {
    if (!court) {
      setPlannedBuckets({});
      return;
    }
    let cancelled = false;
    const end = new Date(weekStart);
    end.setDate(weekStart.getDate() + 7);
    fetchCourtPlannedTimes(court.id, weekStart, end).then((times) => {
      if (cancelled) return;
      const b: Record<string, number> = {};
      for (const t of times) {
        const key = bucketKey(t.toISOString());
        if (key) b[key] = (b[key] ?? 0) + 1;
      }
      setPlannedBuckets(b);
    });
    return () => {
      cancelled = true;
    };
  }, [court, weekStart, bucketKey, plannedVisits]);

  // ── Bucket VISIBLE planned visits + run RSVPs for this court into day × slot ──
  const slotMap = useMemo(() => {
    const map = new Map<string, SlotEntry>();
    if (!court) return map;
    const add = (iso: string, a: SlotAttendee, isPlanned: boolean) => {
      const key = bucketKey(iso);
      if (!key) return;
      const entry = map.get(key) ?? { attendees: [], count: 0, plannedVisible: 0, runCount: 0 };
      const existing = entry.attendees.find((x) => x.id === a.id);
      if (!existing) {
        entry.attendees.push(a);
        entry.count = entry.attendees.length;
        if (isPlanned) entry.plannedVisible += 1;
        map.set(key, entry);
      } else if (a.visitId && !existing.visitId) {
        existing.visitId = a.visitId;
      }
    };
    for (const v of plannedVisits) {
      if (v.courtId !== court.id) continue;
      add(
        v.plannedAtIso,
        {
          id: v.userId,
          name: v.player.name,
          initials: v.player.avatar,
          isMine: v.userId === currentUser.id,
          visitId: v.id,
        },
        true
      );
    }
    for (const r of runs) {
      if (r.courtId !== court.id) continue;
      const runKey = bucketKey(r.startTimeIso);
      if (runKey) {
        const entry = map.get(runKey) ?? { attendees: [], count: 0, plannedVisible: 0, runCount: 0 };
        entry.runCount += 1;
        map.set(runKey, entry);
      }
      for (const p of r.participants) {
        add(
          r.startTimeIso,
          { id: p.id, name: p.name, initials: p.avatar, isMine: p.id === currentUser.id },
          false
        );
      }
    }
    return map;
  }, [court, plannedVisits, runs, currentUser.id, bucketKey]);

  // Hidden = anonymous planned count for the slot minus the planned visits I can
  // actually see (friends-only/private plans of others).
  const slotHidden = useCallback(
    (key: string) => {
      const rpc = plannedBuckets[key] ?? 0;
      const visiblePlanned = slotMap.get(key)?.plannedVisible ?? 0;
      return Math.max(0, rpc - visiblePlanned);
    },
    [plannedBuckets, slotMap]
  );
  const slotTotal = useCallback(
    (key: string) => (slotMap.get(key)?.attendees.length ?? 0) + slotHidden(key),
    [slotMap, slotHidden]
  );

  const myVisitsByKey = useMemo(() => {
    const map = new Map<string, PlannedVisit[]>();
    if (!court) return map;
    for (const visit of plannedVisits) {
      if (visit.courtId !== court.id || visit.userId !== currentUser.id) continue;
      const key = bucketKey(visit.plannedAtIso);
      if (!key) continue;
      map.set(key, [...(map.get(key) ?? []), visit]);
    }
    return map;
  }, [court, plannedVisits, currentUser.id, bucketKey]);

  const hasPendingChanges = useMemo(() => {
    if (pendingKeys.size !== myVisitsByKey.size) return true;
    return Array.from(pendingKeys).some((key) => !myVisitsByKey.has(key));
  }, [pendingKeys, myVisitsByKey]);

  // All upcoming runs for this court (runs can be scheduled beyond the rolling
  // week — they surface here, not on the heatmap).
  const courtRuns = useMemo(() => {
    if (!court) return [];
    return runs
      .filter((r) => r.courtId === court.id && new Date(r.startTimeIso).getTime() >= weekStart.getTime())
      .sort((a, b) => a.startTimeIso.localeCompare(b.startTimeIso));
  }, [court, runs, weekStart]);

  const selectedKey = selectedSlot ? `${selectedSlot.day}:${selectedSlot.slot}` : null;
  const selectedEntry = selectedKey ? slotMap.get(selectedKey) : undefined;
  const selectedDate = selectedSlot ? weekDays[selectedSlot.day] : null;

  const heatStyle = (count: number) => {
    if (count >= 5) return styles.heatHigh;
    if (count >= 2) return styles.heatMid;
    if (count >= 1) return styles.heatLow;
    return null;
  };

  const currentSlotIndex = Math.max(
    0,
    scheduleSlotIndex(new Date().getHours())
  );
  const currentKey = `0:${currentSlotIndex}`;

  // Returning to Schedule should always answer "what is happening now?" first.
  // A deliberate tap can still move the detail card to any other slot.
  useFocusEffect(
    useCallback(() => {
      if (scheduleMode === "VIEW") {
        setSelectedSlot({ day: 0, slot: currentSlotIndex });
      }
    }, [currentSlotIndex, scheduleMode])
  );

  const beginEditingTimes = () => {
    if (!court || court.id !== localCourt?.id) {
      if (saveNoticeTimeoutRef.current) clearTimeout(saveNoticeTimeoutRef.current);
      setSaveNotice("TIMES CAN ONLY BE EDITED AT YOUR LOCAL COURT.");
      saveNoticeTimeoutRef.current = setTimeout(() => setSaveNotice(null), 3200);
      return;
    }
    setPendingKeys(new Set(myVisitsByKey.keys()));
    setSelectedSlot(null);
    setSaveNotice(null);
    setScheduleMode("EDIT");
  };

  const cancelEditingTimes = () => {
    setPendingKeys(new Set());
    setSaveNotice(null);
    setScheduleMode("VIEW");
  };

  const togglePendingKey = (key: string) => {
    setPendingKeys((current) => {
      const next = new Set(current);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
    setSaveNotice(null);
  };

  const saveMyTimes = async () => {
    if (savingTimes) return;
    // Save used to return silently with no court selected, so the button simply
    // did nothing. Send the user to the picker instead of failing invisibly.
    if (!court) {
      setSaveNotice("PICK A COURT BEFORE SAVING YOUR TIMES.");
      setShowPicker(true);
      return;
    }
    if (court.id !== localCourt?.id) {
      setSaveNotice("TIMES CAN ONLY BE SAVED AT YOUR LOCAL COURT.");
      return;
    }
    const additions = Array.from(pendingKeys)
      .filter((key) => !myVisitsByKey.has(key))
      .map((key) => {
        const [day, slot] = key.split(":").map(Number);
        const date = new Date(weekDays[day]);
        date.setHours(SLOT_HOURS[slot], 0, 0, 0);
        // The active two-hour block is still actionable even though its start
        // time has passed. Store "now" so it remains valid and buckets back
        // into the current block.
        if (key === currentKey && date.getTime() <= Date.now()) {
          date.setTime(Date.now() + 60_000);
        }
        return date.toISOString();
      })
      .filter((iso) => new Date(iso).getTime() > Date.now());
    const removals = Array.from(myVisitsByKey.entries())
      .filter(([key]) => !pendingKeys.has(key))
      .flatMap(([, visits]) => visits.map((visit) => visit.id));

    // A batch of nothing must never report success. This happened when every
    // pending slot had already passed: `additions` became `[]`, and
    // `[].every(Boolean)` is `true`, so the editor closed as if it had saved.
    if (additions.length === 0 && removals.length === 0) {
      setSaveNotice("NO CHANGES TO SAVE.");
      return;
    }

    setSavingTimes(true);
    setSaveNotice(null);
    const ok = await savePlannedVisitBatch(court.id, additions, removals, editVisibility);
    setSavingTimes(false);
    if (!ok) {
      setSaveNotice("SOME TIMES DIDN'T SAVE. YOUR SELECTIONS ARE STILL HERE. TRY AGAIN.");
      return;
    }
    setScheduleMode("VIEW");
    setPendingKeys(new Set());
  };

  const todayKey = new Date().toDateString();

  return (
    <View style={styles.container}>
      <ScreenHeader title="SCHEDULE" />

      <ScrollView
        style={styles.scheduleBody}
        contentContainerStyle={styles.scheduleBodyContent}
        nestedScrollEnabled
        showsVerticalScrollIndicator={false}
      >
        {/* ── Court selector ── */}
        <Pressable style={styles.courtSelector} onPress={() => setShowPicker(true)} testID="schedule-court-selector">
          <Feather name="map-pin" size={13} color={Colors.accent} />
          <Text style={styles.courtSelectorText} numberOfLines={1}>
            {court ? court.name : "Pick a court"}
          </Text>
          <Feather name="chevron-right" size={15} color={Colors.muted} />
        </Pressable>

        {/* ── Rolling-week label (no paging — see weekStart comment) ── */}
        <View style={styles.weekNav}>
          <View>
            <Text style={styles.weekEyebrow}>ROLLING WEEK</Text>
            <Text style={styles.weekLabel}>{weekLabel}</Text>
          </View>
          <View style={styles.weekStatus}>
            <Text style={styles.weekTag}>NEXT 7 DAYS</Text>
            {scheduleMode === "EDIT" ? <Text style={styles.editingLabel}>EDITING TIMES</Text> : null}
          </View>
        </View>

        {/* Mode lives in the header action (EDIT / CANCEL) — this row only
            reports state, so the grid stays the tallest thing on screen. */}
        <View style={styles.scheduleModeRow}>
          <Text style={styles.scheduleModeStatus}>
            {scheduleMode === "EDIT"
              ? `${pendingKeys.size} SELECTED — TAP TO ADD OR REMOVE`
              : "TAP A TIME TO SEE WHO'S GOING"}
          </Text>
        </View>

        {scheduleMode === "EDIT" ? (
          <View style={styles.editOptions}>
            <Text style={styles.editOptionsLabel}>NEW TIMES VISIBLE TO</Text>
            <View style={styles.editVisibilityRow}>
              {VISIBILITY_OPTIONS.map((option) => (
                <Pressable
                  key={option.value}
                  onPress={() => setEditVisibility(option.value)}
                  style={[styles.editVisibilityButton, editVisibility === option.value && styles.editVisibilityButtonActive]}
                  accessibilityRole="button"
                  accessibilityState={{ selected: editVisibility === option.value }}
                >
                  <Text style={[styles.editVisibilityText, editVisibility === option.value && styles.editVisibilityTextActive]}>
                    {option.label}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>
        ) : null}

        {/* ── Heatmap: the time axis scrolls; the rest of the page stays fixed. ── */}
        <View style={styles.heatmap}>
          {/* Day header row */}
          <View style={styles.heatRow}>
            <View style={styles.heatTimeCol} />
            {weekDays.map((d, i) => {
              const isToday = d.toDateString() === todayKey;
              return (
                <View key={i} style={styles.heatDayHeader}>
                  <Text style={[styles.heatDayName, isToday && styles.heatAxisActive]}>
                    {DAYS[d.getDay()]}
                  </Text>
                  <Text style={[styles.heatDayDate, isToday && styles.heatAxisActive]}>
                    {d.getDate()}
                  </Text>
                </View>
              );
            })}
          </View>
          <View style={styles.timeScrollCue} pointerEvents="none">
            <Text style={styles.timeScrollCueText}>SWIPE TIMES</Text>
            <Feather color={Colors.muted} name="chevrons-up" size={11} />
          </View>
          <ScrollView
            contentContainerStyle={styles.timeRows}
            contentOffset={{ x: 0, y: Math.max(0, (currentSlotIndex - 2) * 28) }}
            decelerationRate="fast"
            disableIntervalMomentum
            nestedScrollEnabled
            snapToAlignment="start"
            snapToInterval={28}
            showsVerticalScrollIndicator={false}
            style={styles.timeScroller}
          >
          {SLOT_HOURS.map((h, slotIdx) => (
            <View key={h} style={styles.heatRow}>
              <View style={styles.heatTimeCol}>
                <Text style={[styles.heatTimeText, slotIdx === currentSlotIndex && styles.heatAxisActive]}>{scheduleSlotLabel(h)}</Text>
              </View>
              {weekDays.map((_, dayIdx) => {
                const key = `${dayIdx}:${slotIdx}`;
                const count = slotTotal(key);
                const isSelected =
                  selectedSlot?.day === dayIdx && selectedSlot?.slot === slotIdx;
                const isCurrent = key === currentKey;
                const isMinePending = pendingKeys.has(key);
                const wasMine = myVisitsByKey.has(key);
                const previewCount = scheduleMode === "EDIT"
                  ? Math.max(0, count + (isMinePending && !wasMine ? 1 : 0) - (!isMinePending && wasMine ? 1 : 0))
                  : count;
                const slotDate = new Date(weekDays[dayIdx]);
                slotDate.setHours(SLOT_HOURS[slotIdx], 0, 0, 0);
                slotDate.setHours(SLOT_HOURS[slotIdx] + 1, 0, 0, 0);
                const isPast = slotDate.getTime() <= Date.now();
                return (
                  <Pressable
                    key={dayIdx}
                    style={[
                      styles.heatCell,
                      heatStyle(previewCount),
                      isCurrent && styles.heatCellCurrent,
                      isSelected && styles.heatCellSelected,
                      scheduleMode === "EDIT" && isMinePending && styles.heatCellMine,
                      scheduleMode === "EDIT" && isPast && !isMinePending && styles.heatCellDisabled,
                    ]}
                    onPress={() => scheduleMode === "EDIT"
                      ? togglePendingKey(key)
                      : setSelectedSlot(isSelected ? null : { day: dayIdx, slot: slotIdx })
                    }
                    disabled={scheduleMode === "EDIT" && isPast && !isMinePending}
                    accessibilityRole="button"
                    accessibilityLabel={`${DAYS[weekDays[dayIdx].getDay()]} ${weekDays[dayIdx].getDate()}, ${scheduleSlotLabel(SLOT_HOURS[slotIdx])}, ${previewCount} going${isMinePending ? ", selected as my time" : ""}`}
                    accessibilityState={{ selected: scheduleMode === "EDIT" ? isMinePending : isSelected, disabled: scheduleMode === "EDIT" && isPast && !isMinePending }}
                    testID={`heat-${dayIdx}-${slotIdx}`}
                  >
                    {scheduleMode === "EDIT" && isMinePending ? (
                      <Feather name="check" size={13} color={Colors.text} />
                    ) : (isSelected || previewCount >= 5) && previewCount > 0 ? (
                      <Text style={styles.heatCellCount}>{previewCount}</Text>
                    ) : null}
                    {(slotMap.get(key)?.runCount ?? 0) > 0 ? <View style={styles.runDot} /> : null}
                  </Pressable>
                );
              })}
            </View>
          ))}
          </ScrollView>
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
            <Text style={styles.legendText}>Local time · 1-hr slots</Text>
          </View>
        </View>

        {/* ── Selected slot detail ── */}
        {scheduleMode === "VIEW" && selectedSlot && selectedDate && selectedKey && (() => {
          const total = slotTotal(selectedKey);
          const hidden = slotHidden(selectedKey);
          const visible = selectedEntry?.attendees ?? [];
          return (
          <View style={styles.slotCard}>
            <Text style={styles.slotCardTitle}>
              {DAYS[selectedDate.getDay()]} {selectedDate.getDate()} · {scheduleSlotLabel(SLOT_HOURS[selectedSlot.slot])}
              {"  "}
              <Text style={styles.slotCardGoing}>— {total} GOING</Text>
            </Text>
            {total > 0 ? (
              <View style={styles.slotAvatars}>
                {visible.slice(0, 8).map((a) => (
                  <Pressable
                    key={a.id}
                    style={styles.slotAvatarItem}
                    onPress={() => router.push(`/player/${a.id}`)}
                  >
                    <PlayerAvatar initials={a.initials} name={a.name} playerId={a.id} size={36} accent={a.isMine} />
                    <Text style={styles.slotAvatarName} numberOfLines={1}>
                      {a.isMine ? "You" : a.name.split(" ")[0]}
                    </Text>
                  </Pressable>
                ))}
                {visible.length > 8 && (
                  <View style={styles.slotAvatarItem}>
                    <View style={styles.slotMore}>
                      <Text style={styles.slotMoreText}>+{visible.length - 8}</Text>
                    </View>
                  </View>
                )}
                {hidden > 0 && (
                  <View style={styles.slotAvatarItem}>
                    <View style={[styles.slotMore, styles.slotHiddenSquare]}>
                      <Text style={styles.slotMoreText}>+{hidden}</Text>
                    </View>
                    <Text style={styles.slotAvatarName}>hidden</Text>
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
          );
        })()}

        {/* ── Scheduled games ── */}
        <View style={styles.runsSection}>
          <Text style={styles.runsTitle}>Scheduled Games</Text>
          {courtRuns.length === 0 ? (
            <View style={styles.runsEmpty}>
              <Text style={styles.runsEmptyText}>
                No games scheduled at this court this week.
              </Text>
            </View>
          ) : courtRuns.map((run) => <RunCard key={run.id} run={run} />)}
        </View>
      </ScrollView>

      {scheduleMode === "VIEW" && court?.id === localCourt?.id ? (
        <SpeedDialFab
          accessibilityLabel="Open schedule actions"
          actions={[
            { label: "Add times", icon: "clock", onPress: beginEditingTimes },
            { label: "Schedule game", icon: "users", onPress: () => setShowHost(true) },
          ]}
          bottom={Platform.OS === "web" ? 102 : bottom + 78}
        />
      ) : null}

      {/* ── Bottom actions ── */}
      {scheduleMode === "EDIT" ? (
        <View style={[styles.bottomBar, { paddingBottom: (Platform.OS === "web" ? 84 : bottom + 84) }]}>
          <>
            <Pressable style={styles.bottomBtn} onPress={cancelEditingTimes} testID="cancel-edit-times-btn">
              <Text style={styles.bottomBtnText}>CANCEL</Text>
            </Pressable>
            <Pressable
              style={[
                styles.bottomBtn,
                styles.bottomBtnPrimary,
                (savingTimes || !hasPendingChanges) && styles.bottomBtnDisabled,
              ]}
              onPress={saveMyTimes}
              disabled={savingTimes || !hasPendingChanges}
              testID="save-edit-times-btn"
            >
              <Feather name="check" size={14} color={Colors.black} />
              <Text style={styles.bottomBtnPrimaryText}>
                {savingTimes ? "SAVING…" : "SAVE CHANGES"}
              </Text>
            </Pressable>
          </>
        </View>
      ) : null}

      {saveNotice ? (
        <View style={[styles.saveTimesError, { top: top + 12 }]}>
          <Text style={styles.saveTimesErrorText}>{saveNotice}</Text>
        </View>
      ) : null}

      <HostRunModal
        visible={showHost}
        onClose={() => setShowHost(false)}
        defaultCourt={court}
        organizerId={currentUser.id}
        organizerName={currentUser.name}
        onCreated={refreshRuns}
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
  scheduleBody: { flex: 1, minHeight: 0 },
  scheduleBodyContent: { flexGrow: 1, paddingBottom: 88 },
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
    paddingTop: 14,
    paddingBottom: 10,
  },
  weekEyebrow: { fontFamily: Typography.bodyMedium, fontSize: 11, lineHeight: 13, color: Colors.muted, letterSpacing: 1.4 },
  weekLabel: {
    fontFamily: Typography.heading,
    fontSize: 26,
    lineHeight: 30,
    color: Colors.text,
    letterSpacing: 0.5,
  },
  weekStatus: { alignItems: "flex-end", justifyContent: "center", gap: 5 },
  weekTag: {
    fontFamily: Typography.bodySemiBold,
    fontSize: 11,
    lineHeight: 13,
    color: Colors.accent,
    letterSpacing: 1.2,
  },
  scheduleModeRow: {
    paddingHorizontal: 20,
    paddingBottom: 6,
    gap: 8,
  },
  editingLabel: { fontFamily: Typography.bodyBold, fontSize: 8, color: Colors.accent, letterSpacing: 1.2 },
  modeToggle: { flexDirection: "row", minHeight: 34, borderWidth: 1, borderColor: Colors.border, borderRadius: Radius.sm, overflow: "hidden", backgroundColor: Colors.surface },
  modeToggleButton: { minWidth: 50, alignItems: "center", justifyContent: "center", paddingHorizontal: 8 },
  modeToggleButtonActive: { backgroundColor: Colors.surfaceHigh },
  modeToggleText: { fontFamily: Typography.bodyBold, fontSize: 8, color: Colors.muted, letterSpacing: 1.1 },
  modeToggleTextActive: { color: Colors.accent },
  scheduleModeStatus: {
    fontFamily: Typography.bodySemiBold,
    fontSize: 11,
    lineHeight: 13,
    color: Colors.textSecondary,
    letterSpacing: 0.25,
  },
  editOptions: {
    marginHorizontal: 20,
    marginBottom: 12,
    padding: 10,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.sm,
    backgroundColor: Colors.surface,
    gap: 8,
  },
  editOptionsLabel: {
    fontFamily: Typography.bodySemiBold,
    fontSize: 9,
    color: Colors.textSecondary,
    letterSpacing: 1.2,
  },
  editVisibilityRow: { flexDirection: "row", gap: 4 },
  editVisibilityButton: {
    flex: 1,
    minHeight: 34,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 0.5,
    borderColor: Colors.border,
  },
  editVisibilityButtonActive: { backgroundColor: Colors.surfaceHigh, borderColor: Colors.textSecondary },
  editVisibilityText: {
    fontFamily: Typography.bodyBold,
    fontSize: 8,
    color: Colors.muted,
    letterSpacing: 1,
  },
  editVisibilityTextActive: { color: Colors.text },
  visibilityHint: {
    fontFamily: Typography.body,
    fontSize: 11,
    color: Colors.muted,
    marginTop: -2,
    marginBottom: 2,
  },
  slotHiddenSquare: {
    borderStyle: "dashed",
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
  timeScroller: { maxHeight: 228 },
  timeRows: { paddingBottom: 2 },
  timeScrollCue: { width: 80, minHeight: 20, flexDirection: "row", alignItems: "center", justifyContent: "flex-start", gap: 4 },
  timeScrollCueText: { fontFamily: Typography.bodyMedium, fontSize: 11, lineHeight: 13, color: Colors.muted, letterSpacing: 0.25 },
  heatRow: { flexDirection: "row", gap: 3, marginBottom: 3, alignItems: "center" },
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
  heatAxisActive: {
    color: Colors.accent,
    textShadowColor: Colors.accentTextShadow,
    textShadowRadius: 7,
  },
  heatCell: {
    position: "relative",
    flex: 1,
    height: 25,
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
  heatCellCurrent: {
    borderColor: Colors.accent,
    borderStyle: "dashed",
    shadowColor: Colors.accent,
    shadowOpacity: 0.28,
    shadowRadius: 5,
    shadowOffset: { width: 0, height: 0 },
  },
  heatCellMine: { borderColor: Colors.text, borderWidth: 2 },
  heatCellDisabled: { opacity: 0.34 },
  heatCellCount: {
    fontFamily: Typography.heading,
    fontSize: 12,
    color: Colors.text,
  },
  runDot: { position: "absolute", right: 3, top: 3, width: 4, height: 4, borderRadius: 2, backgroundColor: Colors.accent },
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
  runsSection: { paddingHorizontal: 20, paddingTop: 12 },
  runsTitle: {
    fontFamily: Typography.heading,
    fontSize: 17,
    color: Colors.text,
    letterSpacing: 0.5,
    marginBottom: 6,
  },
  runsEmpty: { paddingVertical: 8 },
  runsEmptyText: {
    fontFamily: Typography.body,
    fontSize: 12,
    color: Colors.muted,
    lineHeight: 18,
  },
  runCard: {
    width: 280,
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.md,
    backgroundColor: Colors.surface,
    padding: 14,
    marginRight: 12,
  },
  runCarousel: { paddingRight: 8 },
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
  createRunButton: {
    width: "66%",
    minHeight: 42,
    alignSelf: "center",
    marginTop: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 7,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.sm,
    backgroundColor: Colors.surfaceHigh,
  },
  createRunButtonText: { fontFamily: Typography.heading, fontSize: 11, color: Colors.text, letterSpacing: 1.4 },

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
  bottomBtnPrimary: { backgroundColor: Colors.accent, borderColor: Colors.accent },
  bottomBtnDisabled: { opacity: 0.56 },
  bottomBtnPrimaryText: {
    fontFamily: Typography.heading,
    fontSize: 11,
    color: Colors.black,
    letterSpacing: 1.3,
  },
  saveTimesError: {
    position: "absolute",
    left: 20,
    right: 20,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: Colors.loss,
    backgroundColor: Colors.background,
  },
  saveTimesErrorText: {
    fontFamily: Typography.bodySemiBold,
    fontSize: 10,
    color: Colors.loss,
    lineHeight: 14,
    letterSpacing: 0.5,
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
  sheetContent: {
    paddingHorizontal: 20,
    paddingBottom: 40,
  },
  gamePreview: {
    padding: 16,
    borderRadius: Radius.md,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  gamePreviewTop: {
    flexDirection: "row",
    alignItems: "baseline",
    justifyContent: "space-between",
    gap: 12,
  },
  gamePreviewTitle: {
    flex: 1,
    fontFamily: Typography.heading,
    fontSize: 18,
    lineHeight: 22,
    color: Colors.text,
    letterSpacing: 0.8,
  },
  gamePreviewTime: {
    fontFamily: Typography.heading,
    fontSize: 16,
    lineHeight: 20,
    color: Colors.accent,
  },
  gamePreviewCourt: {
    marginTop: 7,
    fontFamily: Typography.bodySemiBold,
    fontSize: 12,
    lineHeight: 16,
    color: Colors.textSecondary,
  },
  gamePreviewMeta: {
    marginTop: 5,
    fontFamily: Typography.bodyMedium,
    fontSize: 11,
    lineHeight: 14,
    color: Colors.muted,
    letterSpacing: 0.6,
  },
  formatRow: { flexDirection: "row", gap: 8 },
  formatOption: {
    flex: 1,
    minHeight: 46,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: Radius.sm,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.surface,
  },
  formatOptionActive: {
    borderColor: Colors.accent,
    backgroundColor: Colors.accentDim,
  },
  formatOptionText: {
    fontFamily: Typography.heading,
    fontSize: 15,
    color: Colors.textSecondary,
    letterSpacing: 0.5,
  },
  formatOptionTextActive: { color: Colors.accent },
  timeStepper: {
    minHeight: 52,
    flexDirection: "row",
    alignItems: "stretch",
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.sm,
    overflow: "hidden",
    backgroundColor: Colors.surface,
  },
  timeStepButton: {
    width: 48,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: Colors.surfaceHigh,
  },
  timeStepValue: { flex: 1, alignItems: "center", justifyContent: "center", gap: 2 },
  timeStepText: {
    fontFamily: Typography.heading,
    fontSize: 18,
    lineHeight: 22,
    color: Colors.text,
  },
  timeStepHint: {
    fontFamily: Typography.bodyMedium,
    fontSize: 11,
    lineHeight: 13,
    color: Colors.muted,
    letterSpacing: 0.7,
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
    paddingVertical: 11,
    borderRadius: Radius.xs,
    marginTop: 10,
  },
  createBtnDisabled: { opacity: 0.5 },
  createBtnText: {
    fontFamily: Typography.heading,
    fontSize: 12,
    color: Colors.black,
    letterSpacing: 2,
  },
});
