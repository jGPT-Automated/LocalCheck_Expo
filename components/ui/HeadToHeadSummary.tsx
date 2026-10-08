import React from "react";
import { StyleSheet, Text, View } from "react-native";

import { PlayerAvatar } from "@/components/PlayerAvatar";
import { Colors, Radius } from "@/constants/colors";
import { Layout, Space } from "@/constants/layout";
import { TextStyles, Typography } from "@/constants/typography";
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
 *
 * Layout is built for long names and big numbers: the header is a label that
 * never shrinks beside a leader line whose name truncates; each score side is
 * an equal-width column whose name truncates; stats are equal-width columns.
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
  const tied = summary.leader === "even" && summary.games > 0;
  const leaderName = theyLead ? firstName(them.name).toUpperCase() : null;
  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <Text numberOfLines={1} style={styles.seriesLabel}>SERIES</Text>
        {summary.games === 0 ? (
          <Text numberOfLines={1} style={styles.headlineNeutral}>{seriesHeadline(summary, them.name)}</Text>
        ) : tied ? (
          <View style={styles.tiedPill}>
            <Text numberOfLines={1} style={styles.tiedText}>TIED</Text>
          </View>
        ) : (
          <View style={styles.leaderLine}>
            {leaderName ? (
              <Text numberOfLines={1} style={[styles.headline, styles.leaderName]}>{leaderName}</Text>
            ) : null}
            <Text numberOfLines={1} style={[styles.headline, styles.leaderVerb]}>
              {leaderName ? "LEADS" : "YOU LEAD"}
            </Text>
          </View>
        )}
      </View>

      <View style={styles.scores}>
        <View style={styles.side}>
          <PlayerAvatar initials={me.initials} name={me.name} playerId={me.id} size={AVATAR} />
          <View style={styles.sideCopy}>
            <Text numberOfLines={1} style={styles.sideLabel}>YOU</Text>
            <Text numberOfLines={1} style={[styles.score, myLeads && styles.scoreLeader, theyLead && styles.scoreTrailing]}>
              {summary.myWins}
            </Text>
          </View>
        </View>
        <View style={[styles.side, styles.sideRight]}>
          <View style={[styles.sideCopy, styles.sideCopyRight]}>
            <Text numberOfLines={1} style={[styles.sideLabel, styles.sideLabelRight]}>
              {firstName(them.name).toUpperCase()}
            </Text>
            <Text numberOfLines={1} style={[styles.score, theyLead && styles.scoreLeader, myLeads && styles.scoreTrailing]}>
              {summary.theirWins}
            </Text>
          </View>
          <PlayerAvatar initials={them.initials} name={them.name} playerId={them.id} size={AVATAR} />
        </View>
      </View>

      <View style={styles.bar}>
        <View
          style={[
            styles.barSegment,
            myLeads ? styles.barLeading : styles.barNeutral,
            tied && styles.barTied,
            { flex: Math.max(share, 0.001) },
          ]}
        />
        <View
          style={[
            styles.barSegment,
            theyLead ? styles.barLeading : styles.barNeutral,
            tied && styles.barTied,
            { flex: Math.max(1 - share, 0.001) },
          ]}
        />
      </View>

      <View style={styles.stats}>
        <Stat
          label="AVG MARGIN"
          value={summary.avgMargin == null ? "—" : signed(summary.avgMargin)}
        />
        <Stat
          divider
          highlight={summary.eloNet != null && summary.eloNet > 0}
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

function Stat({
  label,
  value,
  divider = false,
  highlight = false,
}: {
  label: string;
  value: string;
  divider?: boolean;
  highlight?: boolean;
}) {
  return (
    <View style={[styles.stat, divider && styles.statDivider]}>
      <Text
        adjustsFontSizeToFit
        minimumFontScale={0.8}
        numberOfLines={1}
        style={[styles.statValue, highlight && styles.statValueHighlight]}
      >
        {value}
      </Text>
      <Text numberOfLines={1} style={styles.statLabel}>{label}</Text>
    </View>
  );
}

function shortDay(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

const AVATAR = 46;

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
  header: {
    height: 32,
    paddingHorizontal: Space.lg,
    paddingTop: Space.lg,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: Space.md,
  },
  seriesLabel: {
    ...TextStyles.labelSmall,
    flexShrink: 0,
    letterSpacing: 1.6,
    color: Colors.muted,
  },
  leaderLine: { flex: 1, minWidth: 0, flexDirection: "row", justifyContent: "flex-end", gap: Space.xs },
  headline: {
    ...TextStyles.statSmall,
    letterSpacing: 0.6,
    color: Colors.accent,
  },
  leaderName: { flexShrink: 1, minWidth: 0 },
  leaderVerb: { flexShrink: 0 },
  headlineNeutral: {
    ...TextStyles.statSmall,
    flexShrink: 1,
    letterSpacing: 0.6,
    color: Colors.textSecondary,
  },
  tiedPill: {
    flexShrink: 0,
    paddingHorizontal: Space.md,
    paddingVertical: 2,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.borderLight,
    borderRadius: Radius.lg,
    backgroundColor: Colors.surfaceHigh,
  },
  tiedText: {
    ...TextStyles.statSmall,
    letterSpacing: 1.2,
    color: Colors.text,
  },
  scores: {
    paddingHorizontal: Space.lg,
    paddingTop: Space.md,
    flexDirection: "row",
    alignItems: "center",
    gap: Space.lg,
  },
  side: {
    flex: 1,
    minWidth: 0,
    flexDirection: "row",
    alignItems: "center",
    gap: Space.md,
  },
  sideRight: { justifyContent: "flex-end" },
  sideCopy: { flexShrink: 1, minWidth: 0 },
  sideCopyRight: { alignItems: "flex-end" },
  sideLabel: {
    ...TextStyles.labelSmall,
    fontFamily: Typography.bodyBold,
    letterSpacing: 1.2,
    color: Colors.textSecondary,
  },
  sideLabelRight: { textAlign: "right" },
  score: {
    ...TextStyles.displayLarge,
    fontFamily: Typography.headingBold,
    fontVariant: ["tabular-nums"],
    color: Colors.text,
  },
  scoreLeader: { color: Colors.accent },
  scoreTrailing: { color: Colors.textSecondary },
  bar: {
    height: 6,
    marginHorizontal: Space.lg,
    marginTop: Space.lg,
    marginBottom: Space.xl,
    flexDirection: "row",
    gap: 4,
  },
  barSegment: { borderRadius: 3 },
  barLeading: { backgroundColor: Colors.accent },
  barNeutral: { backgroundColor: Colors.borderLight },
  barTied: { backgroundColor: Colors.mutedDark },
  stats: {
    flexDirection: "row",
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: Colors.border,
    backgroundColor: Colors.surfaceDark,
  },
  stat: {
    flex: 1,
    flexBasis: 0,
    minWidth: 0,
    alignItems: "center",
    paddingHorizontal: Space.sm,
    paddingVertical: Space.md,
  },
  statDivider: { borderLeftWidth: StyleSheet.hairlineWidth, borderLeftColor: Colors.border },
  statValue: {
    ...TextStyles.stat,
    fontVariant: ["tabular-nums"],
    textAlign: "center",
    color: Colors.text,
  },
  statValueHighlight: { color: Colors.accent },
  statLabel: {
    ...TextStyles.labelSmall,
    marginTop: 2,
    textAlign: "center",
    letterSpacing: 1,
    color: Colors.muted,
  },
});
