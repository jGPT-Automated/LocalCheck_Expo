import React from "react";
import { StyleSheet, Text, View } from "react-native";

import { ShareLine } from "@/components/ui/ShareLine";
import { Colors, Radius } from "@/constants/colors";
import { Layout, Space } from "@/constants/layout";
import { TextStyles } from "@/constants/typography";
import {
  firstName,
  type HeadToHeadSummary as Summary,
  seriesStatus,
  signed,
} from "@/lib/headToHead";

/**
 * The HEAD TO HEAD card on another player's profile, built like the game
 * card: the series status centred on top, both names above their records, the
 * records at the two ends of one share line (the leader's side in orange),
 * then three equal stats.
 *
 * Built for long names and big numbers: names truncate on their own line, the
 * two name columns and the three stat columns are equal widths.
 */
export function HeadToHeadSummary({
  themName,
  summary,
}: {
  themName: string;
  summary: Summary;
}) {
  const played = summary.games > 0;
  const myLeads = summary.leader === "you";
  const theyLead = summary.leader === "them";
  const status = seriesStatus(summary, themName);
  // Leader (or a tie) white, trailing side grey, nothing played yet grey.
  const myTone = !played || theyLead ? styles.recordTrailing : styles.recordLeader;
  const theirTone = !played || myLeads ? styles.recordTrailing : styles.recordLeader;
  const eloNet = summary.eloNet;
  return (
    <View style={styles.card}>
      <View accessibilityRole="header" style={styles.status}>
        {status.name ? (
          <Text numberOfLines={1} style={[styles.statusText, styles.statusName]}>
            {status.name}
          </Text>
        ) : null}
        <Text
          numberOfLines={1}
          style={[styles.statusText, styles.statusFixed, !played && styles.statusQuiet]}
        >
          {status.text}
        </Text>
      </View>

      <View style={styles.names}>
        <Text numberOfLines={1} style={[styles.name, styles.nameLeft]}>
          YOU
        </Text>
        <Text numberOfLines={1} style={[styles.name, styles.nameRight]}>
          {firstName(themName).toUpperCase()}
        </Text>
      </View>

      <View style={styles.records}>
        <Text style={[styles.record, myTone]}>{summary.myWins}</Text>
        <View style={styles.line}>
          <ShareLine
            empty={!played}
            leader={myLeads ? "left" : theyLead ? "right" : null}
            leftShare={played ? summary.myWins / summary.games : 0.5}
          />
        </View>
        <Text style={[styles.record, theirTone]}>{summary.theirWins}</Text>
      </View>

      <View style={styles.stats}>
        <Stat
          label="AVG MARGIN"
          value={summary.avgMargin == null ? "—" : signed(summary.avgMargin)}
        />
        <Stat
          label="YOUR ELO NET"
          tone={eloNet != null && eloNet > 0 ? "up" : eloNet != null && eloNet < 0 ? "down" : undefined}
          value={eloNet == null ? "—" : signed(eloNet)}
        />
        <Stat
          label="LAST PLAYED"
          value={summary.lastPlayedIso ? shortDay(summary.lastPlayedIso) : "—"}
        />
      </View>
    </View>
  );
}

function Stat({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: "up" | "down";
}) {
  return (
    <View style={styles.stat}>
      <Text
        adjustsFontSizeToFit
        minimumFontScale={0.8}
        numberOfLines={1}
        style={[
          styles.statValue,
          tone === "up" && styles.statUp,
          tone === "down" && styles.statDown,
        ]}
      >
        {value}
      </Text>
      <Text numberOfLines={1} style={styles.statLabel}>
        {label}
      </Text>
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
  status: {
    paddingHorizontal: Space.lg,
    paddingTop: Space.lg,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: Space.xs,
  },
  statusText: {
    ...TextStyles.statSmall,
    letterSpacing: 0.6,
    color: Colors.text,
  },
  statusName: { flexShrink: 1, minWidth: 0 },
  statusFixed: { flexShrink: 0 },
  statusQuiet: { color: Colors.textSecondary },
  names: {
    paddingHorizontal: Space.lg,
    paddingTop: Space.lg,
    flexDirection: "row",
    gap: Space.lg,
  },
  name: {
    ...TextStyles.labelSmall,
    flex: 1,
    minWidth: 0,
    letterSpacing: 1.2,
    color: Colors.textSecondary,
  },
  nameLeft: { textAlign: "left" },
  nameRight: { textAlign: "right" },
  records: {
    paddingHorizontal: Space.lg,
    paddingBottom: Space.lg,
    flexDirection: "row",
    alignItems: "center",
    gap: Space.lg,
  },
  record: {
    ...TextStyles.displayLarge,
    flexShrink: 0,
    fontVariant: ["tabular-nums"],
  },
  recordLeader: { color: Colors.text },
  recordTrailing: { color: Colors.textSecondary },
  line: { flex: 1, minWidth: 0 },
  stats: {
    flexDirection: "row",
    paddingVertical: Space.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: Colors.border,
  },
  stat: {
    flex: 1,
    flexBasis: 0,
    minWidth: 0,
    alignItems: "center",
    paddingHorizontal: Space.sm,
  },
  statValue: {
    ...TextStyles.stat,
    fontVariant: ["tabular-nums"],
    textAlign: "center",
    color: Colors.text,
  },
  statUp: { color: Colors.win },
  statDown: { color: Colors.loss },
  statLabel: {
    ...TextStyles.labelSmall,
    marginTop: 2,
    textAlign: "center",
    letterSpacing: 1,
    color: Colors.muted,
  },
});
