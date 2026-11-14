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

const AUDIENCES = {
  private: { icon: "lock", label: "Private · Only you" },
  friends: { icon: "users", label: "Friends" },
  public: { icon: "globe", label: "Public" },
} as const;

/** Event snapshots only. An incoming friend's alert does not describe the viewer's own audience. */
export function notificationEventMetadata(item: {
  type: string;
  source: "manual" | "auto" | null;
  visibility: "private" | "friends" | "public" | null;
}) {
  const own = ["auto_check_in", "auto_check_out", "manual_check_in", "manual_check_out"].includes(item.type);
  return {
    audience: own && item.visibility ? AUDIENCES[item.visibility] : null,
    sourceLabel: own ? item.source === "auto" ? "Automatic" : item.source === "manual" || item.type.startsWith("manual_") ? "Manual" : null : null,
  };
}
