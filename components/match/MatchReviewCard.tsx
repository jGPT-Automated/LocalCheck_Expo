import React from "react";

import type { MatchReview } from "@/services/gameService";
import {
  formatRemainingTime,
  matchStatusCopy,
} from "@/services/matchReviewModel";

import { ScoreCard } from "./ScoreCard";

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
  const sideLabel = (side: typeof sideA, fallback: string) =>
    side
      .map((participant) =>
        participant.id === viewerId
          ? "YOU"
          : participant.name.split(" ")[0].toUpperCase(),
      )
      .join(" · ") || fallback;
  // A before/after ELO transition only reads cleanly for a single player per
  // side; team sides skip it rather than showing a misleading aggregate.
  const sideElo = (side: typeof sideA) => {
    if (side.length !== 1) return null;
    const { eloBefore, eloAfter } = side[0];
    return eloBefore != null && eloAfter != null ? { before: eloBefore, after: eloAfter } : null;
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
      leftElo={sideElo(firstSide)}
      leftLabel={sideLabel(firstSide, "SIDE A")}
      leftScore={firstScore}
      note={
        compact && remaining
          ? `${copy.countdownLabel} · ${remaining}`
          : copy.description
      }
      playedOn={match.playedAt}
      rightElo={sideElo(secondSide)}
      rightLabel={sideLabel(secondSide, "SIDE B")}
      rightMeta={
        match.disputeCount > 0
          ? `DISPUTE ${Math.min(match.disputeCount, 2)} OF 2`
          : undefined
      }
      rightScore={secondScore}
      sport={match.sport}
      status={match.status}
    />
  );
}
