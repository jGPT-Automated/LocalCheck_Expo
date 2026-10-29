import React from "react";
import { StyleSheet, View } from "react-native";

import { CourtBusyChart } from "@/components/court/CourtBusyChart";
import { SectionHead } from "@/components/court/CourtParts";
import { HourSlotCard } from "@/components/court/HourSlotCard";
import { SCHEDULE_END_HOUR, SCHEDULE_START_HOUR } from "@/components/schedule/scheduleModel";
import { Colors, Radius } from "@/constants/colors";
import type { Court, GameRun } from "@/constants/data";

/** The hour Today opens on: this hour, or the first hour of the day before it starts. */
function defaultHour(now: Date): { dayOffset: number; hour: number } {
  const hour = now.getHours();
  if (hour < SCHEDULE_START_HOUR) return { dayOffset: 0, hour: SCHEDULE_START_HOUR };
  if (hour > SCHEDULE_END_HOUR) return { dayOffset: 1, hour: SCHEDULE_START_HOUR };
  return { dayOffset: 0, hour };
}

/**
 * Today at a court, one card: the day's hours as bars (tap one), then that
 * hour: who's going, a + to go, and its game or open run. Home and the
 * expanded Explore drawer both show it, so they read the same.
 */
export function TodayPanel({
  court,
  games,
  refreshKey,
}: {
  court: Court;
  games: GameRun[];
  refreshKey?: number | string;
}) {
  const [picked, setPicked] = React.useState(() => defaultHour(new Date()));
  React.useEffect(() => {
    setPicked(defaultHour(new Date()));
  }, [court.id]);
  return (
    <View style={styles.card}>
      <SectionHead title="Today" />
      <CourtBusyChart
        courtId={court.id}
        games={games}
        height={64}
        onSelect={setPicked}
        refreshKey={refreshKey}
        selected={picked}
        variant="header"
      />
      <View style={styles.slot}>
        <HourSlotCard
          bare
          court={court}
          dayOffset={picked.dayOffset}
          hour={picked.hour}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    marginHorizontal: 20,
    padding: 16,
    borderRadius: Radius.panel,
    borderWidth: 1,
    borderColor: Colors.hairlineCard,
    backgroundColor: Colors.panel,
  },
  slot: { marginTop: 16, paddingTop: 16, borderTopWidth: 1, borderTopColor: Colors.hairline },
});
