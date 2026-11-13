// Normalize known legacy headings without changing player names or message bodies.
const HEADINGS: Record<string, string> = {
  "MATCH CONFIRMED": "Match confirmed",
  "NEW CHALLENGE": "New challenge",
  "CONFIRM FINAL SCORE": "Confirm final score",
  "FRIEND REQUEST": "Friend request",
  "FRIEND ACCEPTED": "Friend request accepted",
  "RUN INVITE": "Game invitation",
  "MATCH REJECTED": "Score disputed",
  "Check-in posted": "Checked in",
  "Auto checked out": "Checked out",
};
export function notificationHeading(title: string): string { return HEADINGS[title] ?? title; }
export function notificationTimestamp(value: string): string {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return "";
  return date.toLocaleString(undefined, { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" });
}
