import { router } from "expo-router";
import React from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";

import { CourtBusyChart } from "@/components/court/CourtBusyChart";
import { HourSlotCard } from "@/components/court/HourSlotCard";
import { PlayerAvatar } from "@/components/PlayerAvatar";
import { ActivityRow } from "@/components/ui/ActivityRow";
import { PressableScale } from "@/components/ui/PressableScale";
import { Colors } from "@/constants/colors";
import type { Court, FeedItem, GameRun, Player } from "@/constants/data";
import { Typography } from "@/constants/typography";
import { useCourtActivity } from "@/hooks/useCourtActivity";
import { courtHourEvents, type CourtHourPick } from "@/lib/courtActivityModel";
import { busyDay, hourLabel } from "@/lib/courtBusyModel";
import { formatTimeOnCourt } from "@/lib/courtHours";

/** LCv5's linked chart/timeline on the court route; Home stays a dashboard. */
export function CourtActivityFeed({
  court,
  roster,
  activeCount,
  games,
  events,
  bottomInset,
  onActivity,
  initialPick,
  onPickChange,
}: {
  court: Court;
  roster: Player[];
  activeCount: number;
  games: GameRun[];
  events: FeedItem[];
  bottomInset: number;
  onActivity: (item: FeedItem) => void;
  initialPick?: CourtHourPick;
  onPickChange?: (pick: CourtHourPick) => void;
}) {
  const data = useCourtActivity(court.id, roster.length);
  const now = data.now;
  const initial = initialPick ?? {
    dayOffset: 0,
    hour: Math.max(6, Math.min(22, new Date(now).getHours())),
  };
  const [day, setDay] = React.useState(initial.dayOffset);
  const [selected, setSelected] = React.useState<CourtHourPick>(initial);
  const scroll = React.useRef<ScrollView>(null);
  const rows = React.useRef(new Map<number, number>());
  const jump = React.useRef<number | null>(initial.hour);
  const [viewport, setViewport] = React.useState(0);
  const bars = busyDay({
    dayOffset: day,
    now,
    spans: data.spans,
    planned: data.planned,
    games: [],
  });
  const goToHour = (hour: number) => {
    const y = rows.current.get(hour);
    if (y === undefined) {
      jump.current = hour;
      return;
    }
    jump.current = null;
    scroll.current?.scrollTo({ y: Math.max(0, y - 64), animated: false });
  };
  const pick = (next: CourtHourPick) => {
    setSelected(next);
    onPickChange?.(next);
    goToHour(next.hour);
  };
  const setDayAndFocus = (next: number) => {
    setDay(next);
    const hour =
      next === 0
        ? Math.max(6, Math.min(22, new Date().getHours()))
        : selected.hour;
    setSelected({ dayOffset: next, hour });
    onPickChange?.({ dayOffset: next, hour });
    jump.current = hour;
    requestAnimationFrame(() => goToHour(hour));
  };
  const onScroll = (y: number) => {
    const focus = y + 64;
    const entries = [...rows.current.entries()].sort((a, b) => a[1] - b[1]);
    let hour = entries[0]?.[0] ?? selected.hour;
    for (const [h, top] of entries) if (top <= focus + 1) hour = h;
    setSelected((previous) =>
      previous.hour === hour && previous.dayOffset === day
        ? previous
        : { dayOffset: day, hour },
    );
  };
  React.useEffect(() => {
    if (data.ready) requestAnimationFrame(() => goToHour(selected.hour));
  }, [data.ready]);
  return (
    <View style={styles.root}>
      <View style={styles.chart}>
        <CourtBusyChart
          courtId={court.id}
          games={games}
          liveCount={activeCount}
          data={data}
          dayOffset={day}
          onDayChange={setDayAndFocus}
          selected={selected}
          onSelect={pick}
          allowPast
          maxBack={6}
        />
      </View>
      {data.ready ? (
        <ScrollView
          ref={scroll}
          testID="court-activity-scroll"
          style={styles.scroll}
          showsVerticalScrollIndicator={false}
          bounces={false}
          overScrollMode="never"
          scrollEventThrottle={16}
          onLayout={(e) => setViewport(e.nativeEvent.layout.height)}
          onScroll={(e) => onScroll(e.nativeEvent.contentOffset.y)}
          contentContainerStyle={{
            paddingHorizontal: 20,
            paddingBottom: Math.max(bottomInset, viewport - 80),
          }}
        >
          {[...bars].reverse().map((bar) => {
            const items = courtHourEvents(
              events,
              { dayOffset: day, hour: bar.hour },
              now,
            );
            return (
              <View
                key={bar.hour}
                testID={`activity-hour-${bar.hour}`}
                onLayout={(e) => {
                  rows.current.set(bar.hour, e.nativeEvent.layout.y);
                  if (jump.current === bar.hour)
                    requestAnimationFrame(() => goToHour(bar.hour));
                }}
                style={[
                  styles.hourGroup,
                  selected.hour === bar.hour &&
                    bar.kind !== "now" &&
                    styles.focused,
                ]}
              >
                {bar.kind === "planned" ? (
                  <HourSlotCard
                    court={court}
                    dayOffset={day}
                    hour={bar.hour}
                    data={data}
                    compact
                  />
                ) : bar.kind === "now" ? (
                  <>
                    <View style={styles.nowHead}>
                      <View style={styles.dot} />
                      <Text style={styles.nowLabel}>Now</Text>
                      <Text style={styles.nowCount}>
                        {activeCount > roster.length ? "~" : ""}
                        {activeCount} on court
                      </Text>
                      <View style={styles.rule} />
                    </View>
                    {roster.length ? (
                      roster.map((player) => (
                        <PressableScale
                          key={player.id}
                          accessibilityRole="button"
                          accessibilityLabel={player.name}
                          onPress={() => router.push(`/player/${player.id}`)}
                          style={styles.player}
                        >
                          <PlayerAvatar
                            initials={player.avatar}
                            name={player.name}
                            playerId={player.id}
                            size={36}
                          />
                          <Text style={styles.playerName}>{player.name}</Text>
                          <Text style={styles.meta}>
                            {formatTimeOnCourt(player.checkedInAt) ?? "Now"}
                          </Text>
                        </PressableScale>
                      ))
                    ) : activeCount === 0 ? (
                      <Text style={styles.empty}>
                        Nobody yet. Check in and you're first.
                      </Text>
                    ) : null}
                    {activeCount > roster.length ? (
                      <Text style={styles.empty}>
                        +{activeCount - roster.length} private
                      </Text>
                    ) : null}
                    {items.map((item, i) => (
                      <ActivityRow
                        key={item.id}
                        item={item}
                        previous={items[i - 1] ?? item}
                        showActor
                        onPress={() => onActivity(item)}
                        onActorPress={() =>
                          router.push(`/player/${item.playerId}`)
                        }
                      />
                    ))}
                  </>
                ) : (
                  <>
                    <View style={styles.pastHead}>
                      <Text style={styles.pastHour}>{hourLabel(bar.hour)}</Text>
                      <Text style={styles.meta}>
                        {bar.value ? `${bar.value} checked in` : "Quiet"}
                      </Text>
                    </View>
                    {items.map((item, i) => (
                      <ActivityRow
                        key={item.id}
                        item={item}
                        previous={items[i - 1] ?? item}
                        showActor
                        onPress={() => onActivity(item)}
                        onActorPress={() =>
                          router.push(`/player/${item.playerId}`)
                        }
                      />
                    ))}
                  </>
                )}
              </View>
            );
          })}
        </ScrollView>
      ) : null}
    </View>
  );
}
const styles = StyleSheet.create({
  root: { flex: 1, minHeight: 0 },
  chart: {
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.hairline,
  },
  scroll: { flex: 1, minHeight: 0 },
  hourGroup: { marginHorizontal: -8, paddingHorizontal: 8 },
  focused: { backgroundColor: Colors.surface },
  nowHead: {
    minHeight: 44,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 10,
  },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: Colors.accent },
  nowLabel: {
    fontFamily: Typography.bodyBold,
    fontSize: 11,
    color: Colors.liveInk,
    textTransform: "uppercase",
  },
  nowCount: {
    fontFamily: Typography.bodyMedium,
    fontSize: 11,
    color: Colors.liveInk,
  },
  rule: { flex: 1, height: 1, backgroundColor: Colors.accentBorder },
  player: {
    flexDirection: "row",
    alignItems: "center",
    minHeight: 58,
    gap: 12,
  },
  playerName: {
    flex: 1,
    minWidth: 0,
    fontFamily: Typography.bodyMedium,
    fontSize: 14,
    lineHeight: 20,
    color: Colors.text,
  },
  meta: {
    fontFamily: Typography.bodyMedium,
    fontSize: 11,
    color: Colors.textSecondary,
  },
  empty: {
    paddingVertical: 14,
    fontFamily: Typography.bodyMedium,
    fontSize: 12,
    lineHeight: 18,
    color: Colors.textSecondary,
  },
  pastHead: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    minHeight: 58,
    borderBottomWidth: 1,
    borderBottomColor: Colors.hairline,
  },
  pastHour: {
    width: 44,
    fontFamily: Typography.headingSemiBold,
    fontSize: 16,
    color: Colors.textSecondary,
  },
});
