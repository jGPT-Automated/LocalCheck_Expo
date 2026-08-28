export type MatchLifecycleStatus = "pending" | "held" | "confirmed" | "voided";

export function matchStatusCopy(status: MatchLifecycleStatus): {
  label: string;
  countdownLabel?: string;
  description: string;
} {
  switch (status) {
    case "pending":
      return {
        label: "REVIEW OPEN",
        countdownLabel: "AUTO-APPROVES IN",
        description: "Ratings update when the score is approved or the review window ends.",
      };
    case "held":
      return {
        label: "ON HOLD",
        countdownLabel: "RESOLVE WITHIN",
        description: "This result is paused and has not changed any rating.",
      };
    case "confirmed":
      return {
        label: "FINAL",
        description: "The score is approved and ratings are updated.",
      };
    case "voided":
      return {
        label: "VOID",
        description: "This game does not appear in records and never changes ratings.",
      };
  }
}

export function remainingTime(deadline: string | undefined, now = Date.now()) {
  const deadlineMs = deadline ? new Date(deadline).getTime() : Number.NaN;
  const totalSeconds = Number.isFinite(deadlineMs)
    ? Math.max(0, Math.ceil((deadlineMs - now) / 1000))
    : 0;
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return { days, hours, minutes, seconds, totalSeconds };
}

export function formatRemainingTime(deadline: string | undefined, now = Date.now()) {
  const remaining = remainingTime(deadline, now);
  if (remaining.days > 0) {
    return `${remaining.days}D ${String(remaining.hours).padStart(2, "0")}H ${String(remaining.minutes).padStart(2, "0")}M`;
  }
  return `${String(remaining.hours).padStart(2, "0")}H ${String(remaining.minutes).padStart(2, "0")}M ${String(remaining.seconds).padStart(2, "0")}S`;
}

