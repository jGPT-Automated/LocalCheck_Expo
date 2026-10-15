import React from "react";
import { StyleSheet, Text, View } from "react-native";

import { PlayerAvatar } from "@/components/PlayerAvatar";
import { Colors, Radius } from "@/constants/colors";
import { Layout, Space } from "@/constants/layout";
import { TextStyles, Typography } from "@/constants/typography";
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
      <View accessibilityRole="header" style={styles.status}>
        <Text numberOfLines={1} style={styles.statusText}>
          {seriesStatus(summary)}
        </Text>
      </View>

      <View style={styles.scores}>
        <View style={styles.side}>
          <AvatarWithElo player={me} />
          <View style={styles.sideCopy}>
            <Text numberOfLines={1} style={styles.sideLabel}>
              YOU
            </Text>
            <Text numberOfLines={1} style={[styles.score, myTone]}>
              {summary.myWins}
            </Text>
          </View>
        </View>
        <View style={[styles.side, styles.sideRight]}>
          <View style={[styles.sideCopy, styles.sideCopyRight]}>
            <Text numberOfLines={1} style={[styles.sideLabel, styles.sideLabelRight]}>
              {firstName(them.name).toUpperCase()}
            </Text>
            <Text numberOfLines={1} style={[styles.score, theirTone]}>
              {summary.theirWins}
            </Text>
          </View>
          <AvatarWithElo player={them} />
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
          highlight={eloNet != null && eloNet > 0}
          label="NET ELO"
          value={eloNet == null ? "—" : signed(eloNet)}
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

/** The avatar box with that player's current ELO in quiet text beneath it. */
function AvatarWithElo({ player }: { player: Side }) {
  return (
    <View style={styles.avatarColumn}>
      <PlayerAvatar
        initials={player.initials}
        name={player.name}
        playerId={player.id}
        size={AVATAR}
      />
      {player.elo != null ? (
        <Text numberOfLines={1} style={styles.avatarElo}>
          {player.elo}
        </Text>
      ) : null}
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
      <Text numberOfLines={1} style={styles.statLabel}>
        {label}
      </Text>
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
  status: {
    paddingHorizontal: Space.lg,
    paddingTop: Space.lg,
    alignItems: "center",
  },
  statusText: {
    ...TextStyles.statSmall,
    letterSpacing: 0.6,
    textAlign: "center",
    color: Colors.text,
  },
  scores: {
    paddingHorizontal: Space.lg,
    paddingTop: Space.md,
    flexDirection: "row",
    alignItems: "flex-start",
    gap: Space.lg,
  },
  side: {
    flex: 1,
    flexBasis: 0,
    minWidth: 0,
    flexDirection: "row",
    alignItems: "flex-start",
    gap: Space.md,
  },
  sideRight: { justifyContent: "flex-end" },
  avatarColumn: { flexShrink: 0, alignItems: "center", gap: Space.xs },
  avatarElo: {
    ...TextStyles.metadata,
    fontVariant: ["tabular-nums"],
    color: Colors.muted,
  },
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
