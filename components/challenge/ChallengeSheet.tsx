import React, { useEffect, useMemo, useState } from "react";
import { StyleSheet, Text, View } from "react-native";

import { BrutalistButton } from "@/components/BrutalistButton";
import { RunFlowSheet } from "@/components/sheet/RunFlowSheet";
import { CourtSearchPicker } from "@/components/ui/CourtSearchPicker";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { RecentDatePicker } from "@/components/ui/RecentDatePicker";
import { TimeStrip } from "@/components/ui/TimeStrip";
import { Colors } from "@/constants/colors";
import type { Court } from "@/constants/data";
import { Space } from "@/constants/layout";
import { TextStyles } from "@/constants/typography";
import {
  defaultSlot,
  firstName,
  isPastSlot,
  toPlayAt,
  wheelDays,
  wheelTimes,
} from "@/lib/challengeModel";
import { createChallenge } from "@/services/challengeService";

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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [defaultId]);

  // Picking today after the clock passed a time moves the wheel to the next one.
  useEffect(() => {
    if (!isPastSlot(day, minutes, now)) return;
    const next = times.find((time) => !isPastSlot(day, time.minutes, now));
    if (next) setMinutes(next.minutes);
  }, [day, minutes, now, times]);

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
      <CourtSearchPicker court={court} onFocusChange={setFocused} onPick={setCourt} />

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
  segment: { marginTop: Space.xl },
  error: { ...TextStyles.metadata, marginTop: Space.lg, color: Colors.textSecondary },
  send: { marginTop: Space.xl, minHeight: 52 },
});
