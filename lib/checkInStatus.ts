/**
 * What the header says while you are checked in: how long, and who can see it.
 * Pure, so it is tested.
 */
export type CheckInVisibility = "public" | "friends" | "private";

const VISIBILITY_LABELS: Record<CheckInVisibility, string> = {
  public: "PUBLIC",
  friends: "FRIENDS",
  private: "PRIVATE",
};

export function checkInVisibilityLabel(visibility: CheckInVisibility): string {
  return VISIBILITY_LABELS[visibility] ?? VISIBILITY_LABELS.public;
}

/** Time since the check-in started: "4:07" under an hour, "1:04:07" after. */
export function formatCheckInElapsed(startedAtIso: string, nowMs: number): string {
  const started = Date.parse(startedAtIso);
  if (!Number.isFinite(started)) return "0:00";
  const total = Math.max(0, Math.floor((nowMs - started) / 1000));
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const seconds = total % 60;
  const pad = (value: number) => String(value).padStart(2, "0");
  return hours > 0 ? `${hours}:${pad(minutes)}:${pad(seconds)}` : `${minutes}:${pad(seconds)}`;
}
