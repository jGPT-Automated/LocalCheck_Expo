import React from "react";
import { View } from "react-native";

import { CourtBusyChart } from "@/components/court/CourtBusyChart";
import { HourSlotCard } from "@/components/court/HourSlotCard";
import type { Court, GameRun } from "@/constants/data";
import { useCourtActivity } from "@/hooks/useCourtActivity";
import type { CourtHourPick } from "@/lib/courtActivityModel";

/** Home and drawer compose exactly the same chart and selected-hour row. */
export function CourtDayPlanner({
  court,
  games,
  liveCount,
  onReveal,
}: {
  court: Court;
  games: GameRun[];
  liveCount: number;
  onReveal?: () => void;
}) {
  const data = useCourtActivity(court.id, liveCount);
  const [picked, setPicked] = React.useState<CourtHourPick | null>(null);
  React.useEffect(() => setPicked(null), [court.id]);
  return (
    <>
      <CourtBusyChart
        courtId={court.id}
        games={games}
        liveCount={liveCount}
        data={data}
        maxBack={0}
        selected={picked}
        onDayChange={() => setPicked(null)}
        onSelect={(pick) =>
          setPicked(
            pick.dayOffset === 0 && pick.hour <= new Date(data.now).getHours()
              ? null
              : pick,
          )
        }
      />
      {picked ? <View onLayout={onReveal} testID="selected-court-hour">
        <HourSlotCard
          court={court}
          dayOffset={picked.dayOffset}
          hour={picked.hour}
          data={data}
          compact
        />
      </View> : null}
    </>
  );
}
