import { router } from "expo-router";
import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { Colors } from "@/constants/colors";
import { formatClockTime } from "@/components/home/homePresentation";
import { formatForMaxPlayers } from "@/components/schedule/scheduledGameModel";
import { GameRun } from "@/constants/data";
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
  const format = formatForMaxPlayers(max) ?? "GAME";

  return (
    <Pressable
      accessibilityHint="Opens scheduled game details"
      accessibilityLabel={`${format} at ${run.courtName}, ${formatClockTime(run.time)}, ${spotsLeft} spots open`}
      accessibilityRole="button"
      onPress={() => router.push(`/run/${run.id}`)}
      style={({ pressed }) => [styles.container, pressed && styles.pressed]}
    >
      <View style={styles.sportAccent} />
      <View style={styles.left}>
        <Text style={styles.time}>{formatClockTime(run.time)}</Text>
        <Text style={styles.date}>{run.date}</Text>
      </View>
      <View style={styles.divider} />
      <View style={styles.center}>
        <View style={styles.titleRow}>
          <Text style={styles.title}>{format}</Text>
          <Text style={styles.status}>SCHEDULED</Text>
        </View>
        {/* The page is already court-scoped, so lead with the format and let
            the court fall back to its short slug next to the creator. */}
        <Text style={styles.court} numberOfLines={1}>
          {(run.courtShortName || run.courtName).toUpperCase()} · CREATED BY{" "}
          {run.hostName?.toUpperCase() || "COURT LOCAL"}
        </Text>
        <View style={styles.meta}>
          <View style={styles.avatarRow}>
            {run.participants.slice(0, 4).map((p, i) => (
              <PlayerAvatar
                key={p.id}
                initials={p.avatar}
                name={p.name}
                playerId={p.id}
                size={20}
                style={{ marginLeft: i > 0 ? -5 : 0, zIndex: 4 - i }}
              />
            ))}
          </View>
          <Text style={styles.spots}>{isFull ? "ROSTER FULL" : `${total}/${max} JOINED · ${spotsLeft} OPEN`}</Text>
        </View>
      </View>
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
  sportAccent: { width: 3, alignSelf: "stretch", backgroundColor: Colors.accent },
  left: { alignItems: "center", width: 72, paddingVertical: 14, paddingLeft: 12 },
  time: { fontFamily: Typography.heading, fontSize: 16, color: Colors.text, lineHeight: 19 },
  date: {
    fontFamily: Typography.bodyMedium, fontSize: 8, color: Colors.muted,
    letterSpacing: 1, textTransform: "uppercase" as const, marginTop: 2,
  },
  divider: { width: 1, height: 48, backgroundColor: Colors.border, marginHorizontal: 12 },
  center: { flex: 1, paddingVertical: 14 },
  titleRow: { flexDirection: "row", alignItems: "baseline", gap: 8 },
  title: { fontFamily: Typography.heading, fontSize: 22, lineHeight: 25, color: Colors.text, letterSpacing: 0.6 },
  status: { fontFamily: Typography.bodySemiBold, fontSize: 10, lineHeight: 14, color: Colors.accent, letterSpacing: 1 },
  court: {
    fontFamily: Typography.body, fontSize: 10, lineHeight: 14, color: Colors.muted,
    letterSpacing: 0.5, marginTop: 3, marginBottom: 8,
  },
  meta: { flexDirection: "row", alignItems: "center", gap: 10 },
  avatarRow: { flexDirection: "row" },
  spots: {
    fontFamily: Typography.bodySemiBold, fontSize: 11, lineHeight: 14, color: Colors.muted,
    letterSpacing: 0.6, textTransform: "uppercase" as const,
  },
});
