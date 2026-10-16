import { Feather } from "@expo/vector-icons";
import React, { useEffect, useMemo, useRef, useState } from "react";
import { Keyboard, Pressable, StyleSheet, Text, View } from "react-native";

import { BrutalistButton } from "@/components/BrutalistButton";
import { RunFlowSheet } from "@/components/sheet/RunFlowSheet";
import { SearchField } from "@/components/ui/SearchField";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { RecentDatePicker } from "@/components/ui/RecentDatePicker";
import { TimeStrip } from "@/components/ui/TimeStrip";
import { Colors } from "@/constants/colors";
import type { Court } from "@/constants/data";
import { Space } from "@/constants/layout";
import { TextStyles } from "@/constants/typography";
import { useDeviceLocation } from "@/context/DeviceLocationContext";
import {
  defaultSlot,
  firstName,
  isPastSlot,
  toPlayAt,
  wheelDays,
  wheelTimes,
} from "@/lib/challengeModel";
import { createChallenge } from "@/services/challengeService";
import { fetchClosestCourts, searchCourts } from "@/services/courtService";

const courtLabel = (court: Court | null) => (court ? court.shortName || court.name : "");

/**
 * Send a challenge from another player's profile. Three things: WHERE (their
 * local court to start, search to change it), WHEN (a day and time on a wheel,
 * today plus four days) and Ranked or Casual. Friends only: the profile screen
 * checks that before opening this.
 */
export function ChallengeSheet({
  visible,
  onClose,
  opponent,
  defaultCourt,
  onSent,
}: {
  visible: boolean;
  onClose: () => void;
  opponent: { id: string; name: string };
  /** Where to start: the other player's local court, else yours. */
  defaultCourt: Court | null;
  onSent: (challengeId: string) => void;
}) {
  const now = useMemo(() => new Date(), []);
  const days = useMemo(() => wheelDays(now), [now]);
  const times = useMemo(() => wheelTimes(), []);
  const start = useMemo(() => defaultSlot(now), [now]);

  const [court, setCourt] = useState<Court | null>(defaultCourt);
  const [text, setText] = useState(courtLabel(defaultCourt));
  const [focused, setFocused] = useState(false);
  const [day, setDay] = useState(start.day);
  const [minutes, setMinutes] = useState(start.minutes);
  const [mode, setMode] = useState<"ranked" | "casual">("ranked");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // The profile's court can arrive after the sheet is already open.
  const defaultId = defaultCourt?.id;
  useEffect(() => {
    if (!defaultCourt || court) return;
    setCourt(defaultCourt);
    setText(courtLabel(defaultCourt));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [defaultId]);

  // Picking today after the clock passed a time moves the wheel to the next one.
  useEffect(() => {
    if (!isPastSlot(day, minutes, now)) return;
    const next = times.find((time) => !isPastSlot(day, time.minutes, now));
    if (next) setMinutes(next.minutes);
  }, [day, minutes, now, times]);

  // ── WHERE: nearest three, then a standard typeahead ──
  const { coord } = useDeviceLocation();
  const sport = court?.sport ?? null;
  const [nearest, setNearest] = useState<Court[]>([]);
  useEffect(() => {
    if (!coord) return;
    let active = true;
    void fetchClosestCourts(coord.lat, coord.lng, sport, 3).then((rows) => {
      if (active) setNearest(rows);
    });
    return () => {
      active = false;
    };
  }, [coord, sport]);

  const term = text.trim();
  const typing = focused && term.length >= 2 && term !== courtLabel(court);
  const [results, setResults] = useState<Court[]>([]);
  const [searching, setSearching] = useState(false);
  useEffect(() => {
    if (!typing) {
      setResults([]);
      setSearching(false);
      return;
    }
    let active = true;
    setSearching(true);
    const timer = setTimeout(() => {
      void searchCourts(term, sport, 8).then((rows) => {
        if (!active) return;
        setResults(rows);
        setSearching(false);
      });
    }, 220);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [typing, term, sport]);

  const suggestions = useMemo(() => {
    if (typing) return results;
    const seen = new Set<string>();
    return [court, ...nearest].filter((row): row is Court => {
      if (!row || seen.has(row.id)) return false;
      seen.add(row.id);
      return true;
    });
  }, [typing, results, court, nearest]);

  const courtRef = useRef(court);
  courtRef.current = court;
  const pick = (next: Court) => {
    setCourt(next);
    setText(courtLabel(next));
    setFocused(false);
    Keyboard.dismiss();
  };
  // Leaving the box without picking puts the chosen court back. The short wait
  // lets a tap on a suggestion land first.
  const blurTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onBlur = () => {
    blurTimer.current = setTimeout(() => {
      setFocused(false);
      setText(courtLabel(courtRef.current));
    }, 160);
  };
  useEffect(
    () => () => {
      if (blurTimer.current) clearTimeout(blurTimer.current);
    },
    [],
  );

  const send = async () => {
    if (sending) return;
    if (!court) {
      setError("Pick a court.");
      return;
    }
    setSending(true);
    setError(null);
    const result = await createChallenge({
      opponentId: opponent.id,
      courtId: court.id,
      playOn: day,
      playAt: toPlayAt(day, minutes),
      ranked: mode === "ranked",
    });
    setSending(false);
    if (!result.ok) {
      setError(result.message);
      return;
    }
    onSent(result.value);
  };

  return (
    <RunFlowSheet
      dynamic
      icon="zap"
      onClose={onClose}
      subtitle="They'll get a notification to confirm"
      title={`CHALLENGE ${firstName(opponent.name).toUpperCase()}`}
      visible={visible}
    >
      <Text style={styles.label}>WHERE</Text>
      <SearchField
        accessibilityLabel="Court"
        loading={searching}
        onBlur={onBlur}
        onChangeText={setText}
        onClear={() => setText("")}
        onFocus={() => {
          if (blurTimer.current) clearTimeout(blurTimer.current);
          setFocused(true);
        }}
        placeholder="Search courts"
        selectTextOnFocus
        value={text}
      />
      {focused ? (
        <View style={styles.list}>
          {!typing && suggestions.length > 0 ? <Text style={styles.listLabel}>NEAREST</Text> : null}
          {suggestions.map((row) => (
            <Pressable
              accessibilityLabel={`Pick ${row.name}`}
              accessibilityRole="button"
              key={row.id}
              onPress={() => pick(row)}
              style={({ pressed }) => [styles.row, pressed && styles.pressed]}
            >
              <View style={styles.rowCopy}>
                <Text numberOfLines={1} style={styles.rowName}>
                  {courtLabel(row)}
                </Text>
                <Text numberOfLines={1} style={styles.rowMeta}>
                  {[
                    row.city,
                    row.distanceKm != null ? `${(row.distanceKm * 0.621371).toFixed(1)} MI` : null,
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                </Text>
              </View>
              {row.id === court?.id ? <Feather color={Colors.accent} name="check" size={16} /> : null}
            </Pressable>
          ))}
          {typing && !searching && suggestions.length === 0 ? (
            <Text style={styles.empty}>NO COURTS FOUND</Text>
          ) : null}
        </View>
      ) : null}

      {!focused ? (
        <>
          <Text style={styles.label}>WHEN</Text>
          <RecentDatePicker
            accessibilityLabel="Day"
            ahead
            daysBack={days.length}
            onChange={setDay}
            sport={court?.sport ?? null}
            value={day}
          />
          <View style={styles.timeRow}>
            <TimeStrip
              items={times.map((time) => ({
                value: String(time.minutes),
                label: time.label,
                disabled: isPastSlot(day, time.minutes, now),
              }))}
              onChange={(value) => setMinutes(Number(value))}
              value={String(minutes)}
            />
          </View>

          <View style={styles.segment}>
            <SegmentedControl
              accessibilityLabel="Ranked or casual"
              items={[
                { value: "ranked", label: "Ranked" },
                { value: "casual", label: "Casual" },
              ]}
              onChange={setMode}
              value={mode}
            />
          </View>
        </>
      ) : null}

      {error ? <Text style={styles.error}>{error}</Text> : null}
      <BrutalistButton
        label={sending ? "SENDING…" : "SEND CHALLENGE"}
        onPress={() => void send()}
        style={styles.send}
        variant="accent"
      />
    </RunFlowSheet>
  );
}

const styles = StyleSheet.create({
  timeRow: { marginTop: Space.md },
  label: {
    marginTop: Space.xl,
    marginBottom: Space.sm,
    ...TextStyles.labelSmall,
    letterSpacing: 1.4,
    color: Colors.muted,
  },
  list: { marginTop: Space.sm },
  listLabel: { ...TextStyles.labelSmall, marginVertical: Space.sm, letterSpacing: 1.2, color: Colors.muted },
  row: {
    minHeight: 52,
    flexDirection: "row",
    alignItems: "center",
    gap: Space.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.border,
  },
  rowCopy: { flex: 1, minWidth: 0, gap: 2 },
  rowName: { ...TextStyles.listName, color: Colors.text },
  rowMeta: { ...TextStyles.caption, color: Colors.muted },
  pressed: { opacity: 0.7 },
  empty: { ...TextStyles.labelSmall, paddingVertical: Space.lg, color: Colors.muted },
  segment: { marginTop: Space.xl },
  error: { ...TextStyles.metadata, marginTop: Space.lg, color: Colors.textSecondary },
  send: { marginTop: Space.xl, minHeight: 52 },
});
