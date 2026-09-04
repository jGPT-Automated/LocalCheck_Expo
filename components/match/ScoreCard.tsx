import React from "react";
import { StyleSheet, Text, View } from "react-native";

import { Colors, Radius } from "@/constants/colors";
import { Layout, Space } from "@/constants/layout";
import { TextStyles } from "@/constants/typography";
import type { CourtSport } from "@/constants/data";

export type ScoreCardStatus =
  | "draft"
  | "pending"
  | "held"
  | "confirmed"
  | "voided";

const TONE: Record<
  ScoreCardStatus,
  { bg: string; border: string; text: string }
> = {
  draft: {
    bg: Colors.surfaceHigh,
    border: Colors.borderLight,
    text: Colors.textSecondary,
  },
  pending: {
    bg: Colors.accentDim,
    border: Colors.accentBorder,
    text: Colors.accent,
  },
  held: {
    bg: Colors.accentDim,
    border: Colors.accentBorder,
    text: Colors.accent,
  },
  confirmed: { bg: Colors.winDim, border: Colors.win, text: Colors.win },
  voided: {
    bg: Colors.surfaceHigh,
    border: Colors.borderLight,
    text: Colors.textSecondary,
  },
};

const STATUS_LABEL: Record<ScoreCardStatus, string> = {
  draft: "NOT SENT",
  pending: "IN REVIEW",
  held: "ON HOLD",
  confirmed: "FINAL",
  voided: "VOIDED",
};

function formatPlayedOn(value: string): string {
  const date =
    value.length === 10 ? new Date(`${value}T12:00:00`) : new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date
    .toLocaleDateString("en-US", { month: "short", day: "numeric" })
    .toUpperCase();
}

/**
 * The one score + status card. Log Game's review step, the Inbox, and the
 * FINAL SCORE screen all render this so a game looks the same everywhere it
 * appears. Callers map their own data onto these props; the card owns the
 * status tone, the score hierarchy, and the optional countdown above it.
 */
export function ScoreCard({
  status,
  courtName,
  sport,
  playedOn,
  leftLabel,
  rightLabel,
  leftScore,
  rightScore,
  note,
  countdown,
  rightMeta,
  compact = false,
}: {
  status: ScoreCardStatus;
  courtName: string;
  sport: CourtSport;
  playedOn: string;
  leftLabel: string;
  rightLabel: string;
  leftScore: number | string;
  rightScore: number | string;
  note?: string;
  countdown?: { label: string; value: string } | null;
  rightMeta?: string;
  compact?: boolean;
}) {
  const tone = TONE[status];
  return (
    <View style={styles.wrap}>
      {countdown ? (
        <View accessibilityLiveRegion="polite" style={styles.countdown}>
          <Text style={styles.countdownLabel}>{countdown.label}</Text>
          <Text style={styles.countdownValue}>{countdown.value}</Text>
        </View>
      ) : null}

      <View style={[styles.card, compact && styles.cardCompact]}>
        <View style={styles.metaRow}>
          <View
            style={[
              styles.badge,
              { backgroundColor: tone.bg, borderColor: tone.border },
            ]}
          >
            <Text style={[styles.badgeText, { color: tone.text }]}>
              {STATUS_LABEL[status]}
            </Text>
          </View>
          {rightMeta ? <Text style={styles.rightMeta}>{rightMeta}</Text> : null}
        </View>

        <Text numberOfLines={2} style={styles.court}>
          {courtName.toUpperCase()}
        </Text>
        <Text style={styles.detail}>
          {sport === "BASKETBALL" ? "BB" : "PB"} · {formatPlayedOn(playedOn)}
        </Text>

        <View style={[styles.scoreboard, compact && styles.scoreboardCompact]}>
          <View style={styles.side}>
            <Text numberOfLines={2} style={styles.sideName}>
              {leftLabel}
            </Text>
            <Text style={[styles.score, compact && styles.scoreCompact]}>
              {leftScore}
            </Text>
          </View>
          <Text style={[styles.divider, compact && styles.dividerCompact]}>
            –
          </Text>
          <View style={styles.side}>
            <Text numberOfLines={2} style={styles.sideName}>
              {rightLabel}
            </Text>
            <Text style={[styles.score, compact && styles.scoreCompact]}>
              {rightScore}
            </Text>
          </View>
        </View>

        {note ? <Text style={styles.note}>{note}</Text> : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    width: "100%",
    maxWidth: Layout.maxContentWidth,
    alignSelf: "center",
    gap: Space.lg,
  },
  countdown: { alignItems: "center", gap: Space.xs, paddingTop: Space.sm },
  countdownLabel: {
    ...TextStyles.labelSmall,
    color: Colors.textSecondary,
    letterSpacing: 1.8,
  },
  countdownValue: {
    ...TextStyles.display,
    color: Colors.text,
    fontVariant: ["tabular-nums"],
  },
  card: {
    gap: Space.sm,
    padding: Space.lg,
    borderWidth: 1,
    borderColor: Colors.borderLight,
    borderRadius: Radius.card,
    backgroundColor: Colors.surface,
  },
  cardCompact: { padding: Space.md, gap: Space.xs },
  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: Space.md,
  },
  badge: {
    minHeight: 26,
    justifyContent: "center",
    paddingHorizontal: 10,
    borderWidth: 1,
    borderRadius: 13,
  },
  badgeText: { ...TextStyles.labelSmall, letterSpacing: 1.2 },
  rightMeta: {
    ...TextStyles.labelSmall,
    color: Colors.textSecondary,
    letterSpacing: 1.1,
  },
  court: {
    ...TextStyles.title,
    color: Colors.text,
    marginTop: Space.xs,
  },
  detail: { ...TextStyles.metadata, color: Colors.textSecondary },
  scoreboard: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: Space.md,
    paddingVertical: Space.lg,
  },
  scoreboardCompact: { marginTop: Space.xs, paddingVertical: Space.sm },
  side: { flex: 1, minWidth: 0, alignItems: "center", gap: Space.sm },
  sideName: {
    ...TextStyles.label,
    minHeight: 32,
    color: Colors.textSecondary,
    textAlign: "center",
  },
  score: {
    ...TextStyles.displayLarge,
    fontSize: 60,
    lineHeight: 68,
    color: Colors.text,
    fontVariant: ["tabular-nums"],
  },
  scoreCompact: { fontSize: 34, lineHeight: 40 },
  divider: { ...TextStyles.title, color: Colors.mutedDark },
  dividerCompact: { ...TextStyles.body, color: Colors.mutedDark },
  note: {
    ...TextStyles.bodySmall,
    color: Colors.textSecondary,
    textAlign: "center",
  },
});
