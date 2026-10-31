import { useFocusEffect, useLocalSearchParams } from "expo-router";
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";

import { Colors, Radius } from "@/constants/colors";
import {
  Court,
  type GameRun,
  PlannedVisit,
  getSportColor,
} from "@/constants/data";
import { ScreenHeader } from "@/components/ScreenHeader";
import { FormSheet } from "@/components/sheet/FormSheet";
import { SlotCard } from "@/components/court/SlotCard";
import { ScheduleGameSheet } from "@/components/schedule/ScheduleGameSheet";
import { Pill } from "@/components/court/CourtParts";
import { SearchField } from "@/components/ui/SearchField";
import { useBottomFloor } from "@/components/ui/TabFloor";
import {
  scheduleSlotIndex,
  SCHEDULE_WINDOW_ROWS,
  SCHEDULE_WINDOW_STARTS,
  scheduleSlotLabel,
  scheduleWindowForHour,
  SLOT_HOURS,
} from "@/components/schedule/scheduleModel";
import { Typography } from "@/constants/typography";
import { useApp } from "@/context/AppContext";
import { fetchCourtPlannedTimes } from "@/services/plannedVisitService";
import { fetchCourtById, searchCourts } from "@/services/courtService";

const DAYS = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"];

const RUN_TIMES = [
  "08:00",
  "09:00",
  "10:00",
  "11:00",
  "12:00",
  "13:00",
  "14:00",
  "15:00",
  "16:00",
  "17:00",
  "18:00",
  "19:00",
  "20:00",
  "21:00",
  "22:00",
  "23:00",
];

/** Everything on the Schedule page that isn't a heat-map row (header, court, labels, legend, slot card). */
const SCHEDULE_CHROME = 330;
/** Room under the last row for the floating + button (56) and its gap. */

// Rolling next-7-days window (today first) — matches the product model of
// "who's going this week" and the [today, +7d] data fetch window. A calendar
// Sun–Sat strip showed past days whose runs the fetch window excludes, which
// made freshly created runs invisible ("NO RUNS SCHEDULED" bug, 2026-07-17).
function getWeekDays(): {
  label: string;
  dayOfWeek: string;
  isToday: boolean;
  date: number;
}[] {
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
function getNextDays(
  count: number,
): { initial: string; date: number; offset: number }[] {
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
          {selected.neighborhood || selected.city ? (
            <Text style={styles.courtFieldSub} numberOfLines={1}>
              {[selected.neighborhood, selected.city]
                .filter(Boolean)
                .join(" · ")}
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
      <SearchField
        style={styles.courtSearchBox}
        placeholder="Search courts"
        value={query}
        onChangeText={setQuery}
        onClear={() => setQuery("")}
        testID="court-search-input"
      />
      {trimmed.length >= 2 && (
        <View style={styles.courtResults}>
          {results.map((c) => (
            <Pressable
              key={c.id}
              style={({ pressed }) => [
                styles.courtResultRow,
                pressed && styles.pressed,
              ]}
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
                    c.distanceKm != null
                      ? `${c.distanceKm.toFixed(1)} KM`
                      : null,
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
  const rows: (typeof days)[] = [];
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
                <Text
                  style={[
                    styles.dayGridInitial,
                    active && styles.dayGridInitialActive,
                  ]}
                >
                  {d.initial}
                </Text>
                <Text
                  style={[
                    styles.dayGridDate,
                    active && styles.dayGridDateActive,
                  ]}
                >
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
                style={[
                  styles.gridCell,
                  active && styles.gridCellActive,
                  disabled && styles.gridCellDisabled,
                ]}
                onPress={() => onSelect(t)}
                disabled={disabled}
              >
                <Text
                  style={[
                    styles.gridCellText,
                    active && styles.gridCellTextActive,
                  ]}
                >
                  {t}
                </Text>
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

type Visibility = "public" | "friends" | "private";
const VISIBILITY_OPTIONS: { value: Visibility; label: string; hint: string }[] =
  [
    {
      value: "public",
      label: "PUBLIC",
      hint: "Anyone can see you're pulling up",
    },
    { value: "friends", label: "FRIENDS", hint: "Only friends see your name" },
    {
      value: "private",
      label: "PRIVATE",
      hint: "Just for you — still counts on the heatmap",
    },
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
  onSubmit: (
    courtId: string,
    plannedAtIso: string,
    note?: string,
    visibility?: Visibility,
  ) => Promise<boolean>;
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
    const ok = await onSubmit(
      court.id,
      plannedAt.toISOString(),
      note.trim() || undefined,
      visibility,
    );
    setSubmitting(false);
    if (!ok) {
      setFailed(true);
      return;
    }
    setNote("");
    onClose();
  };

  const activeHint = VISIBILITY_OPTIONS.find(
    (o) => o.value === visibility,
  )?.hint;

  return (
    <FormSheet visible={visible} onClose={onClose} title="I'll be there">
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.sheetContent}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={styles.fieldLabel}>COURT</Text>
        <CourtField
          selected={court}
          onSelect={setCourt}
          onClear={() => setCourt(null)}
        />

        <Text style={styles.fieldLabel}>DAY</Text>
        <DayGrid
          selected={dayOffset}
          onSelect={setDayOffset}
          days={VISIT_PICKER_DAYS}
        />

        <Text style={styles.fieldLabel}>AROUND WHAT TIME</Text>
        <TimeGrid selected={time} dayOffset={dayOffset} onSelect={setTime} />

        <Text style={styles.fieldLabel}>WHO CAN SEE THIS</Text>
        <View style={styles.gridRow}>
          {VISIBILITY_OPTIONS.map((opt) => (
            <Pressable
              key={opt.value}
              style={[
                styles.gridCell,
                visibility === opt.value && styles.gridCellActive,
              ]}
              onPress={() => setVisibility(opt.value)}
              testID={`visibility-${opt.value}`}
            >
              <Text
                style={[
                  styles.gridCellText,
                  visibility === opt.value && styles.gridCellTextActive,
                ]}
              >
                {opt.label}
              </Text>
            </Pressable>
          ))}
        </View>
        {activeHint ? (
          <Text style={styles.visibilityHint}>{activeHint}</Text>
        ) : null}

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
      <ScrollView
        contentContainerStyle={styles.sheetContent}
        keyboardShouldPersistTaps="handled"
      >
        {localCourt && (
          <Pressable
            style={styles.pickerLocalRow}
            onPress={() => {
              onSelect(localCourt);
              onClose();
            }}
          >
            <Feather name="map-pin" size={14} color={Colors.accent} />
            <Text style={styles.pickerLocalText}>
              {localCourt.name.toUpperCase()}
            </Text>
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
    addPlannedVisit,
    removePlannedVisit,
    savePlannedVisitBatch,
    joinRun,
  } = useApp();
  const params = useLocalSearchParams<{
    courtId?: string;
    openCreate?: string;
  }>();
  const { top, bottom } = useSafeAreaInsets();
  const tabFloor = useBottomFloor();
  const { width: screenWidth, height: screenHeight } = useWindowDimensions();
  // One 12-hour window fills the space the slot card and chrome leave; the
  // heat map snaps between the morning and the evening window.
  const [gridHeight, setGridHeight] = useState(0);
  const rowPitch = gridHeight
    ? Math.max(20, Math.floor(gridHeight / SCHEDULE_WINDOW_ROWS))
    : Math.max(22, Math.min(36, Math.floor((screenHeight - top - tabFloor - SCHEDULE_CHROME) / SCHEDULE_WINDOW_ROWS)));
  // Snap: when a flick settles, land on the nearer window (works on web too,
  // where snapToOffsets is ignored).
  const heatScrollRef = useRef<ScrollView>(null);
  const snapTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const settleHeat = (y: number) => {
    if (snapTimer.current) clearTimeout(snapTimer.current);
    snapTimer.current = setTimeout(() => {
      const offsets = SCHEDULE_WINDOW_STARTS.map((start) => start * rowPitch);
      const target = offsets.reduce((best, o) => (Math.abs(o - y) < Math.abs(best - y) ? o : best), offsets[0]);
      if (Math.abs(target - y) > 1) heatScrollRef.current?.scrollTo({ y: target, animated: true });
    }, 90);
  };
  const [onlyMine, setOnlyMine] = useState(false);
  const [joiningRunId, setJoiningRunId] = useState<string | null>(null);
  const joinFromCard = async (game: GameRun) => {
    if (joiningRunId) return;
    setJoiningRunId(game.id);
    await joinRun(game.id);
    setJoiningRunId(null);
  };

  const [showHost, setShowHost] = useState(false);
  const [showPicker, setShowPicker] = useState(false);
  const [pickedCourt, setPickedCourt] = useState<Court | null>(null);
  const [selectedSlot, setSelectedSlot] = useState<{
    day: number;
    slot: number;
  } | null>(null);
  const [scheduleMode, setScheduleMode] = useState<"VIEW" | "EDIT">("VIEW");
  const [pendingKeys, setPendingKeys] = useState<Set<string>>(new Set());
  const [editVisibility, setEditVisibility] = useState<Visibility>("public");
  const [savingTimes, setSavingTimes] = useState(false);
  const [addingSelectedTime, setAddingSelectedTime] = useState(false);
  // Null when there is nothing to say. Any string here is shown verbatim, so a
  // save can never look successful when nothing actually reached the database.
  const [saveNotice, setSaveNotice] = useState<string | null>(null);
  // Anonymous planned-time counts per slot (from court_planned_times RPC):
  // includes friends-only/private plans so heatmap intensity is honest without
  // exposing who they are.
  const [plannedBuckets, setPlannedBuckets] = useState<Record<string, number>>(
    {},
  );
  const consumedCourtParamRef = useRef<string | null>(null);
  const consumedCreateParamRef = useRef<string | null>(null);
  const saveNoticeTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );
  useEffect(() => {
    return () => {
      if (saveNoticeTimeoutRef.current)
        clearTimeout(saveNoticeTimeoutRef.current);
    };
  }, []);

  // Default to the local court once it hydrates; an explicit pick wins.
  const court = pickedCourt ?? localCourt;

  // Court Details deep-links here with the court already selected. Resolve it
  // from the in-memory discovery set first, then fall back to one direct read.
  useEffect(() => {
    const requestedId =
      typeof params.courtId === "string" ? params.courtId : null;
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
    const requestedId =
      typeof params.courtId === "string" ? params.courtId : null;
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
    [weekStart],
  );

  const weekLabel = useMemo(() => {
    const last = weekDays[6];
    const month = new Intl.DateTimeFormat("en-US", { month: "long" });
    if (weekStart.getMonth() === last.getMonth()) {
      return `${month.format(weekStart)} ${weekStart.getDate()} – ${last.getDate()}`;
    }
    return `${month.format(weekStart)} ${weekStart.getDate()} – ${month.format(last)} ${last.getDate()}`;
  }, [weekStart, weekDays]);

  const bucketKey = useCallback(
    (iso: string): string | null => {
      const t = new Date(iso);
      const dayIdx = Math.floor(
        (t.getTime() - weekStart.getTime()) / 86_400_000,
      );
      if (dayIdx < 0 || dayIdx > 6) return null;
      const h = t.getHours();
      if (h < SLOT_HOURS[0] || h >= SLOT_HOURS[SLOT_HOURS.length - 1] + 1)
        return null;
      return `${dayIdx}:${h - SLOT_HOURS[0]}`;
    },
    [weekStart],
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
      const entry = map.get(key) ?? {
        attendees: [],
        count: 0,
        plannedVisible: 0,
        runCount: 0,
      };
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
        true,
      );
    }
    for (const r of runs) {
      if (r.courtId !== court.id) continue;
      const runKey = bucketKey(r.startTimeIso);
      if (runKey) {
        const entry = map.get(runKey) ?? {
          attendees: [],
          count: 0,
          plannedVisible: 0,
          runCount: 0,
        };
        entry.runCount += 1;
        map.set(runKey, entry);
      }
      for (const p of r.participants) {
        add(
          r.startTimeIso,
          {
            id: p.id,
            name: p.name,
            initials: p.avatar,
            isMine: p.id === currentUser.id,
          },
          false,
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
    [plannedBuckets, slotMap],
  );
  const slotTotal = useCallback(
    (key: string) =>
      (slotMap.get(key)?.attendees.length ?? 0) + slotHidden(key),
    [slotMap, slotHidden],
  );

  const myVisitsByKey = useMemo(() => {
    const map = new Map<string, PlannedVisit[]>();
    if (!court) return map;
    for (const visit of plannedVisits) {
      if (visit.courtId !== court.id || visit.userId !== currentUser.id)
        continue;
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
      .filter(
        (r) =>
          r.courtId === court.id &&
          new Date(r.startTimeIso).getTime() >= weekStart.getTime(),
      )
      .sort((a, b) => a.startTimeIso.localeCompare(b.startTimeIso));
  }, [court, runs, weekStart]);

  const selectedKey = selectedSlot
    ? `${selectedSlot.day}:${selectedSlot.slot}`
    : null;
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
    scheduleSlotIndex(new Date().getHours()),
  );
  const currentKey = `0:${currentSlotIndex}`;

  // Returning to Schedule should always answer "what is happening now?" first.
  // A deliberate tap can still move the detail card to any other slot.
  useFocusEffect(
    useCallback(() => {
      if (scheduleMode === "VIEW") {
        setSelectedSlot({ day: 0, slot: currentSlotIndex });
      }
    }, [currentSlotIndex, scheduleMode]),
  );

  const beginEditingTimes = () => {
    if (!court || court.id !== localCourt?.id) {
      if (saveNoticeTimeoutRef.current)
        clearTimeout(saveNoticeTimeoutRef.current);
      setSaveNotice("TIMES CAN ONLY BE EDITED AT YOUR LOCAL COURT.");
      saveNoticeTimeoutRef.current = setTimeout(
        () => setSaveNotice(null),
        3200,
      );
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

  // Chips under the grid in edit mode: the actual selected times, sorted, so
  // "N SELECTED" reads as a summary instead of a bare counter up top.
  const pendingTimeLabels = useMemo(
    () =>
      Array.from(pendingKeys)
        .map((key) => {
          const [day, slot] = key.split(":").map(Number);
          const date = weekDays[day];
          if (!date || SLOT_HOURS[slot] == null) return null;
          return {
            key,
            sort: day * 100 + slot,
            label: `${DAYS[date.getDay()]} ${scheduleSlotLabel(SLOT_HOURS[slot])}`,
          };
        })
        .filter(
          (entry): entry is { key: string; sort: number; label: string } =>
            entry !== null,
        )
        .sort((a, b) => a.sort - b.sort),
    [pendingKeys, weekDays],
  );

  // VIEW mode: opt a single selected cell in without entering bulk edit.
  const handleAddSelectedTime = async () => {
    if (!court || !selectedSlot || addingSelectedTime) return;
    if (court.id !== localCourt?.id) {
      setSaveNotice("TIMES CAN ONLY BE ADDED AT YOUR LOCAL COURT.");
      return;
    }
    const date = new Date(weekDays[selectedSlot.day]);
    date.setHours(SLOT_HOURS[selectedSlot.slot], 0, 0, 0);
    const plannedAt = new Date(Math.max(date.getTime(), Date.now() + 60_000));
    setAddingSelectedTime(true);
    setSaveNotice(null);
    const ok = await addPlannedVisit(
      court.id,
      plannedAt.toISOString(),
      undefined,
      "public",
    );
    setAddingSelectedTime(false);
    if (!ok) setSaveNotice("COULD NOT ADD YOUR TIME. TRY AGAIN.");
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
    const ok = await savePlannedVisitBatch(
      court.id,
      additions,
      removals,
      editVisibility,
    );
    setSavingTimes(false);
    if (!ok) {
      setSaveNotice(
        "SOME TIMES DIDN'T SAVE. YOUR SELECTIONS ARE STILL HERE. TRY AGAIN.",
      );
      return;
    }
    setScheduleMode("VIEW");
    setPendingKeys(new Set());
  };

  const todayKey = new Date().toDateString();

  return (
    <View style={styles.container}>
      <ScreenHeader
        title="SCHEDULE"
        right={
          <Pressable
            accessibilityHint="Pick another court"
            accessibilityRole="button"
            hitSlop={8}
            onPress={() => setShowPicker(true)}
            style={({ pressed }) => [styles.courtSelector, pressed && styles.courtSelectorPressed]}
            testID="schedule-court-selector"
          >
            <View style={[styles.courtDot, court?.sport === "PICKLEBALL" ? null : styles.courtDotBasketball]} />
            <Text style={styles.courtSelectorText} numberOfLines={1}>
              {court ? court.shortName || court.name : "Pick a court"}
            </Text>
            <Feather name="chevron-down" size={15} color={Colors.muted} />
          </Pressable>
        }
      />

      {/* The page doesn't scroll when it fits (Oct 16): court, heatmap, slot
          card and the swipeable games row. On a short phone (iPhone SE) it
          scrolls instead of clipping the slot card, and the bottom padding
          lets the last row clear the + button. */}
      <View style={[styles.scheduleScroll, { paddingBottom: tabFloor + 8 }]}>
        {/* ── Heatmap: the time axis switches between fixed AM and PM states. ── */}
        <View style={styles.heatmap}>
          {/* Day header row */}
          <View style={styles.heatRow}>
            <View style={styles.heatTimeCol} />
            {weekDays.map((d, i) => {
              const isToday = d.toDateString() === todayKey;
              return (
                <View key={i} style={styles.heatDayHeader}>
                  <Text
                    style={[
                      styles.heatDayName,
                      isToday && styles.heatAxisActive,
                    ]}
                  >
                    {DAYS[d.getDay()]}
                  </Text>
                  <Text
                    style={[
                      styles.heatDayDate,
                      isToday && styles.heatAxisActive,
                    ]}
                  >
                    {d.getDate()}
                  </Text>
                </View>
              );
            })}
          </View>
          <View
            onLayout={(e) => setGridHeight(Math.floor(e.nativeEvent.layout.height))}
            style={styles.gridArea}
          >
          <ScrollView
            onScroll={(e) => settleHeat(e.nativeEvent.contentOffset.y)}
            ref={heatScrollRef}
            scrollEventThrottle={16}
            contentContainerStyle={styles.timeRows}
            contentOffset={{ x: 0, y: SCHEDULE_WINDOW_STARTS[scheduleWindowForHour(new Date().getHours())] * rowPitch }}
            decelerationRate="fast"
            key={`window-${rowPitch}`}
            nestedScrollEnabled
            showsVerticalScrollIndicator={false}
            snapToOffsets={SCHEDULE_WINDOW_STARTS.map((start) => start * rowPitch)}
            style={{ height: SCHEDULE_WINDOW_ROWS * rowPitch }}
            testID="schedule-heat-scroll"
          >
            {SLOT_HOURS.map((h, slotIdx) => (
              <View key={h} style={styles.heatRow}>
                <View style={styles.heatTimeCol}>
                  <Text
                    style={[
                      styles.heatTimeText,
                      slotIdx === currentSlotIndex && styles.heatAxisActive,
                    ]}
                  >
                    {scheduleSlotLabel(h)}
                  </Text>
                </View>
                {weekDays.map((_, dayIdx) => {
                  const key = `${dayIdx}:${slotIdx}`;
                  const count = slotTotal(key);
                  const runCount = slotMap.get(key)?.runCount ?? 0;
                  const isSelected =
                    selectedSlot?.day === dayIdx &&
                    selectedSlot?.slot === slotIdx;
                  const isCurrent = key === currentKey;
                  const isMinePending = pendingKeys.has(key);
                  const wasMine = myVisitsByKey.has(key);
                  const previewCount =
                    scheduleMode === "EDIT"
                      ? Math.max(
                          0,
                          count +
                            (isMinePending && !wasMine ? 1 : 0) -
                            (!isMinePending && wasMine ? 1 : 0),
                        )
                      : count;
                  const slotDate = new Date(weekDays[dayIdx]);
                  slotDate.setHours(SLOT_HOURS[slotIdx], 0, 0, 0);
                  slotDate.setHours(SLOT_HOURS[slotIdx] + 1, 0, 0, 0);
                  const isPast = slotDate.getTime() <= Date.now();
                  // Only mine: every slot you haven't planned reads as empty.
                  const shownCount = onlyMine && scheduleMode === "VIEW" && !wasMine ? 0 : previewCount;
                  return (
                    <Pressable
                      key={dayIdx}
                      style={[
                        styles.heatCell,
                        { height: rowPitch - 3 },
                        heatStyle(shownCount),
                        isCurrent && styles.heatCellCurrent,
                        isSelected && styles.heatCellSelected,
                        scheduleMode === "EDIT" &&
                          isMinePending &&
                          styles.heatCellMine,
                        scheduleMode === "EDIT" &&
                          isPast &&
                          !isMinePending &&
                          styles.heatCellDisabled,
                      ]}
                      onPress={() =>
                        scheduleMode === "EDIT"
                          ? togglePendingKey(key)
                          : setSelectedSlot(
                              isSelected
                                ? null
                                : { day: dayIdx, slot: slotIdx },
                            )
                      }
                      disabled={
                        scheduleMode === "EDIT" && isPast && !isMinePending
                      }
                      accessibilityRole="button"
                      accessibilityLabel={`${DAYS[weekDays[dayIdx].getDay()]} ${weekDays[dayIdx].getDate()}, ${scheduleSlotLabel(SLOT_HOURS[slotIdx])}, ${previewCount} going${runCount > 0 ? `, ${runCount} scheduled ${runCount === 1 ? "game" : "games"}` : ""}${isMinePending ? ", selected as my time" : ""}`}
                      accessibilityState={{
                        selected:
                          scheduleMode === "EDIT" ? isMinePending : isSelected,
                        disabled:
                          scheduleMode === "EDIT" && isPast && !isMinePending,
                      }}
                      testID={`heat-${dayIdx}-${slotIdx}`}
                    >
                      {scheduleMode === "EDIT" && isMinePending ? (
                        <Feather name="check" size={13} color={Colors.text} />
                      ) : (isSelected || shownCount >= 5) &&
                        shownCount > 0 ? (
                        <Text style={[styles.heatCellCount, shownCount >= 5 && styles.heatCellCountOnAccent]}>{shownCount}</Text>
                      ) : null}
                      {runCount > 0 ? (
                        <View accessible={false} style={styles.runMarker} />
                      ) : null}
                    </Pressable>
                  );
                })}
              </View>
            ))}
          </ScrollView>
          </View>
          {/* Actions: the court feed's pills (no floating button). */}
          {court?.id === localCourt?.id ? (
            <View style={styles.pillRow}>
              <Pill
                label="Select"
                onPress={() => (scheduleMode === "EDIT" ? cancelEditingTimes() : beginEditingTimes())}
                selected={scheduleMode === "EDIT"}
              />
              <Pill
                disabled={scheduleMode === "EDIT"}
                label="Only mine"
                onPress={() => setOnlyMine((value) => !value)}
                selected={onlyMine}
              />
              <Pill
                disabled={myVisitsByKey.size === 0}
                label={`Clear mine · ${myVisitsByKey.size}`}
                onPress={() => {
                  // Opens Select with nothing picked; Save removes them.
                  beginEditingTimes();
                  setPendingKeys(new Set());
                }}
              />
            </View>
          ) : null}
        </View>

        {scheduleMode === "EDIT" ? (
          <ScrollView
            contentContainerStyle={styles.editArea}
            showsVerticalScrollIndicator={false}
            style={styles.flexArea}
          >
          <View style={styles.selectedSummary}>
            <Text style={styles.selectedSummaryLabel}>
              {pendingKeys.size} {pendingKeys.size === 1 ? "TIME" : "TIMES"}{" "}
              SELECTED
            </Text>
            {pendingTimeLabels.length > 0 ? (
              <View style={styles.selectedChips}>
                {pendingTimeLabels.map((entry) => (
                  <Pressable
                    accessibilityHint="Removes this time"
                    accessibilityLabel={entry.label}
                    accessibilityRole="button"
                    key={entry.key}
                    onPress={() => togglePendingKey(entry.key)}
                    style={styles.selectedChip}
                  >
                    <Text style={styles.selectedChipText}>{entry.label}</Text>
                    <Feather name="x" size={9} color={Colors.textSecondary} />
                  </Pressable>
                ))}
              </View>
            ) : (
              <Text style={styles.selectedSummaryHint}>
                Tap cells in the grid above to add your times.
              </Text>
            )}
          </View>

          <View style={styles.editOptions}>
            <Text style={styles.editOptionsLabel}>NEW TIMES VISIBLE TO</Text>
            <View style={styles.editVisibilityRow}>
              {VISIBILITY_OPTIONS.map((option) => (
                <Pressable
                  key={option.value}
                  onPress={() => setEditVisibility(option.value)}
                  style={[
                    styles.editVisibilityButton,
                    editVisibility === option.value && styles.editVisibilityButtonActive,
                  ]}
                  accessibilityRole="button"
                  accessibilityState={{ selected: editVisibility === option.value }}
                >
                  <Text
                    style={[
                      styles.editVisibilityText,
                      editVisibility === option.value && styles.editVisibilityTextActive,
                    ]}
                  >
                    {option.label}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>
          </ScrollView>
        ) : null}

        {/* ── Selected slot: one fixed height, empty or full, so the page
            never jumps when you tap around the grid ── */}
        {scheduleMode === "VIEW" && selectedSlot && selectedDate && selectedKey
          ? (() => {
              const hidden = slotHidden(selectedKey);
              const visible = selectedEntry?.attendees ?? [];
              const mine = selectedEntry?.attendees.find((a) => a.isMine && a.visitId);
              const slotEnd = new Date(selectedDate);
              slotEnd.setHours(SLOT_HOURS[selectedSlot.slot] + 1, 0, 0, 0);
              const canAdd = !mine?.visitId && court?.id === localCourt?.id && slotEnd.getTime() > Date.now();
              const slotRuns = courtRuns.filter((run) => bucketKey(run.startTimeIso) === selectedKey);
              const slotHour = SLOT_HOURS[selectedSlot.slot];
              const now = new Date();
              const isNow = selectedSlot.day === 0 && now.getHours() === slotHour;
              return (
                <View style={styles.slotWrap}>
                  <SlotCard
                    attendees={visible}
                    current={isNow}
                    hidden={hidden}
                    mine={Boolean(mine?.visitId)}
                    mode={mine?.visitId || canAdd ? "full" : "view"}
                    onCreate={() => setShowHost(true)}
                    onToggle={() =>
                      mine?.visitId ? void removePlannedVisit(mine.visitId) : void handleAddSelectedTime()
                    }
                    runs={slotRuns}
                    saving={addingSelectedTime}
                    title={`${DAYS[selectedDate.getDay()]} ${selectedDate.getDate()} · ${scheduleSlotLabel(slotHour)}`}
                  />
                </View>
              );
            })()
          : null}

      </View>


      {/* ── Bottom actions ── */}
      {scheduleMode === "EDIT" ? (
        <View
          style={[
            styles.bottomBar,
            { paddingBottom: Platform.OS === "web" ? 84 : bottom + 84 },
          ]}
        >
          <>
            <Pressable
              style={styles.bottomBtn}
              onPress={cancelEditingTimes}
              testID="cancel-edit-times-btn"
            >
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

      <ScheduleGameSheet
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
  pillRow: { flexDirection: "row", flexWrap: "wrap", gap: 6, paddingTop: 12 },
  scheduleScroll: { flex: 1, minHeight: 0 },
  scheduleBody: { flexGrow: 1 },
  flexArea: { flexGrow: 1, minHeight: 140, marginTop: 8 },
  editArea: { paddingBottom: 140 },
  scheduleBodyContent: { flexGrow: 1, paddingBottom: 88 },
  scheduleBodyContentEdit: { paddingBottom: 8 },
  pressed: { backgroundColor: Colors.surfaceHigh },

  headerDate: {
    fontFamily: Typography.bodyMedium,
    fontSize: 12,
    lineHeight: 16,
    color: Colors.text,
    letterSpacing: 0.1,
  },

  // ── Court selector ──
  courtSelector: { maxWidth: 190, minHeight: 44, flexDirection: "row", alignItems: "center", gap: 8 },
  courtSelectorPressed: { opacity: 0.75 },
  courtSelectorText: {
    flexShrink: 1,
    minWidth: 0,
    fontFamily: Typography.bodyBold,
    fontSize: 12,
    letterSpacing: 1.6,
    textTransform: "uppercase",
    color: Colors.text,
  },
  scheduleModeRow: {
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 8,
    flexDirection: "row",
    alignItems: "baseline",
    justifyContent: "space-between",
  },
  scheduleModeMeta: { fontFamily: Typography.bodySemiBold, fontSize: 10, color: Colors.muted },
  modeToggle: {
    flexDirection: "row",
    minHeight: 34,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.sm,
    overflow: "hidden",
    backgroundColor: Colors.surface,
  },
  modeToggleButton: {
    minWidth: 50,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 8,
  },
  modeToggleButtonActive: { backgroundColor: Colors.surfaceHigh },
  modeToggleText: {
    fontFamily: Typography.bodyBold,
    fontSize: 8,
    color: Colors.muted,
    letterSpacing: 1.1,
  },
  modeToggleTextActive: { color: Colors.accent },
  scheduleModeStatus: {
    fontFamily: Typography.bodyBold,
    fontSize: 10,
    letterSpacing: 1.4,
    textTransform: "uppercase",
    color: Colors.text,
  },
  editOptions: {
    marginHorizontal: 20,
    marginBottom: 8,
    padding: 10,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.sm,
    backgroundColor: Colors.surface,
    gap: 8,
  },
  selectedSummary: {
    marginHorizontal: 20,
    marginTop: "auto",
    marginBottom: 8,
    paddingTop: 12,
    gap: 8,
  },
  selectedSummaryLabel: {
    fontFamily: Typography.heading,
    fontSize: 13,
    color: Colors.text,
    letterSpacing: 1,
  },
  selectedSummaryHint: {
    fontFamily: Typography.body,
    fontSize: 12,
    lineHeight: 16,
    color: Colors.muted,
  },
  selectedChips: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  selectedChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingVertical: 5,
    paddingHorizontal: 9,
    borderWidth: 1,
    borderColor: Colors.accentBorder,
    borderRadius: Radius.xs,
    backgroundColor: Colors.accentDim,
  },
  selectedChipText: {
    fontFamily: Typography.bodySemiBold,
    fontSize: 10,
    color: Colors.text,
    letterSpacing: 0.6,
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
  editVisibilityButtonActive: {
    backgroundColor: Colors.surfaceHigh,
    borderColor: Colors.textSecondary,
  },
  editVisibilityText: {
    fontFamily: Typography.bodyBold,
    fontSize: 8,
    color: Colors.muted,
    letterSpacing: 1,
  },
  editVisibilityTextActive: { color: Colors.text },
  teamModeRow: { flexDirection: "row", gap: 8 },
  teamModeOption: {
    flex: 1,
    minHeight: 46,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 7,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.sm,
    backgroundColor: Colors.surface,
  },
  teamModeOptionActive: { borderColor: Colors.accent, backgroundColor: Colors.accentDim },
  teamModeOptionText: {
    fontFamily: Typography.bodyBold,
    fontSize: 9,
    color: Colors.muted,
    letterSpacing: 0.8,
  },
  teamModeOptionTextActive: { color: Colors.text },
  teamModeHelp: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
    marginTop: 8,
    padding: 10,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.sm,
    backgroundColor: Colors.surface,
  },
  teamModeHelpText: {
    flex: 1,
    fontFamily: Typography.body,
    fontSize: 11,
    lineHeight: 16,
    color: Colors.textSecondary,
  },
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
  heatmap: { flex: 1, minHeight: 0, paddingHorizontal: 20, paddingTop: 10 },
  gridArea: { flex: 1, minHeight: 0 },
  courtDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: Colors.pickleballMeta },
  courtDotBasketball: { backgroundColor: Colors.basketballMeta },
  timeRows: { paddingBottom: 2 },
  timeCueRowAbove: {
    height: 16,
    marginTop: 0,
    marginBottom: 4,
    zIndex: 2,
  },
  timeWindowCue: {
    width: 44,
    height: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  timeWindowCuePressed: { opacity: 0.55 },
  heatRow: {
    flexDirection: "row",
    gap: 3,
    marginBottom: 3,
    alignItems: "center",
  },
  heatTimeCol: {
    width: 44,
    alignItems: "flex-end",
    justifyContent: "center",
    paddingRight: 6,
  },
  heatTimeText: {
    fontFamily: Typography.bodyMedium,
    fontSize: 11,
    lineHeight: 14,
    color: Colors.muted,
    letterSpacing: 0,
    fontVariant: ["tabular-nums"],
    textAlign: "right",
  },
  heatDayHeader: { flex: 1, alignItems: "center" },
  heatDayName: {
    fontFamily: Typography.bodySemiBold,
    fontSize: 9,
    lineHeight: 12,
    color: Colors.muted,
    letterSpacing: 0.5,
  },
  heatDayNameToday: { color: Colors.accent },
  heatDayDate: {
    fontFamily: Typography.heading,
    fontSize: 14,
    lineHeight: 17,
    color: Colors.textSecondary,
  },
  heatDayDateToday: { color: Colors.text },
  heatAxisActive: { color: Colors.liveInk },
  // Court-flow heatmap: soft 6pt cells, the shared orange ramp, a white
  // ring for the chosen slot and an orange edge for the hour you're in.
  heatCell: {
    position: "relative",
    flex: 1,
    height: 25,
    borderRadius: 6,
    backgroundColor: Colors.surfaceHigh,
    borderWidth: 1.5,
    borderColor: "transparent",
    alignItems: "center",
    justifyContent: "center",
  },
  heatLow: { backgroundColor: Colors.heat1 },
  heatMid: { backgroundColor: Colors.heat2 },
  heatHigh: { backgroundColor: Colors.accent },
  heatCellSelected: { borderColor: Colors.text },
  heatCellCurrent: { borderColor: Colors.accentBorderStrong },
  heatCellMine: { borderColor: Colors.text, borderWidth: 2 },
  heatCellDisabled: { opacity: 0.34 },
  // Dark on the orange cell, like the Check in button (white was 3:1).
  heatCellCountOnAccent: { color: Colors.background },
  heatCellCount: {
    fontFamily: Typography.heading,
    fontSize: 12,
    color: Colors.text,
  },
  runMarker: {
    position: "absolute",
    right: 4,
    top: 4,
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: Colors.accent,
  },
  legendRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 8,
  },
  legendScale: { flexDirection: "row", alignItems: "center", gap: 5 },
  legendGame: { flexDirection: "row", alignItems: "center", gap: 4 },
  legendGameDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: Colors.accent,
  },
  legendSwatch: {
    width: 10,
    height: 8,
    borderRadius: 2,
  },
  legendText: {
    fontFamily: Typography.bodySemiBold,
    fontSize: 9.5,
    lineHeight: 13,
    color: Colors.muted,
  },

  // ── Slot detail card (fixed height) ──
  slotWrap: { marginHorizontal: 20, marginTop: 10 },
  slotCard: {
    marginHorizontal: 20,
    marginTop: 10,
    paddingHorizontal: 14,
    paddingTop: 11,
    paddingBottom: 12,
    borderWidth: 1,
    borderColor: Colors.hairlineCard,
    borderRadius: Radius.panel,
    backgroundColor: Colors.panel,
  },
  slotHead: { flexDirection: "row", alignItems: "baseline", justifyContent: "space-between", gap: 10 },
  slotCardTitle: { flexShrink: 1, fontFamily: Typography.headingSemiBold, fontSize: 15, letterSpacing: 0.2, textTransform: "uppercase", color: Colors.text },
  slotCardGoing: { flexShrink: 0, fontFamily: Typography.bodyBold, fontSize: 9.5, letterSpacing: 1.2, textTransform: "uppercase", color: Colors.textSecondary },
  slotCardGoingLive: { color: Colors.liveInk },
  // Names and the action share one row: one fixed height, empty or full.
  slotBody: { height: 40, marginTop: 10, flexDirection: "row", alignItems: "center", gap: 8 },
  slotPlus: { width: 36, height: 36, borderRadius: Radius.sm, borderWidth: 1, borderColor: Colors.hairlineChrome, alignItems: "center", justifyContent: "center" },
  slotPlusOn: { backgroundColor: Colors.accent, borderColor: Colors.accent },
  slotGame: { height: 48, marginTop: 10, flexDirection: "row", alignItems: "center", gap: 12, borderTopWidth: 1, borderTopColor: Colors.hairline, paddingTop: 10 },
  slotJoin: { minWidth: 72, height: 38, paddingHorizontal: 14, borderRadius: Radius.button, borderWidth: 1, borderColor: Colors.text, alignItems: "center", justifyContent: "center" },
  slotJoinText: { fontFamily: Typography.bodyBold, fontSize: 11, letterSpacing: 1.3, textTransform: "uppercase", color: Colors.text },
  slotGameCopy: { flex: 1, minWidth: 0 },
  slotGameTitle: { fontFamily: Typography.headingSemiBold, fontSize: 16, textTransform: "uppercase", color: Colors.text },
  slotGameSub: { fontFamily: Typography.bodyMedium, fontSize: 11, color: Colors.textSecondary },
  slotNoGame: { height: 48, marginTop: 10, paddingTop: 14, borderTopWidth: 1, borderTopColor: Colors.hairline, fontFamily: Typography.bodyMedium, fontSize: 12, color: Colors.textSecondary },
  slotPeopleScroll: { flex: 1, minWidth: 0 },
  slotPeople: { alignItems: "center", gap: 8 },
  slotMore: {
    width: 30,
    height: 30,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: Radius.sm,
    borderWidth: 1,
    borderStyle: "dashed",
    borderColor: Colors.border,
  },
  slotMoreText: { fontFamily: Typography.headingSemiBold, fontSize: 11, color: Colors.textSecondary },
  gamesRow: { flexGrow: 1, minHeight: 168, paddingTop: 14 },
  gamesLabel: { paddingHorizontal: 20, marginBottom: 8, fontFamily: Typography.bodyBold, fontSize: 9, letterSpacing: 1.3, textTransform: "uppercase", color: Colors.textSecondary },
  gamesTrack: { paddingHorizontal: 20, gap: 10, alignItems: "flex-start" },
  gamesEmpty: { minHeight: 64, marginHorizontal: 20, paddingHorizontal: 14, justifyContent: "center", borderRadius: Radius.row, borderWidth: 1, borderStyle: "dashed", borderColor: Colors.dashed },
  gamesEmptyText: { fontFamily: Typography.bodyMedium, fontSize: 12, color: Colors.textSecondary },

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
  createRunButtonText: {
    fontFamily: Typography.heading,
    fontSize: 11,
    color: Colors.text,
    letterSpacing: 1.4,
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
  bottomBtnPrimary: {
    backgroundColor: Colors.accent,
    borderColor: Colors.accent,
  },
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
  timeStepValue: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 2,
  },
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
