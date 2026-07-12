import { router } from "expo-router";
import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { Colors } from "@/constants/colors";
import { GameRun, getSportColor } from "@/constants/data";
import { Typography } from "@/constants/typography";
import { PlayerAvatar } from "./PlayerAvatar";

interface RunCardProps {
  run: GameRun;
}

export function RunCard({ run }: RunCardProps) {
  const total = run.participants.length;
  const max = run.maxPlayers;
  const isFull = total >= max;
  const spotsLeft = Math.max(0, max - total);
  const sportColor = getSportColor(run.sport);

  return (
    <Pressable
      onPress={() => router.push(`/run/${run.id}`)}
      style={({ pressed }) => [styles.container, pressed && styles.pressed]}
    >
      <View style={[styles.sportAccent, { backgroundColor: sportColor }]} />
      <View style={styles.left}>
        <Text style={styles.time}>{run.time}</Text>
        <Text style={styles.date}>{run.date}</Text>
      </View>
      <View style={styles.divider} />
      <View style={styles.center}>
        <Text style={styles.title}>{run.title}</Text>
        <Text style={styles.level}>{run.skillLevel}</Text>
        <View style={styles.meta}>
          <View style={styles.avatarRow}>
            {run.participants.slice(0, 4).map((p, i) => (
              <PlayerAvatar
                key={p.id}
                initials={p.avatar}
                size={20}
                style={{ marginLeft: i > 0 ? -5 : 0, zIndex: 4 - i }}
              />
            ))}
          </View>
          <Text style={styles.spots}>{isFull ? "FULL" : `${spotsLeft} SPOTS`}</Text>
        </View>
      </View>
      <Text style={styles.arrow}>›</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row", alignItems: "center",
    backgroundColor: Colors.surface,
    borderWidth: 1, borderColor: Colors.border,
    marginBottom: -1, overflow: "hidden",
  },
  pressed: { backgroundColor: Colors.surfaceHigh },
  sportAccent: { width: 3, alignSelf: "stretch" },
  left: { alignItems: "center", width: 58, paddingVertical: 14, paddingLeft: 12 },
  time: { fontFamily: Typography.heading, fontSize: 18, color: Colors.text, lineHeight: 20 },
  date: {
    fontFamily: Typography.bodyMedium, fontSize: 8, color: Colors.muted,
    letterSpacing: 1, textTransform: "uppercase" as const, marginTop: 2,
  },
  divider: { width: 1, height: 48, backgroundColor: Colors.border, marginHorizontal: 12 },
  center: { flex: 1, paddingVertical: 14 },
  title: { fontFamily: Typography.heading, fontSize: 14, color: Colors.text, letterSpacing: 0.5 },
  level: {
    fontFamily: Typography.bodyMedium, fontSize: 9, color: Colors.muted,
    letterSpacing: 1.5, textTransform: "uppercase" as const, marginTop: 2, marginBottom: 6,
  },
  meta: { flexDirection: "row", alignItems: "center", gap: 10 },
  avatarRow: { flexDirection: "row" },
  spots: {
    fontFamily: Typography.bodyBold, fontSize: 10, color: Colors.muted,
    letterSpacing: 1, textTransform: "uppercase" as const,
  },
  arrow: { fontFamily: Typography.heading, fontSize: 22, color: Colors.muted, paddingRight: 12 },
});
