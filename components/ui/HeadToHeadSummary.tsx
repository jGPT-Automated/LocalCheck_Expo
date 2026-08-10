import React from "react";
import { StyleSheet, Text, View } from "react-native";

import { Colors } from "@/constants/colors";
import { Layout, Space } from "@/constants/layout";
import { Typography } from "@/constants/typography";

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
      <Text style={styles.eyebrow}>HEAD TO HEAD</Text>
      <View style={styles.summaryRow}>
        <View style={styles.record}>
          <Text style={styles.win}>{wins}</Text>
          <Text style={styles.dash}>–</Text>
          <Text style={styles.loss}>{losses}</Text>
        </View>
        <View style={styles.copy}>
          <Text style={styles.primary}>{winRate}% WIN RATE</Text>
          <Text style={styles.secondary}>{matched} {matched === 1 ? "GAME" : "GAMES"} VS {opponentName.toUpperCase()}</Text>
        </View>
      </View>
      {matched === 0 ? (
        <Text style={styles.empty}>No games logged together yet.</Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    paddingHorizontal: Layout.screenGutter,
    paddingVertical: Space.lg,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.border,
  },
  eyebrow: { fontFamily: Typography.bodySemiBold, fontSize: 9, color: Colors.textSecondary, letterSpacing: 1.7 },
  summaryRow: { minHeight: 70, marginTop: Space.sm, flexDirection: "row", alignItems: "center", gap: Space.xl },
  record: { flexDirection: "row", alignItems: "baseline" },
  win: { fontFamily: Typography.headingBold, fontSize: 34, lineHeight: 38, color: Colors.win },
  dash: { marginHorizontal: 6, fontFamily: Typography.headingRegular, fontSize: 22, color: Colors.muted },
  loss: { fontFamily: Typography.headingBold, fontSize: 34, lineHeight: 38, color: Colors.loss },
  copy: { flex: 1, minWidth: 0 },
  primary: { fontFamily: Typography.bodySemiBold, fontSize: 11, color: Colors.text, letterSpacing: 0.8 },
  secondary: { marginTop: 5, fontFamily: Typography.bodyMedium, fontSize: 8, color: Colors.muted, letterSpacing: 1 },
  empty: { fontFamily: Typography.body, fontSize: 11, color: Colors.textSecondary },
});
