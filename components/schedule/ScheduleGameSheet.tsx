import React, { useEffect, useMemo, useState } from "react";
import { StyleSheet, Text, View } from "react-native";

import { BrutalistButton } from "@/components/BrutalistButton";
import {
  generatedScheduledGameTitle,
  maxPlayersForFormat,
  type ScheduledGameFormat,
  scheduledFormatsForSport,
} from "@/components/schedule/scheduledGameModel";
import { RunFlowSheet } from "@/components/sheet/RunFlowSheet";
import { CourtSearchPicker } from "@/components/ui/CourtSearchPicker";
import { RecentDatePicker } from "@/components/ui/RecentDatePicker";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { TimeStrip } from "@/components/ui/TimeStrip";
import { Colors } from "@/constants/colors";
import type { Court, TeamAssignmentMode } from "@/constants/data";
import { Space } from "@/constants/layout";
import { TextStyles } from "@/constants/typography";
import {
  CHALLENGE_DAYS,
  defaultSlot,
  isPastSlot,
  toPlayAt,
  wheelTimes,
} from "@/lib/challengeModel";
import { createScheduledGame } from "@/services/scheduledGameService";

const TEAM_MODES = [
  { value: "elo_balance", label: "ELO balance" },
  { value: "choose_teams", label: "Choose teams" },
] as const;

/**
 * Schedule a game. The same drawer as Challenge and Log game: WHERE (court
 * search), WHEN (a day strip and a time strip), then the teams: the format and
 * how sides are picked.
 */
export function ScheduleGameSheet({
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
  const times = useMemo(() => wheelTimes(), []);
  const [now, setNow] = useState(() => new Date());
  const [court, setCourt] = useState<Court | null>(defaultCourt);
  const [focused, setFocused] = useState(false);
  const [day, setDay] = useState(() => defaultSlot().day);
  const [minutes, setMinutes] = useState(() => defaultSlot().minutes);
  const [format, setFormat] = useState<ScheduledGameFormat>("5V5");
  const [teamMode, setTeamMode] = useState<TeamAssignmentMode>("elo_balance");
  const [submitting, setSubmitting] = useState(false);
  const [failed, setFailed] = useState(false);

  const formats = scheduledFormatsForSport(court?.sport ?? "BASKETBALL");

  // Start fresh each time the sheet opens: the court you're looking at, the
  // next free slot.
  useEffect(() => {
    if (!visible) return;
    const fresh = new Date();
    const slot = defaultSlot(fresh);
    setNow(fresh);
    setCourt(defaultCourt);
    setDay(slot.day);
    setMinutes(slot.minutes);
    setTeamMode("elo_balance");
    setFailed(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  useEffect(() => {
    if (!formats.includes(format)) setFormat(formats[0]);
  }, [format, formats]);

  // Picking today after the clock passed a time moves the strip to the next one.
  useEffect(() => {
    if (!isPastSlot(day, minutes, now)) return;
    const next = times.find((time) => !isPastSlot(day, time.minutes, now));
    if (next) setMinutes(next.minutes);
  }, [day, minutes, now, times]);

  const startTime = new Date(toPlayAt(day, minutes));
  const canSubmit = !!court && startTime.getTime() > Date.now() && !submitting;

  const create = async () => {
    if (!canSubmit || !court) return;
    setSubmitting(true);
    setFailed(false);
    const created = await createScheduledGame({
      courtId: court.id,
      organizerId,
      title: generatedScheduledGameTitle(organizerName, format),
      startTime: startTime.toISOString(),
      maxPlayers: maxPlayersForFormat(format),
      teamAssignmentMode: teamMode,
    });
    setSubmitting(false);
    if (!created) {
      setFailed(true);
      return;
    }
    await onCreated();
    onClose();
  };

  return (
    <RunFlowSheet
      dynamic
      icon="calendar"
      onClose={onClose}
      subtitle="Locals see it and can join"
      title="SCHEDULE A GAME"
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
            daysBack={CHALLENGE_DAYS}
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

          <Text style={styles.label}>TEAMS</Text>
          <SegmentedControl
            accessibilityLabel="Game format"
            items={formats.map((option) => ({ value: option, label: option }))}
            onChange={setFormat}
            value={format}
          />
          <View style={styles.segment}>
            <SegmentedControl
              accessibilityLabel="How sides are picked"
              items={TEAM_MODES}
              onChange={setTeamMode}
              value={teamMode}
            />
          </View>
        </>
      ) : null}

      {failed ? <Text style={styles.error}>Couldn't schedule the game. Try again.</Text> : null}
      <BrutalistButton
        disabled={!canSubmit}
        label={submitting ? "SCHEDULING…" : "SCHEDULE GAME"}
        onPress={() => void create()}
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
  segment: { marginTop: Space.md },
  error: { ...TextStyles.metadata, marginTop: Space.lg, color: Colors.textSecondary },
  send: { marginTop: Space.xl, minHeight: 52 },
});
