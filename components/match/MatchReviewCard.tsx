import React from "react";
import { StyleSheet, Text, View } from "react-native";

import { Colors, Radius } from "@/constants/colors";
import { Layout, Space } from "@/constants/layout";
import { TextStyles } from "@/constants/typography";
import type { MatchReview } from "@/services/gameService";
import { formatRemainingTime, matchStatusCopy } from "@/services/matchReviewModel";

const STATUS_TONE = {
  pending: { background: Colors.accentDim, border: Colors.accentBorder, text: Colors.accent },
  held: { background: Colors.accentDim, border: Colors.accentBorder, text: Colors.accent },
  confirmed: { background: Colors.winDim, border: Colors.win, text: Colors.win },
  voided: { background: Colors.surfaceHigh, border: Colors.borderLight, text: Colors.textSecondary },
} as const;

export function MatchReviewCard({
  match,
  viewerId,
}: {
  match: MatchReview;
  viewerId?: string;
}) {
  const [now, setNow] = React.useState(Date.now());
  const copy = matchStatusCopy(match.status);
  const tone = STATUS_TONE[match.status];
  const deadline = match.status === "pending" ? match.reviewDueAt : match.resolutionDueAt;
  const viewerSide = match.participants.find((participant) => participant.id === viewerId)?.side;
  const sideA = match.participants.filter((participant) => participant.side === "a");
  const sideB = match.participants.filter((participant) => participant.side === "b");

  React.useEffect(() => {
    if (!deadline) return;
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [deadline]);

  const sideLabel = (side: typeof sideA, fallback: string) => {
    const label = side
      .map((participant) =>
        participant.id === viewerId ? "YOU" : participant.name.split(" ")[0].toUpperCase(),
      )
      .join(" · ");
    return label || fallback;
  };
  const firstSide = viewerSide === "b" ? sideB : sideA;
  const secondSide = viewerSide === "b" ? sideA : sideB;
  const firstScore = viewerSide === "b" ? match.scoreB : match.scoreA;
  const secondScore = viewerSide === "b" ? match.scoreA : match.scoreB;

  return (
    <View style={styles.wrap}>
      {deadline && copy.countdownLabel ? (
        <View accessibilityLiveRegion="polite" style={styles.countdown}>
          <Text style={styles.countdownLabel}>{copy.countdownLabel}</Text>
          <Text style={styles.countdownValue}>{formatRemainingTime(deadline, now)}</Text>
        </View>
      ) : null}

      <View style={styles.card}>
        <View style={styles.metaRow}>
          <View style={[styles.badge, { backgroundColor: tone.background, borderColor: tone.border }]}>
            <Text style={[styles.badgeText, { color: tone.text }]}>{copy.label}</Text>
          </View>
          {match.disputeCount > 0 ? (
            <Text style={styles.disputeCount}>DISPUTE {Math.min(match.disputeCount, 2)} OF 2</Text>
          ) : null}
        </View>

        <Text numberOfLines={2} style={styles.court}>{match.courtName}</Text>
        <Text style={styles.detail}>
          {match.sport === "BASKETBALL" ? "BB" : "PB"} · {new Date(match.playedAt).toLocaleDateString()}
        </Text>

        <View style={styles.scoreboard}>
          <View style={styles.side}>
            <Text numberOfLines={2} style={styles.sideName}>{sideLabel(firstSide, "SIDE A")}</Text>
            <Text style={styles.score}>{firstScore}</Text>
          </View>
          <Text style={styles.divider}>–</Text>
          <View style={styles.side}>
            <Text numberOfLines={2} style={styles.sideName}>{sideLabel(secondSide, "SIDE B")}</Text>
            <Text style={styles.score}>{secondScore}</Text>
          </View>
        </View>
        <Text style={styles.statusDescription}>{copy.description}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { width: "100%", maxWidth: Layout.maxContentWidth, alignSelf: "center", gap: Space.lg },
  countdown: { alignItems: "center", gap: Space.xs, paddingTop: Space.sm },
  countdownLabel: { ...TextStyles.labelSmall, color: Colors.textSecondary, letterSpacing: 1.8 },
  countdownValue: { ...TextStyles.display, color: Colors.text, fontVariant: ["tabular-nums"] },
  card: {
    gap: Space.sm,
    padding: Space.xl,
    borderWidth: 1,
    borderColor: Colors.borderLight,
    borderRadius: Radius.card,
    backgroundColor: Colors.surface,
  },
  metaRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: Space.md },
  badge: { minHeight: 28, justifyContent: "center", paddingHorizontal: 10, borderWidth: 1, borderRadius: 14 },
  badgeText: { ...TextStyles.labelSmall, letterSpacing: 1.2 },
  disputeCount: { ...TextStyles.labelSmall, color: Colors.textSecondary, letterSpacing: 1.1 },
  court: { ...TextStyles.title, color: Colors.text, marginTop: Space.sm, textTransform: "uppercase" },
  detail: { ...TextStyles.metadata, color: Colors.textSecondary },
  scoreboard: { flexDirection: "row", alignItems: "center", marginTop: Space.lg, paddingVertical: Space.lg },
  side: { flex: 1, minWidth: 0, alignItems: "center", gap: Space.sm },
  sideName: { ...TextStyles.label, minHeight: 32, color: Colors.textSecondary, textAlign: "center" },
  score: { ...TextStyles.displayLarge, fontSize: 52, lineHeight: 58, color: Colors.text, fontVariant: ["tabular-nums"] },
  divider: { ...TextStyles.title, color: Colors.mutedDark },
  statusDescription: { ...TextStyles.bodySmall, color: Colors.textSecondary, textAlign: "center" },
});
