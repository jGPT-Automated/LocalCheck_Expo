import React from "react";
import { StyleSheet, Text, View } from "react-native";

import { Colors, Radius } from "@/constants/colors";
import { Layout, Space } from "@/constants/layout";
import { TextStyles, Typography } from "@/constants/typography";

export function HeadToHeadSummary({
  opponentName,
  wins,
  losses,
  matched,
  winRate,
}: {
  opponentName: string;
  wins: number;
  losses: number;
  matched: number;
  winRate: number;
}) {
  return (
    <View style={styles.section}>
      <View style={styles.header}>
        <Text style={styles.eyebrow}>MATCH HISTORY</Text>
        <Text style={styles.games}>
          {matched} {matched === 1 ? "GAME" : "GAMES"}
        </Text>
      </View>
      <View style={styles.scoreboard}>
        <View style={styles.playerSide}>
          <Text style={styles.playerLabel}>YOU</Text>
          <Text style={styles.score}>{wins}</Text>
          <Text style={styles.recordLabel}>WINS</Text>
        </View>
        <View style={styles.centerStat}>
          <Text style={styles.rate}>{winRate}%</Text>
          <Text style={styles.rateLabel}>YOUR WIN RATE</Text>
        </View>
        <View style={styles.playerSide}>
          <Text numberOfLines={1} style={styles.playerLabel}>
            {opponentName.split(" ")[0].toUpperCase()}
          </Text>
          <Text style={styles.score}>{losses}</Text>
          <Text style={styles.recordLabel}>WINS</Text>
        </View>
      </View>
      {matched === 0 ? (
        <Text style={styles.empty}>No games logged yet.</Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    margin: Layout.screenGutter,
    padding: Space.lg,
    borderRadius: Radius.lg,
    backgroundColor: Colors.surfaceHigh,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.borderLight,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingBottom: Space.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.border,
  },
  eyebrow: { ...TextStyles.label, color: Colors.accent, letterSpacing: 1.3 },
  games: { ...TextStyles.labelSmall, color: Colors.muted, letterSpacing: 0.6 },
  scoreboard: { minHeight: 112, flexDirection: "row", alignItems: "stretch" },
  playerSide: {
    flex: 1,
    minWidth: 0,
    alignItems: "center",
    justifyContent: "center",
    gap: Space.sm,
  },
  playerLabel: {
    ...TextStyles.labelSmall,
    maxWidth: "100%",
    color: Colors.textSecondary,
  },
  score: {
    fontFamily: Typography.headingBold,
    fontSize: 34,
    lineHeight: 40,
    color: Colors.text,
  },
  recordLabel: {
    ...TextStyles.labelSmall,
    color: Colors.muted,
    letterSpacing: 0.6,
  },
  centerStat: {
    flex: 1.25,
    alignItems: "center",
    justifyContent: "center",
    borderLeftWidth: StyleSheet.hairlineWidth,
    borderRightWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.border,
  },
  rate: { ...TextStyles.stat, color: Colors.accent },
  rateLabel: {
    ...TextStyles.labelSmall,
    marginTop: 2,
    color: Colors.muted,
    textAlign: "center",
  },
  empty: {
    ...TextStyles.metadata,
    paddingTop: Space.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: Colors.border,
    color: Colors.textSecondary,
    textAlign: "center",
  },
});
