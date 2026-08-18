import type {
  CourtSport,
  FeedItem,
  FeedMatchParticipant,
  GameRun,
} from "../../constants/data";

type RunIdentityInput = Pick<GameRun, "maxPlayers" | "skillLevel" | "sport">;
type ActivityCopyInput = Pick<
  FeedItem,
  "courtName" | "message" | "playerName" | "type"
>;

const TEAM_CAPACITIES: Partial<Record<CourtSport, ReadonlySet<number>>> = {
  BASKETBALL: new Set([2, 4, 6, 8, 10]),
  PICKLEBALL: new Set([2, 4]),
  TENNIS: new Set([2, 4]),
  VOLLEYBALL: new Set([4, 6, 8, 10, 12]),
};

function formatRunFormat({ maxPlayers, sport }: RunIdentityInput): string {
  const supportedCapacities = TEAM_CAPACITIES[sport];
  if (!supportedCapacities?.has(maxPlayers)) return "OPEN RUN";

  const teamSize = maxPlayers / 2;
  return `${teamSize}V${teamSize}`;
}

export function formatRunIdentity(run: RunIdentityInput): string {
  return `${formatRunFormat(run)} · ${run.skillLevel}`;
}

function stripActor(message: string, actor: string): string {
  const normalizedMessage = message.trim().replace(/\s+/g, " ");
  if (!actor.trim()) return normalizedMessage;

  const escapedActor = actor.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return normalizedMessage
    .replace(new RegExp(`^${escapedActor}\\s*`, "i"), "")
    .trim();
}

export function formatActivityCopy(item: ActivityCopyInput): {
  actor: string;
  action: string;
} {
  const actor = item.playerName.trim() || "Someone";

  const knownAction: Partial<Record<FeedItem["type"], string>> = {
    checkin: "checked in",
    checkout: "checked out",
    new_court: "added a new court",
    run_started: "scheduled a game",
  };

  const action =
    knownAction[item.type] ??
    stripActor(item.message, actor).toLocaleLowerCase();

  return {
    actor,
    action: action || "shared an update",
  };
}

export function formatMatchSide(
  participants: Pick<FeedMatchParticipant, "name">[],
): string {
  if (participants.length === 0) return "SIDE TBD";
  return participants
    .map((participant) => participant.name.trim())
    .filter(Boolean)
    .join(" + ");
}

export function formatGameResult(
  match: {
    sideA: Pick<FeedMatchParticipant, "name">[];
    sideB: Pick<FeedMatchParticipant, "name">[];
    scoreA: number;
    scoreB: number;
    winnerSide: "a" | "b";
  },
): string {
  const winner = match.winnerSide === "a" ? match.sideA : match.sideB;
  const loser = match.winnerSide === "a" ? match.sideB : match.sideA;
  const winningScore = match.winnerSide === "a" ? match.scoreA : match.scoreB;
  const losingScore = match.winnerSide === "a" ? match.scoreB : match.scoreA;
  return `${formatMatchSide(winner)} beat ${formatMatchSide(loser)}, ${winningScore}–${losingScore}`;
}

export function formatClockTime(value: string): string {
  const match = /^(\d{1,2}):(\d{2})$/.exec(value.trim());
  if (!match) return value;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (!Number.isInteger(hours) || hours < 0 || hours > 23 || minutes < 0 || minutes > 59) return value;
  const suffix = hours >= 12 ? "PM" : "AM";
  const displayHour = hours % 12 || 12;
  return `${displayHour}:${String(minutes).padStart(2, "0")} ${suffix}`;
}
