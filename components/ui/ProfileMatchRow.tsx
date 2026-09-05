import React from "react";
import { StyleSheet, Text, View } from "react-native";

import { Colors } from "@/constants/colors";
import type { MatchResult } from "@/constants/data";
import { Space } from "@/constants/layout";
import { TextStyles, Typography } from "@/constants/typography";

export function ProfileMatchRow({
  match,
  opponentName,
}: {
  match: MatchResult;
  /** When every row in this list is against the same known player (a
   * head-to-head list), pass their name so the row leads with who was
   * played instead of where — MatchResult carries no participant names of
   * its own. */
  opponentName?: string;
}) {
  const won = match.result === "WIN";

  return (
    <View style={styles.row}>
      <View
        style={[styles.resultMark, won ? styles.resultWin : styles.resultLoss]}
      />
      <View style={styles.copy}>
        <Text numberOfLines={1} style={styles.court}>
          {opponentName ? `VS ${opponentName.toUpperCase()}` : match.courtName}
        </Text>
        <Text numberOfLines={1} style={styles.meta}>
          {opponentName
            ? `${match.courtName} · ${formatDate(match.playedAtIso)}`
            : `${formatDate(match.playedAtIso)} · ${match.sport.toUpperCase()}`}
        </Text>
      </View>
      <View style={styles.scoreBlock}>
        <Text style={styles.score}>
          {match.teamScore}–{match.opposingScore}
        </Text>
        <Text style={[styles.result, won ? styles.win : styles.loss]}>
          {match.result}
        </Text>
      </View>
    </View>
  );
}

function formatDate(value: string): string {
  return new Date(value)
    .toLocaleDateString("en-US", { month: "short", year: "numeric" })
    .toUpperCase();
}

const styles = StyleSheet.create({
  row: {
    minHeight: 68,
    flexDirection: "row",
    alignItems: "center",
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.border,
  },
  resultMark: { width: 3, height: 32, marginRight: Space.md, borderRadius: 2 },
  resultWin: { backgroundColor: Colors.win },
  resultLoss: { backgroundColor: Colors.loss },
  copy: { flex: 1, minWidth: 0 },
  court: { ...TextStyles.listName, color: Colors.text },
  meta: {
    marginTop: 4,
    ...TextStyles.caption,
    color: Colors.muted,
    letterSpacing: 0,
  },
  scoreBlock: { alignItems: "flex-end" },
  score: {
    fontFamily: Typography.headingBold,
    fontSize: 17,
    color: Colors.text,
  },
  result: { marginTop: 2, ...TextStyles.labelSmall, letterSpacing: 0.6 },
  win: { color: Colors.win },
  loss: { color: Colors.loss },
});
