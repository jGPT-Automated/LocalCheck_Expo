import React from "react";
import { StyleSheet, View } from "react-native";

import { CourtBusyChart } from "@/components/court/CourtBusyChart";
import { HourSlotCard } from "@/components/court/HourSlotCard";
import type { Court, GameRun } from "@/constants/data";
import { useCourtActivity } from "@/hooks/useCourtActivity";
import type { CourtHourPick } from "@/lib/courtActivityModel";
import { Colors, Radius } from "@/constants/colors";

/** Home and drawer compose exactly the same chart and selected-hour row. */
export function CourtDayPlanner({
  court,
  games,
  liveCount,
  onReveal,
  onPlayerPress,
  onRunPress,
  onCreateGame,
}: {
  court: Court;
  games: GameRun[];
  liveCount: number;
  onReveal?: (selectionBottom: number) => void;
  onPlayerPress?: (playerId: string) => void;
  onRunPress?: (runId: string) => void;
  onCreateGame?: () => void;
}) {
  const data = useCourtActivity(court.id, liveCount);
  const revealedFor = React.useRef<string | null>(null);
  const [picked, setPicked] = React.useState<CourtHourPick | null>(null);
  React.useEffect(() => setPicked(null), [court.id]);
  React.useEffect(() => { if (!picked) revealedFor.current = null; }, [picked]);
  return (
    <View testID="court-day-planner" style={styles.panel}>
      <CourtBusyChart
        courtId={court.id}
        games={games}
        liveCount={liveCount}
        data={data}
        maxBack={0}
        selectionHeader
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
      {picked ? (
        <View
          key={`${picked.dayOffset}-${picked.hour}`}
          onLayout={(event) => {
            const key = `${court.id}:${picked.dayOffset}:${picked.hour}`;
            if (revealedFor.current === key) return;
            revealedFor.current = key;
            onReveal?.(event.nativeEvent.layout.y + event.nativeEvent.layout.height + 14);
          }}
          testID="selected-court-hour"
        >
          <HourSlotCard
            court={court}
            dayOffset={picked.dayOffset}
            hour={picked.hour}
            data={data}
            embedded
            onPlayerPress={onPlayerPress}
            onRunPress={onRunPress}
            onCreateGame={onCreateGame}
          />
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  panel: {
    padding: 14,
    borderRadius: Radius.panel,
    borderWidth: 1,
    borderColor: Colors.hairlineCard,
    backgroundColor: Colors.sheet,
  },
});
