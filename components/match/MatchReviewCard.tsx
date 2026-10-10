import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";

import { Colors } from "@/constants/colors";
import { Space } from "@/constants/layout";
import { TextStyles } from "@/constants/typography";
import type { MatchReview, MatchReviewParticipant } from "@/services/gameService";
import { matchStatusCopy } from "@/services/matchReviewModel";

import { scoresHiddenFor } from "@/lib/scoreVisibility";
import { countdownText, shortFirstName, waitingBannerLabel } from "./gameCardModel";
import { ScoreCard, scoreCardStatusLabel } from "./ScoreCard";

/** The countdown only shows minutes, so a slow tick is plenty. */
const COUNTDOWN_TICK_MS = 30_000;

/** Banner text from the viewer's seat: whose move it is, not a raw status. */
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
  if (!me) return undefined; // spectator: fall back to the generic label
  if (me.decision === "disputed") return "YOU DISPUTED";
  const other = match.participants.find(
    (p) => p.id !== viewerId && p.decision === "pending",
  );
  const otherName = other ? waitingBannerLabel(other.name) : "CONFIRMING…";
  // Whoever last submitted the score has, in effect, already approved it:
  // they never need to "approve their own game", so they see who they're
  // waiting on instead of a phantom "WAITING ON YOU".
  if (viewerId && viewerId === match.lastSubmittedBy) return otherName;
  if (me.decision === "pending") return "WAITING ON YOU";
  return otherName;
}

/** Whether this card is the viewer's move to make ("action": accent banner)
 *  or is just pending someone else ("waiting": neutral). Mirrors
 *  viewerStatusLabel: "WAITING ON YOU" only ever pairs with "action". */
function viewerEmphasis(
  match: MatchReview,
  viewerId?: string,
): "action" | "waiting" | undefined {
  if (match.status !== "pending") return undefined;
  const me = match.participants.find((p) => p.id === viewerId);
  if (!me || me.decision !== "pending") return "waiting";
  if (viewerId && viewerId === match.lastSubmittedBy) return "waiting";
  return "action";
}

/**
 * Wrapper around the shared ScoreCard for a real game. The state of the game
 * is the banner on the card, in the Inbox and on the Final Score screen alike;
 * the short line under the scores is the countdown while it is still open.
 * Confirmed games carry no explainer.
 */
export function MatchReviewCard({
  match,
  viewerId,
  compact = false,
  viewerHideScore,
}: {
  match: MatchReview;
  viewerId?: string;
  compact?: boolean;
  /** The viewer's Hide score switch while their change is saving, so the
   *  numbers flip to W / L the moment they tap it. */
  viewerHideScore?: boolean;
}) {
  const router = useRouter();
  const [now, setNow] = React.useState(Date.now());
  const copy = matchStatusCopy(match.status);
  const deadline =
    match.status === "pending" ? match.reviewDueAt : match.resolutionDueAt;

  React.useEffect(() => {
    if (!deadline) return;
    const timer = setInterval(() => setNow(Date.now()), COUNTDOWN_TICK_MS);
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
  // One entry per player, each with its own ELO move (shown only once the
  // game is confirmed). Team games get a tile per member.
  const sidePlayers = (side: MatchReviewParticipant[]) =>
    side.map((participant) => ({
      id: participant.id,
      name: participant.name,
      elo:
        confirmed &&
        match.isRanked &&
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
    deadline && copy.countdownLabel ? countdownText(deadline, now) : null;
  const statusText =
    viewerStatusLabel(match, viewerId) ?? scoreCardStatusLabel(match.status);

  // A revision the *other* player made: the number on the card isn't the one
  // this viewer entered. `revisionNumber > 0` means the score has been edited
  // at least once since it was first logged.
  const reviser =
    match.revisionNumber > 0
      ? match.participants.find((p) => p.id === match.lastSubmittedBy)
      : undefined;
  const revisedByOther = reviser != null && reviser.id !== viewerId;
  const reviserName = reviser ? shortFirstName(reviser.name) : "";

  // Ranked is the default and never written; only a casual game says so.
  const caption = [match.isRanked ? null : "CASUAL"].filter(Boolean).join(" · ");
  const extras = [
    match.disputeCount > 0
      ? `Dispute ${Math.min(match.disputeCount, 2)} of 2`
      : null,
    match.disputeNote && revisedByOther
      ? `${reviserName} added a note`
      : revisedByOther
        ? `Revised by ${reviserName}`
        : null,
  ].filter(Boolean);

  // What the countdown means, in the viewer's words. Nothing for a settled
  // game: the banner already says FINAL.
  const note =
    remaining && match.status === "pending"
      ? `Auto-approves in ${remaining}`
      : remaining && match.status === "held"
        ? `Resolve within ${remaining}`
        : undefined;

  const card = (
    <ScoreCard
      compact={compact}
      courtName={match.courtName}
      emphasis={viewerEmphasis(match, viewerId)}
      footnote={!compact && extras.length > 0 ? extras.join(" · ") : undefined}
      format={`${match.teamSize}V${match.teamSize}`}
      leftLabel="YOUR TEAM"
      leftPlayers={sidePlayers(firstSide)}
      leftScore={firstScore}
      note={note}
      onPlayerPress={(id) => router.push(`/player/${id}`)}
      playedOn={match.playedAt}
      rightLabel="OTHER TEAM"
      rightMeta={
        compact
          ? [caption || null, ...extras.map((extra) => extra?.toUpperCase())]
              .filter(Boolean)
              .join(" · ") || undefined
          : caption || undefined
      }
      rightPlayers={sidePlayers(secondSide)}
      rightScore={secondScore}
      scoresHidden={scoresHiddenFor(
        match.participants.map((p) => ({
          userId: p.id,
          hideScore: p.id === viewerId && viewerHideScore != null ? viewerHideScore : p.hideScore,
        })),
        viewerId,
        match.status,
      )}
      status={match.status}
      statusLabel={statusText}
    />
  );

  if (compact) return card;

  return (
    <View style={styles.wrap}>
      {card}
      {match.disputeNote ? (
        <View style={styles.disputeNote}>
          <Text style={styles.disputeNoteLabel}>
            {revisedByOther && reviser
              ? `${reviserName.toUpperCase()} SAYS`
              : "DISPUTE NOTE"}
          </Text>
          <Text style={styles.disputeNoteText}>{match.disputeNote}</Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: Space.lg },
  disputeNote: {
    gap: 3,
    paddingVertical: Space.sm,
    paddingHorizontal: Space.md,
    borderLeftWidth: 2,
    borderLeftColor: Colors.borderLight,
    backgroundColor: Colors.surfaceHigh,
    borderRadius: 6,
  },
  disputeNoteLabel: {
    ...TextStyles.labelSmall,
    color: Colors.textSecondary,
    letterSpacing: 1.4,
  },
  disputeNoteText: {
    ...TextStyles.bodySmall,
    color: Colors.text,
  },
});
