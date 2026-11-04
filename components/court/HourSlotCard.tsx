import React from "react";
import { ActivityIndicator, Text, View } from "react-native";

import { SlotCard } from "@/components/court/SlotCard";
import { Colors } from "@/constants/colors";
import type { Court, GameRun } from "@/constants/data";
import { Typography } from "@/constants/typography";
import { useApp } from "@/context/AppContext";
import type { CourtActivityData } from "@/hooks/useCourtActivity";
import { courtHourSlot } from "@/lib/courtActivityModel";

interface HourProps {
  court: Court;
  dayOffset: number;
  hour: number;
  data: CourtActivityData;
  compact?: boolean;
  embedded?: boolean;
  onPlayerPress?: (playerId: string) => void;
  onRunPress?: (runId: string) => void;
  onCreateGame?: () => void;
}
export const HourSlotCard = React.memo(HourContent);
function HourContent({
  court,
  dayOffset,
  hour,
  data,
  compact,
  embedded,
  onPlayerPress,
  onRunPress,
  onCreateGame,
}: HourProps) {
  const { currentUser, runs, addPlannedVisit, removePlannedVisit, joinRun } =
    useApp();
  const [saving, setSaving] = React.useState(false);
  const [notice, setNotice] = React.useState<string | null>(null);
  const lock = React.useRef(false);
  const joinLock = React.useRef(false);
  const [joiningRunId, setJoiningRunId] = React.useState<string | null>(null);
  React.useEffect(() => {
    setNotice(null);
  }, [court.id, dayOffset, hour]);
  const now = data.now;
  const slot = courtHourSlot({
    courtId: court.id,
    pick: { dayOffset, hour },
    now,
    visits: data.visits,
    anonymousTimes: data.planned,
    games: runs,
    meId: currentUser.id,
  });
  const over = slot.end <= now;
  const join = async (game: GameRun) => {
    if (joinLock.current || data.loading || data.error) return;
    joinLock.current = true;
    setJoiningRunId(game.id);
    setNotice(null);
    try {
      if (!(await joinRun(game.id)))
        setNotice("Something went wrong. Try again.");
    } catch {
      setNotice("Something went wrong. Try again.");
    } finally {
      joinLock.current = false;
      setJoiningRunId(null);
    }
  };
  const toggle = async () => {
    if (lock.current || over || data.loading || data.error) return;
    lock.current = true;
    setSaving(true);
    setNotice(null);
    try {
      const results = slot.mine.length
        ? await Promise.all(slot.mine.map((v) => removePlannedVisit(v.id)))
        : [
            await addPlannedVisit(
              court.id,
              new Date(Math.max(slot.from, Date.now() + 60_000)).toISOString(),
              undefined,
              "public",
            ),
          ];
      if (!results.every(Boolean))
        setNotice("Could not save your time. Try again.");
    } catch {
      setNotice("Could not save your time. Try again.");
    } finally {
      lock.current = false;
      setSaving(false);
    }
  };
  if (data.loading && !data.ready)
    return (
      <View style={{ minHeight: 66, justifyContent: "center" }}>
        <ActivityIndicator color={Colors.textSecondary} />
      </View>
    );
  if (data.error && !data.ready)
    return (
      <Text
        style={{
          fontFamily: Typography.bodyMedium,
          fontSize: 12,
          color: Colors.textSecondary,
        }}
      >
        Couldn't load activity. Try again.
      </Text>
    );
  return (
    <SlotCard
      attendees={slot.attendees}
      hidden={slot.hidden}
      mine={Boolean(slot.mine.length)}
      mode={over || data.error ? "view" : "plan"}
      notice={notice}
      onToggle={data.loading ? undefined : () => void toggle()}
      runs={slot.games}
      saving={saving}
      compact={compact}
      embedded={embedded}
      onPlayerPress={onPlayerPress}
      onRunPress={onRunPress}
      onCreate={onCreateGame}
      onJoinRun={data.loading ? undefined : (game) => void join(game)}
      joiningRunId={joiningRunId}
      title={`${hour % 12 || 12} ${hour < 12 ? "AM" : "PM"}`}
    />
  );
}
