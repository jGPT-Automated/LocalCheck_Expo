import React from "react";
import { StyleSheet, Text, View } from "react-native";

import { PlayerAvatar } from "@/components/PlayerAvatar";
import { Colors, Radius } from "@/constants/colors";
import { Layout, Space } from "@/constants/layout";
import { Typography } from "@/constants/typography";
import {
  firstName,
  type HeadToHeadSummary as Summary,
  seriesStatus,
  signed,
} from "@/lib/headToHead";

type Side = { id: string; name: string; initials?: string; elo?: number | null };

/**
 * The HEAD TO HEAD card on another player's profile: the series status
 * centred on top, both avatars (each with that player's ELO under it) beside
 * their records, a split bar, then your ELO net and last played.
 *
 * Built for long names and big numbers: each side is an equal-width column
 * whose name truncates on its own line, and the two stats are equal columns.
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
  const played = summary.games > 0;
  const share = played ? summary.myWins / summary.games : 0.5;
  const myLeads = summary.leader === "you";
  const theyLead = summary.leader === "them";
  const tied = summary.leader === "even" && played;
  // Leader orange, trailing side grey, a tie white, nothing played yet grey.
  const myTone = !played || theyLead ? styles.scoreTrailing : myLeads ? styles.scoreLeader : null;
  const theirTone = !played || myLeads ? styles.scoreTrailing : theyLead ? styles.scoreLeader : null;
  const eloNet = summary.eloNet;
  return (
    <View style={styles.card}>
      <View style={styles.scores}>
        <View style={styles.side}>
          <PlayerAvatar initials={me.initials} name={me.name} playerId={me.id} size={AVATAR} />
          <View style={styles.sideCopy}>
            <Text numberOfLines={1} style={styles.sideLabel}>You{me.elo != null ? ` · ${me.elo}` : ""}</Text>
            <Text numberOfLines={1} style={[styles.score, myTone]}>{summary.myWins}</Text>
          </View>
        </View>
        <View accessibilityRole="header" style={styles.status}>
          <Text adjustsFontSizeToFit minimumFontScale={0.8} numberOfLines={2} style={styles.statusText}>
            {seriesStatus(summary)}
          </Text>
        </View>
        <View style={[styles.side, styles.sideRight]}>
          <View style={[styles.sideCopy, styles.sideCopyRight]}>
            <Text numberOfLines={1} style={[styles.sideLabel, styles.sideLabelRight]}>
              {firstName(them.name)}{them.elo != null ? ` · ${them.elo}` : ""}
            </Text>
            <Text numberOfLines={1} style={[styles.score, theirTone]}>{summary.theirWins}</Text>
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
        <Text numberOfLines={1} style={styles.statLine}>
          Net ELO{" "}
          <Text style={[styles.statValue, eloNet != null && eloNet > 0 && styles.statValueHighlight]}>
            {eloNet == null ? "—" : signed(eloNet)}
          </Text>
        </Text>
        <Text numberOfLines={1} style={[styles.statLine, styles.statLineRight]}>
          Last played{" "}
          <Text style={styles.statValue}>{summary.lastPlayedIso ? shortDay(summary.lastPlayedIso) : "—"}</Text>
        </Text>
      </View>
    </View>
  );
}

function shortDay(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

const AVATAR = 38;

// Compact court-flow card (Oct 15): one row with the series status in the
// middle, a thin split bar, and one quiet line for net ELO and last played.
const styles = StyleSheet.create({
  card: {
    marginHorizontal: Layout.screenGutter,
    marginTop: Space.lg,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: Colors.hairlineCard,
    borderRadius: Radius.panel,
    backgroundColor: Colors.panel,
  },
  scores: {
    paddingHorizontal: Space.md,
    paddingTop: Space.md,
    flexDirection: "row",
    alignItems: "center",
    gap: Space.sm,
  },
  side: { flex: 1, flexBasis: 0, minWidth: 0, flexDirection: "row", alignItems: "center", gap: Space.sm },
  sideRight: { justifyContent: "flex-end" },
  sideCopy: { flexShrink: 1, minWidth: 0 },
  sideCopyRight: { alignItems: "flex-end" },
  sideLabel: { fontFamily: Typography.bodyBold, fontSize: 9, letterSpacing: 1.1, textTransform: "uppercase", color: Colors.textSecondary },
  sideLabelRight: { textAlign: "right" },
  score: { fontFamily: Typography.headingBold, fontSize: 32, lineHeight: 34, letterSpacing: -0.8, fontVariant: ["tabular-nums"], color: Colors.text },
  scoreLeader: { color: Colors.accent },
  scoreTrailing: { color: Colors.textSecondary },
  status: { width: 84, alignItems: "center" },
  statusText: { fontFamily: Typography.headingSemiBold, fontSize: 14, lineHeight: 16, letterSpacing: 0.3, textTransform: "uppercase", textAlign: "center", color: Colors.text },
  bar: { height: 4, marginHorizontal: Space.md, marginTop: Space.md, flexDirection: "row", gap: 3 },
  barSegment: { borderRadius: 2 },
  barLeading: { backgroundColor: Colors.accent },
  barNeutral: { backgroundColor: Colors.surfaceHigh },
  barTied: { backgroundColor: Colors.mutedDark },
  stats: {
    height: 36,
    marginTop: Space.md,
    paddingHorizontal: Space.md,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: Space.md,
    borderTopWidth: 1,
    borderTopColor: Colors.hairline,
  },
  statLine: { flexShrink: 1, fontFamily: Typography.bodyBold, fontSize: 9, letterSpacing: 1.1, textTransform: "uppercase", color: Colors.muted },
  statLineRight: { textAlign: "right" },
  statValue: { fontFamily: Typography.headingSemiBold, fontSize: 13, letterSpacing: 0, color: Colors.text, fontVariant: ["tabular-nums"] },
  statValueHighlight: { color: Colors.accent },
});
