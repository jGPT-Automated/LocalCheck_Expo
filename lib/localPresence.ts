/**
 * Shared "how recently was this player here" presentation for every roster
 * surface (Home's LOCALS tab, court/[id]'s LOCALS tab, and the Explore court
 * preview drawer) so a local reads the same way regardless of entry point.
 */
export function relativeTime(value: string): string {
  const elapsed = Date.now() - new Date(value).getTime();
  if (!Number.isFinite(elapsed) || elapsed < 0) return "recently";
  const minutes = Math.floor(elapsed / 60_000);
  if (minutes < 60) return minutes <= 1 ? "just now" : `${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} hr${hours === 1 ? "" : "s"} ago`;
  const days = Math.floor(hours / 24);
  return `${days} day${days === 1 ? "" : "s"} ago`;
}

export function isInactiveLocal(value: string | null): boolean {
  if (!value) return true;
  return Date.now() - new Date(value).getTime() > 90 * 86_400_000;
}
