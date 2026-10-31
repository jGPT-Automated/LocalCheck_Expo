import type { GameRun } from "@/constants/data";

/** The next game's start for a court's numbers strip: "Now", "7PM" today, else "SAT". */
export function nextGameLabel(run: GameRun | undefined, now: number): string {
  if (!run) return "—";
  const start = new Date(run.startTimeIso);
  if (start.getTime() <= now) return "Now";
  if (start.toDateString() !== new Date(now).toDateString()) {
    return start.toLocaleDateString("en-US", { weekday: "short" }).toUpperCase();
  }
  const hour = start.getHours();
  return `${hour % 12 || 12}${hour < 12 ? "AM" : "PM"}`;
}
