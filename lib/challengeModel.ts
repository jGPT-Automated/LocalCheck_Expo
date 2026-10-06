/**
 * Challenge a player: pure rules for what each player sees and can do.
 * Backend: public.challenges + create_challenge / respond_to_challenge /
 * cancel_challenge / log_challenge_result (migration 20261006120000).
 */

export type ChallengeStatus = "pending" | "accepted" | "declined" | "cancelled" | "completed";

export type ChallengePlayer = { id: string; name: string; initials?: string };

export type Challenge = {
  id: string;
  challenger: ChallengePlayer;
  opponent: ChallengePlayer;
  courtId: string | null;
  courtName: string | null;
  sport: "BASKETBALL" | "PICKLEBALL" | null;
  playOn: string | null; // YYYY-MM-DD
  ranked: boolean;
  status: ChallengeStatus;
  matchId: string | null;
  cancelledBy: string | null;
  createdAt: string;
};

export type ChallengeAction = "accept_decline" | "waiting" | "log_score" | "view_game" | "closed";

export function isOpen(status: ChallengeStatus): boolean {
  return status === "pending" || status === "accepted";
}

/** The other player, from the viewer's side. */
export function otherPlayer(challenge: Challenge, viewerId: string): ChallengePlayer {
  return challenge.challenger.id === viewerId ? challenge.opponent : challenge.challenger;
}

export function challengeAction(challenge: Challenge, viewerId: string): ChallengeAction {
  switch (challenge.status) {
    case "pending":
      return challenge.opponent.id === viewerId ? "accept_decline" : "waiting";
    case "accepted":
      return "log_score";
    case "completed":
      return challenge.matchId ? "view_game" : "closed";
    default:
      return "closed";
  }
}

/** Short status line for cards and the inbox. */
export function challengeStatusLine(challenge: Challenge, viewerId: string): string {
  const other = firstName(otherPlayer(challenge, viewerId).name);
  switch (challenge.status) {
    case "pending":
      return challenge.opponent.id === viewerId
        ? `${firstName(challenge.challenger.name)} challenged you`
        : `Waiting on ${other}`;
    case "accepted":
      return `Game on with ${other}`;
    case "completed":
      return "Score logged";
    case "declined":
      return challenge.opponent.id === viewerId ? "You passed" : `${other} passed`;
    case "cancelled":
      return challenge.cancelledBy === viewerId ? "You called it off" : `${other} called it off`;
  }
}

/** "Rancho Cienega · Today", "Any court · Sat, Oct 10", "Any court · Any day". */
export function challengePlaceLine(
  challenge: Pick<Challenge, "courtName" | "playOn">,
  today: Date = new Date(),
): string {
  return `${challenge.courtName || "Any court"} · ${dayLabel(challenge.playOn, today)}`;
}

export function dayLabel(playOn: string | null, today: Date = new Date()): string {
  if (!playOn) return "Any day";
  const todayValue = localDateValue(today);
  const tomorrow = new Date(today);
  tomorrow.setDate(today.getDate() + 1);
  if (playOn === todayValue) return "Today";
  if (playOn === localDateValue(tomorrow)) return "Tomorrow";
  const [y, m, d] = playOn.split("-").map(Number);
  return new Date(y, m - 1, d, 12).toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

export function localDateValue(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/** The next `count` days starting today, as YYYY-MM-DD. */
export function upcomingDays(count: number, today: Date = new Date()): string[] {
  return Array.from({ length: count }, (_, i) => {
    const d = new Date(today);
    d.setHours(12, 0, 0, 0);
    d.setDate(d.getDate() + i);
    return localDateValue(d);
  });
}

export function firstName(name: string): string {
  return name.trim().split(/\s+/)[0] || name;
}

/** Server errors carry plain sentences for the cases a player can hit. */
export function challengeErrorMessage(error: { code?: string | null; message?: string | null } | null): string {
  if (!error) return "Something went wrong. Try again.";
  if (error.code === "42P01" || error.code === "PGRST202" || error.code === "PGRST205") {
    return "Challenges aren't switched on yet.";
  }
  if (error.code && /^LC1\d\d$/.test(error.code) && error.message) return error.message;
  if (error.message?.includes("blocked")) return "You can't challenge this player.";
  if (error.message?.includes("scores must be")) return "Scores can't be negative or tied.";
  return "Something went wrong. Try again.";
}

/** Score entry check before calling the server. */
export function scoreError(mine: string, theirs: string): string | null {
  const a = Number(mine);
  const b = Number(theirs);
  if (mine.trim() === "" || theirs.trim() === "") return "Enter both scores.";
  if (!Number.isInteger(a) || !Number.isInteger(b) || a < 0 || b < 0) return "Scores are whole numbers.";
  if (a === b) return "Games can't end in a tie.";
  if (a > 200 || b > 200) return "That score looks too high.";
  return null;
}
