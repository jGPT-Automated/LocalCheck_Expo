import React from "react";
import { StyleSheet, Text, View } from "react-native";

import { PlayerAvatar } from "@/components/PlayerAvatar";
import { Colors, Radius } from "@/constants/colors";
import { Layout, Space } from "@/constants/layout";
import { Typography } from "@/constants/typography";
import {
  firstName,
  type HeadToHeadSummary as Summary,
  seriesHeadline,
  signed,
} from "@/lib/headToHead";

type Side = { id: string; name: string; initials?: string };

/**
 * The HEAD TO HEAD card on another player's profile: series score with both
 * avatars, a split bar, then average margin, your ELO net and last played.
 */
export function HeadToHeadSummary({
  me,
  them,
  summary,
}: {
  me: Side;
  them: Side;
  summary: Summary;
}) {
  const share = summary.games > 0 ? summary.myWins / summary.games : 0.5;
  const myLeads = summary.leader === "you";
  const theyLead = summary.leader === "them";
  return (
    <View style={styles.card}>
      <View style={styles.series}>
        <PlayerAvatar initials={me.initials} name={me.name} playerId={me.id} size={46} />
        <View style={styles.sideScore}>
          <Text style={styles.sideLabel}>YOU</Text>
          <Text style={[styles.score, theyLead && styles.scoreTrailing]}>{summary.myWins}</Text>
        </View>
        <View style={styles.center}>
          <Text style={styles.centerLabel}>SERIES</Text>
          <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8} style={styles.headline}>
            {seriesHeadline(summary, them.name)}
          </Text>
        </View>
        <View style={[styles.sideScore, styles.sideScoreRight]}>
          <Text numberOfLines={1} style={styles.sideLabel}>
            {firstName(them.name).toUpperCase()}
          </Text>
          <Text style={[styles.score, myLeads && styles.scoreTrailing]}>{summary.theirWins}</Text>
        </View>
        <PlayerAvatar initials={them.initials} name={them.name} playerId={them.id} size={46} />
      </View>

      <View style={styles.bar}>
        <View style={[styles.barMine, { flex: Math.max(share, 0.001) }]} />
        <View style={[styles.barTheirs, { flex: Math.max(1 - share, 0.001) }]} />
      </View>

      <View style={styles.stats}>
        <Stat
          label="AVG MARGIN"
          value={summary.avgMargin == null ? "—" : signed(summary.avgMargin)}
        />
        <Stat
          divider
          label="YOUR ELO NET"
          value={summary.eloNet == null ? "—" : signed(summary.eloNet)}
        />
        <Stat
          divider
          label="LAST PLAYED"
          value={summary.lastPlayedIso ? shortDay(summary.lastPlayedIso) : "—"}
        />
      </View>
    </View>
  );
}

function Stat({ label, value, divider = false }: { label: string; value: string; divider?: boolean }) {
  return (
    <View style={[styles.stat, divider && styles.statDivider]}>
      <Text numberOfLines={1} style={styles.statValue}>{value}</Text>
      <Text numberOfLines={1} style={styles.statLabel}>{label}</Text>
    </View>
  );
}

function shortDay(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

const styles = StyleSheet.create({
  card: {
    marginHorizontal: Layout.screenGutter,
    marginTop: Space.lg,
    overflow: "hidden",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.borderLight,
    borderRadius: Radius.card,
    backgroundColor: Colors.surface,
  },
  series: {
    paddingHorizontal: Space.lg,
    paddingTop: Space.xl,
    flexDirection: "row",
    alignItems: "center",
    gap: Space.md,
  },
  sideScore: { minWidth: 34 },
  sideScoreRight: { alignItems: "flex-end" },
  sideLabel: {
    fontFamily: Typography.bodyBold,
    fontSize: 10,
    lineHeight: 13,
    letterSpacing: 1.6,
    color: Colors.textSecondary,
  },
  score: {
    fontFamily: Typography.headingBold,
    fontSize: 40,
    lineHeight: 48,
    color: Colors.text,
  },
  scoreTrailing: { color: Colors.mutedDark },
  center: { flex: 1, minWidth: 0, alignItems: "center" },
  centerLabel: {
    fontFamily: Typography.bodyBold,
    fontSize: 10,
    lineHeight: 13,
    letterSpacing: 1.6,
    color: Colors.muted,
  },
  headline: {
    marginTop: 4,
    fontFamily: Typography.heading,
    fontSize: 20,
    lineHeight: 26,
    letterSpacing: 0.6,
    color: Colors.text,
  },
  bar: {
    height: 6,
    marginHorizontal: Space.lg,
    marginTop: Space.lg,
    marginBottom: Space.xl,
    flexDirection: "row",
    gap: 4,
  },
  barMine: { borderRadius: 3, backgroundColor: Colors.text },
  barTheirs: { borderRadius: 3, backgroundColor: Colors.borderLight },
  stats: {
    flexDirection: "row",
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: Colors.border,
    backgroundColor: Colors.surfaceDark,
  },
  stat: { flex: 1, minWidth: 0, paddingHorizontal: Space.md, paddingVertical: Space.md },
  statDivider: { borderLeftWidth: StyleSheet.hairlineWidth, borderLeftColor: Colors.border },
  statValue: {
    fontFamily: Typography.headingBold,
    fontSize: 22,
    lineHeight: 28,
    color: Colors.text,
  },
  statLabel: {
    fontFamily: Typography.bodyBold,
    fontSize: 9,
    lineHeight: 12,
    letterSpacing: 1.2,
    color: Colors.muted,
  },
});
