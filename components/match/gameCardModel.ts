/**
 * Pure presentation rules for the game card (ScoreCard, MatchReviewCard).
 * Kept free of React so the copy and the numbers behind the card are tested.
 */

export type GameBannerKind = "action" | "waiting" | "final" | "held" | "voided";

/** Longest first name written into a banner or a caption before it truncates. */
export const MAX_INLINE_NAME = 12;

/** First word of a name, cut with an ellipsis when it is too long to sit in a
 *  line of copy ("MAXIMILIANO_RODRIGUEZ_JR" -> "MAXIMILIANO_…"). */
export function shortFirstName(name: string, max = MAX_INLINE_NAME): string {
  const first = name.trim().split(/\s+/)[0] ?? "";
  return first.length > max ? `${first.slice(0, max - 1)}…` : first;
}

/**
 * Banner text for a game waiting on someone else. A long name never goes into
 * the sentence: past MAX_INLINE_NAME the banner says "THEM" and the name
 * stays on its own line in the card.
 */
export function waitingBannerLabel(name: string | undefined): string {
  const first = name?.trim().split(/\s+/)[0] ?? "";
  if (!first || first.length > MAX_INLINE_NAME) return "WAITING ON THEM";
  return `WAITING ON ${first.toUpperCase()}`;
}

/** Which banner treatment a game wears. `emphasis` is the viewer's seat. */
export function gameBannerKind(
  status: "draft" | "pending" | "held" | "confirmed" | "voided",
  emphasis?: "action" | "waiting",
): GameBannerKind {
  if (status === "confirmed") return "final";
  if (status === "voided") return "voided";
  if (status === "held") return "held";
  if (emphasis === "action") return "action";
  return "waiting";
}

/** "SEP 6" for the card caption; falls back to the raw text when unparseable. */
export function formatCardDate(value: string): string {
  const date =
    value.length === 10 ? new Date(`${value}T12:00:00`) : new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date
    .toLocaleDateString("en-US", { month: "short", day: "numeric" })
    .toUpperCase();
}

/**
 * What trails the state in the banner: the date, then any extra tag
 * ("SEP 6", "SEP 6 · CASUAL"). The banner reads "FINAL · SEP 6".
 */
export function bannerTrailing(playedOn: string, meta?: string): string {
  return [formatCardDate(playedOn), meta].filter(Boolean).join(" · ");
}

/** The banner as one line of text: "FINAL · SEP 6". */
export function bannerText(label: string, trailing?: string): string {
  return trailing ? `${label} · ${trailing}` : label;
}

/** "2V2 AT RANCHO" - the card title. Format-less cards just show the court. */
export function cardTitle(format: string | undefined, courtName: string): string {
  const court = courtName.trim().toUpperCase();
  if (!court) return format?.toUpperCase() ?? "";
  return format ? `${format.toUpperCase()} AT ${court}` : court;
}

/**
 * Where the margin line splits: the share of the points the left side scored,
 * and who leads. `null` when there is nothing to draw (no numbers, 0-0).
 */
export function marginSplit(
  leftScore: number | string,
  rightScore: number | string,
): { share: number; leader: "left" | "right" | null } | null {
  const left = Number(leftScore);
  const right = Number(rightScore);
  if (!Number.isFinite(left) || !Number.isFinite(right)) return null;
  const total = left + right;
  if (total <= 0) return null;
  return {
    share: left / total,
    leader: left === right ? null : left > right ? "left" : "right",
  };
}

/** Rating move for one player, or null when they have none. */
export function eloDelta(
  elo: { before: number; after: number } | null | undefined,
): number | null {
  return elo ? elo.after - elo.before : null;
}

/** One rating move for a whole side (the average, rounded), or null unless
 *  every player on it has one. Used by the compact card's single line. */
export function sideEloDelta(
  players: Array<{ elo?: { before: number; after: number } | null }>,
): number | null {
  if (players.length === 0) return null;
  const deltas = players.map((player) => eloDelta(player.elo));
  if (deltas.some((delta) => delta == null)) return null;
  const sum = (deltas as number[]).reduce((total, delta) => total + delta, 0);
  return Math.round(sum / deltas.length);
}

/**
 * "23h 59m" / "4d 23h" / "12m". Minutes are the finest unit: the card is not
 * a stopwatch, so it needs no tick every second. Null once the time is up.
 */
export function countdownText(
  deadline: string | undefined,
  now: number = Date.now(),
): string | null {
  const ms = deadline ? new Date(deadline).getTime() : Number.NaN;
  if (!Number.isFinite(ms)) return null;
  const totalMinutes = Math.max(0, Math.ceil((ms - now) / 60_000));
  if (totalMinutes <= 0) return null;
  const days = Math.floor(totalMinutes / 1440);
  const hours = Math.floor((totalMinutes % 1440) / 60);
  const minutes = totalMinutes % 60;
  if (days > 0) return hours > 0 ? `${days}d ${hours}h` : `${days}d`;
  if (hours > 0) return minutes > 0 ? `${hours}h ${minutes}m` : `${hours}h`;
  return `${minutes}m`;
}
