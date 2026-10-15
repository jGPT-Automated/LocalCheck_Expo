// Court page › Games (Claude Design handoff): upcoming scheduled games at
// this court, grouped by day, with "x of y going" and a fill bar. Tapping a
// game opens the existing game page (app/run/[id].tsx), where joining lives.
import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { Colors } from "@/constants/colors";
import type { GameRun } from "@/constants/data";
import { Typography } from "@/constants/typography";

function dayLabel(date: Date): string {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const day = new Date(date);
  day.setHours(0, 0, 0, 0);
  const diff = Math.round((day.getTime() - today.getTime()) / 86_400_000);
  if (diff === 0) return "Today";
  if (diff === 1) return "Tomorrow";
  return date.toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric" });
}

export function CourtGamesPanel({ games, onOpen }: { games: GameRun[]; onOpen: (game: GameRun) => void }) {
  if (games.length === 0) {
    return (
      <View style={styles.wrap}>
        <Text style={styles.eyebrow}>Upcoming</Text>
        <Text style={styles.empty}>Nothing scheduled.</Text>
      </View>
    );
  }
  const groups: Array<{ label: string; games: GameRun[] }> = [];
  for (const game of games) {
    const label = dayLabel(new Date(game.startTimeIso));
    const last = groups[groups.length - 1];
    if (last?.label === label) last.games.push(game);
    else groups.push({ label, games: [game] });
  }
  return (
    <View style={styles.wrap}>
      <Text style={styles.eyebrow}>Upcoming · {games.length}</Text>
      {groups.map((group) => (
        <View key={group.label} style={styles.group}>
          <Text style={styles.day}>{group.label}</Text>
          {group.games.map((game) => {
            const start = new Date(game.startTimeIso);
            const hours = start.getHours();
            const going = game.participants.length;
            const max = Math.max(game.maxPlayers, 1);
            return (
              <Pressable
                accessibilityLabel={`${game.title}, ${going} of ${game.maxPlayers} going`}
                accessibilityRole="button"
                key={game.id}
                onPress={() => onOpen(game)}
                style={({ pressed }) => [styles.card, pressed && styles.pressed]}
              >
                <View style={styles.timeCol}>
                  <Text style={styles.time}>
                    {hours % 12 === 0 ? 12 : hours % 12}
                    {start.getMinutes() ? `:${String(start.getMinutes()).padStart(2, "0")}` : ""}
                  </Text>
                  <Text style={styles.ampm}>{hours >= 12 ? "PM" : "AM"}</Text>
                </View>
                <View style={styles.body}>
                  <Text numberOfLines={1} style={styles.title}>{game.title}</Text>
                  <Text style={styles.going}>{going} of {game.maxPlayers} going</Text>
                  <View style={styles.bar}>
                    <View style={[styles.fill, { width: `${Math.min(100, (going / max) * 100)}%` }]} />
                  </View>
                </View>
              </Pressable>
            );
          })}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { paddingHorizontal: 20, paddingTop: 16, gap: 12 },
  eyebrow: { fontFamily: Typography.bodyBold, fontSize: 9, letterSpacing: 1.3, textTransform: "uppercase", color: Colors.textSecondary },
  empty: { fontFamily: Typography.bodyMedium, fontSize: 12, color: Colors.textSecondary },
  group: { gap: 8 },
  day: { marginTop: 4, fontFamily: Typography.bodyBold, fontSize: 9, letterSpacing: 1.3, textTransform: "uppercase", color: Colors.muted },
  card: { flexDirection: "row", gap: 14, padding: 14, borderRadius: 13, borderWidth: 1, borderColor: Colors.hairlineCard, backgroundColor: Colors.panel },
  timeCol: { width: 44, alignItems: "flex-start" },
  time: { fontFamily: Typography.headingSemiBold, fontSize: 18, lineHeight: 20, color: Colors.text },
  ampm: { fontFamily: Typography.bodyBold, fontSize: 8, letterSpacing: 1, color: Colors.muted },
  body: { flex: 1, gap: 4 },
  title: { fontFamily: Typography.bodySemiBold, fontSize: 13, color: Colors.text },
  going: { fontFamily: Typography.bodyMedium, fontSize: 11, color: Colors.textSecondary },
  bar: { height: 3, marginTop: 4, borderRadius: 2, backgroundColor: Colors.surfaceHigh, overflow: "hidden" },
  fill: { height: 3, backgroundColor: Colors.text },
  pressed: { opacity: 0.8 },
});
