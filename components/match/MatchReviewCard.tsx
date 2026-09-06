import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";

import { Colors } from "@/constants/colors";
import { Space } from "@/constants/layout";
import { TextStyles } from "@/constants/typography";
import type { MatchReview, MatchReviewParticipant } from "@/services/gameService";
import {
  formatRemainingTime,
  matchStatusCopy,
} from "@/services/matchReviewModel";

import { ScoreCard, scoreCardStatusLabel, scoreCardTone } from "./ScoreCard";

/** Badge text from the viewer's seat: whose move it is, not a raw status. */
function viewerStatusLabel(
  match: MatchReview,
  viewerId?: string,
): string | undefined {
  if (match.status === "confirmed") return "FINAL";
  if (match.status === "voided") return "VOIDED";
  const me = match.participants.find((p) => p.id === viewerId);
  if (match.status === "held") {
    return me?.decision === "disputed" ? "YOU DISPUTED" : "DISPUTED";
  }
  // pending
  if (!me) return undefined; // spectator — fall back to the generic label
  if (me.decision === "disputed") return "YOU DISPUTED";
  const other = match.participants.find(
    (p) => p.id !== viewerId && p.decision === "pending",
  );
  const otherName = other
    ? `WAITING ON ${other.name.split(" ")[0].toUpperCase()}`
    : "CONFIRMING…";
  // Whoever last submitted the score has, in effect, already approved it —
  // they never need to "approve their own game", so they see who they're
  // waiting on instead of a phantom "YOUR APPROVAL".
  if (viewerId && viewerId === match.lastSubmittedBy) return otherName;
  if (me.decision === "pending") return "YOUR APPROVAL";
  return otherName;
}

/**
 * Wrapper around the shared ScoreCard. In the Inbox (`compact`) the status
 * rides on the card. On the full FINAL SCORE screen the status, the review
 * timer and the policy explainer are screen furniture — they sit above the
 * card, which is then only the game itself.
 */
export function MatchReviewCard({
  match,
  viewerId,
  compact = false,
}: {
  match: MatchReview;
  viewerId?: string;
  compact?: boolean;
}) {
  const router = useRouter();
  const [now, setNow] = React.useState(Date.now());
  const copy = matchStatusCopy(match.status);
  const deadline =
    match.status === "pending" ? match.reviewDueAt : match.resolutionDueAt;

  React.useEffect(() => {
    if (!deadline) return;
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [deadline]);

  const viewerSide = match.participants.find(
    (participant) => participant.id === viewerId,
  )?.side;
  const sideA = match.participants.filter(
    (participant) => participant.side === "a",
  );
  const sideB = match.participants.filter(
    (participant) => participant.side === "b",
  );
  const confirmed = match.status === "confirmed";
  // One entry per player, each with its own ELO move (animated only on
  // confirm). Team games get a row per member instead of one aggregate.
  const sidePlayers = (side: MatchReviewParticipant[]) =>
    side.map((participant) => ({
      id: participant.id,
      name: participant.name,
      elo:
        confirmed &&
        participant.eloBefore != null &&
        participant.eloAfter != null
          ? { before: participant.eloBefore, after: participant.eloAfter }
          : null,
    }));

  const firstSide = viewerSide === "b" ? sideB : sideA;
  const secondSide = viewerSide === "b" ? sideA : sideB;
  const firstScore = viewerSide === "b" ? match.scoreB : match.scoreA;
  const secondScore = viewerSide === "b" ? match.scoreA : match.scoreB;
  const remaining =
    deadline && copy.countdownLabel
      ? formatRemainingTime(deadline, now)
      : null;
  const statusText =
    viewerStatusLabel(match, viewerId) ?? scoreCardStatusLabel(match.status);
  const tone = scoreCardTone(match.status);

  const firstIsMine = viewerSide != null;
  const card = (
    <ScoreCard
      compact={compact}
      courtName={match.courtName}
      format={`${match.teamSize}V${match.teamSize}`}
      leftLabel={firstIsMine ? "YOUR TEAM" : "TEAM A"}
      leftPlayers={sidePlayers(firstSide)}
      leftScore={firstScore}
      note={
        compact && remaining
          ? `${copy.countdownLabel} · ${remaining}`
          : compact
            ? copy.description
            : undefined
      }
      onPlayerPress={(id) => router.push(`/player/${id}`)}
      playedOn={match.playedAt}
      rightLabel={firstIsMine ? "OTHER TEAM" : "TEAM B"}
      rightPlayers={sidePlayers(secondSide)}
      rightMeta={
        match.disputeCount > 0
          ? `DISPUTE ${Math.min(match.disputeCount, 2)} OF 2`
          : undefined
      }
      rightScore={secondScore}
      status={match.status}
      statusLabel={statusText}
      statusPlacement={compact ? "card" : "none"}
    />
  );

  if (compact) return card;

  return (
    <View style={styles.wrap}>
      <View style={styles.header}>
        <View
          style={[
            styles.statusBar,
            { backgroundColor: tone.bg, borderColor: tone.border },
          ]}
        >
          <Text style={[styles.statusBarText, { color: tone.text }]}>
            {statusText}
          </Text>
        </View>
        {remaining && copy.countdownLabel ? (
          <View accessibilityLiveRegion="polite" style={styles.timer}>
            <Text style={styles.timerLabel}>{copy.countdownLabel}</Text>
            <Text style={styles.timerValue}>{remaining}</Text>
          </View>
        ) : null}
        {copy.description ? (
          <Text style={styles.explainer}>{copy.description}</Text>
        ) : null}
      </View>
      {card}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: Space.lg },
  header: { alignItems: "center", gap: Space.md },
  statusBar: {
    alignSelf: "stretch",
    paddingVertical: 10,
    alignItems: "center",
    borderWidth: 1,
    borderRadius: 8,
  },
  statusBarText: { ...TextStyles.label, letterSpacing: 2 },
  timer: { alignItems: "center", gap: 2 },
  timerLabel: {
    ...TextStyles.labelSmall,
    color: Colors.textSecondary,
    letterSpacing: 1.6,
  },
  timerValue: {
    ...TextStyles.display,
    color: Colors.text,
    fontVariant: ["tabular-nums"],
  },
  explainer: {
    ...TextStyles.bodySmall,
    color: Colors.muted,
    textAlign: "center",
  },
});
