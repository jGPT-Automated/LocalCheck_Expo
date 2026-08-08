import React from "react";
import { StyleSheet, Text, View } from "react-native";

import { Colors } from "@/constants/colors";
import { MatchResult } from "@/constants/data";
import { Typography } from "@/constants/typography";

interface MatchRowProps {
  match: MatchResult;
}

export function MatchRow({ match }: MatchRowProps) {
  const isWin = match.result === "WIN";
  const deltaStr =
    match.eloDelta == null ? "—" : match.eloDelta > 0 ? `+${match.eloDelta}` : `${match.eloDelta}`;
  const gameLabel = match.gameType ?? match.sport ?? "—";

  return (
    <View style={styles.container}>
      <View style={[styles.resultBar, { backgroundColor: isWin ? Colors.win : Colors.loss }]} />

      <View style={styles.scoreBlock}>
        <Text style={[styles.score, { color: isWin ? Colors.win : Colors.loss }]}>
          {match.teamScore}—{match.opposingScore}
        </Text>
        <Text style={styles.date}>{match.date}</Text>
      </View>

      <View style={styles.center}>
        <Text style={styles.gameType}>{gameLabel}</Text>
        <Text style={styles.court} numberOfLines={1}>{match.courtName}</Text>
      </View>

      <View style={[styles.deltaBlock, { backgroundColor: isWin ? Colors.winDim : Colors.lossDim }]}>
        <Text style={[styles.delta, { color: isWin ? Colors.win : Colors.loss }]}>{deltaStr}</Text>
        <Text style={styles.eloLabel}>ELO</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 10,
    borderBottomWidth: 0.5,
    borderColor: Colors.border,
    gap: 10,
  },
  resultBar: {
    width: 3,
    height: 44,
    borderRadius: 1,
  },
  scoreBlock: {
    alignItems: "center",
    minWidth: 52,
  },
  score: {
    fontFamily: Typography.heading,
    fontSize: 18,
    letterSpacing: 0.5,
    lineHeight: 20,
    fontVariant: ["tabular-nums"] as any,
  },
  date: {
    fontFamily: Typography.bodyMedium,
    fontSize: 8,
    color: Colors.mutedDark,
    letterSpacing: 1,
    textTransform: "uppercase" as const,
    marginTop: 2,
  },
  center: {
    flex: 1,
    gap: 2,
  },
  gameType: {
    fontFamily: Typography.heading,
    fontSize: 14,
    color: Colors.text,
    letterSpacing: 0.5,
    lineHeight: 16,
  },
  court: {
    fontFamily: Typography.body,
    fontSize: 10,
    color: Colors.muted,
    letterSpacing: 0.2,
  },
  deltaBlock: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    minWidth: 48,
    alignItems: "center",
  },
  delta: {
    fontFamily: Typography.heading,
    fontSize: 16,
    letterSpacing: 0.5,
    lineHeight: 18,
  },
  eloLabel: {
    fontFamily: Typography.bodyMedium,
    fontSize: 7,
    color: Colors.mutedDark,
    letterSpacing: 1.5,
    textTransform: "uppercase" as const,
    marginTop: 1,
  },
});
