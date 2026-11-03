import React from "react";
import { ActivityIndicator, Text, View } from "react-native";

import { SlotCard } from "@/components/court/SlotCard";
import { Colors } from "@/constants/colors";
import type { Court } from "@/constants/data";
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
}
export const HourSlotCard = React.memo(HourContent);
function HourContent({
  court,
  dayOffset,
  hour,
  data,
  compact,
}: HourProps) {
  const { currentUser, runs, addPlannedVisit, removePlannedVisit } = useApp();
  const [saving, setSaving] = React.useState(false);
  const [notice, setNotice] = React.useState<string | null>(null);
  const lock = React.useRef(false);
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
      onToggle={() => void toggle()}
      runs={slot.games}
      saving={saving}
      compact={compact}
      title={`${hour % 12 || 12} ${hour < 12 ? "AM" : "PM"}`}
    />
  );
}
