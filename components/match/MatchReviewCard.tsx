import React from "react";

import type { MatchReview, MatchReviewParticipant } from "@/services/gameService";
import {
  formatRemainingTime,
  matchStatusCopy,
} from "@/services/matchReviewModel";

import { ScoreCard, type ScoreCardRole } from "./ScoreCard";

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
  if (me.decision === "pending") return "YOUR APPROVAL";
  if (me.decision === "disputed") return "YOU DISPUTED";
  const waitingOn = match.participants.find(
    (p) => p.id !== viewerId && p.decision === "pending",
  );
  return waitingOn
    ? `WAITING ON ${waitingOn.name.split(" ")[0].toUpperCase()}`
    : "WAITING ON REVIEW";
}

/**
 * FINAL SCORE screen wrapper around the shared ScoreCard: it resolves the
 * viewer's side, the live countdown, and the policy copy, then hands plain
 * props to the card so the game reads identically here, in the Inbox, and in
 * Log Game's review step.
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
  // Real names here — the YOU / OPPONENT distinction is carried by the role
  // label, so a "YOU" name on top of a "YOU" role just read as "YOU YOU".
  const sideLabel = (side: MatchReviewParticipant[], fallback: string) =>
    side
      .map((participant) => participant.name.split(" ")[0].toUpperCase())
      .join(" · ") || fallback;
  const sideAvatars = (side: MatchReviewParticipant[]) =>
    side.map((participant) => ({ id: participant.id, name: participant.name }));
  const sideRole = (side: MatchReviewParticipant[]): ScoreCardRole => {
    if (!viewerId || !viewerSide) return null;
    return side.some((participant) => participant.id === viewerId)
      ? "you"
      : "opponent";
  };
  // A before/after ELO transition only reads cleanly for a single player per
  // side; team sides skip it rather than showing a misleading aggregate.
  const sideElo = (side: MatchReviewParticipant[]) => {
    if (side.length !== 1) return null;
    const { eloBefore, eloAfter } = side[0];
    return eloBefore != null && eloAfter != null
      ? { before: eloBefore, after: eloAfter }
      : null;
  };

  const firstSide = viewerSide === "b" ? sideB : sideA;
  const secondSide = viewerSide === "b" ? sideA : sideB;
  const firstScore = viewerSide === "b" ? match.scoreB : match.scoreA;
  const secondScore = viewerSide === "b" ? match.scoreA : match.scoreB;
  const remaining =
    deadline && copy.countdownLabel
      ? formatRemainingTime(deadline, now)
      : null;

  return (
    <ScoreCard
      compact={compact}
      countdown={
        !compact && remaining
          ? { label: copy.countdownLabel as string, value: remaining }
          : null
      }
      courtName={match.courtName}
      leftAvatars={sideAvatars(firstSide)}
      leftElo={sideElo(firstSide)}
      leftLabel={sideLabel(firstSide, "SIDE A")}
      leftRole={sideRole(firstSide)}
      leftScore={firstScore}
      note={
        compact && remaining
          ? `${copy.countdownLabel} · ${remaining}`
          : copy.description
      }
      playedOn={match.playedAt}
      rightAvatars={sideAvatars(secondSide)}
      rightElo={sideElo(secondSide)}
      rightLabel={sideLabel(secondSide, "SIDE B")}
      rightRole={sideRole(secondSide)}
      rightMeta={
        match.disputeCount > 0
          ? `DISPUTE ${Math.min(match.disputeCount, 2)} OF 2`
          : undefined
      }
      rightScore={secondScore}
      sport={match.sport}
      status={match.status}
      statusLabel={viewerStatusLabel(match, viewerId)}
    />
  );
}
