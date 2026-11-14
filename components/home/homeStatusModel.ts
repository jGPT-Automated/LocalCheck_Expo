type Input = {
  now: number;
  activeCourtId: string | null;
  startedAt: string | null;
  pending: { courtId: string; postsAt: string } | null;
};
export type HomeCheckInStatus = {
  phase: "pending" | "active";
  label: string;
  clock: string | null;
  courtId: string;
};

function clock(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor(seconds / 60) % 60;
  const tail = `${minutes}:${String(seconds % 60).padStart(2, "0")}`;
  return hours
    ? `${hours}:${String(minutes).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`
    : tail;
}

export function homeCheckInStatus(input: Input): HomeCheckInStatus | null {
  if (input.pending && input.pending.courtId !== input.activeCourtId) {
    const deadline = Date.parse(input.pending.postsAt);
    if (Number.isFinite(deadline)) {
      const seconds = Math.max(0, Math.ceil((deadline - input.now) / 1000));
      return {
        phase: "pending",
        label: seconds ? "Posts in" : "Posting",
        clock: clock(seconds),
        courtId: input.pending.courtId,
      };
    }
  }
  if (!input.activeCourtId) return null;
  const start = input.startedAt ? Date.parse(input.startedAt) : NaN;
  return {
    phase: "active",
    label: "Checked in",
    clock: Number.isFinite(start)
      ? clock(Math.max(0, Math.floor((input.now - start) / 1000)))
      : null,
    courtId: input.activeCourtId,
  };
}
