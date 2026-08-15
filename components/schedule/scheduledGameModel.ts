import type { CourtSport } from "@/constants/data";

export type ScheduledGameFormat = "2V2" | "3V3" | "4V4" | "5V5";

export const BASKETBALL_SCHEDULED_FORMATS: ScheduledGameFormat[] = [
  "2V2",
  "3V3",
  "4V4",
  "5V5",
];

export const PICKLEBALL_SCHEDULED_FORMATS: ScheduledGameFormat[] = ["2V2"];

export function scheduledFormatsForSport(sport: CourtSport): ScheduledGameFormat[] {
  return sport === "PICKLEBALL"
    ? PICKLEBALL_SCHEDULED_FORMATS
    : BASKETBALL_SCHEDULED_FORMATS;
}

export function maxPlayersForFormat(format: ScheduledGameFormat): number {
  return Number(format[0]) * 2;
}

export function formatForMaxPlayers(maxPlayers: number): ScheduledGameFormat | null {
  const teamSize = maxPlayers / 2;
  if (!Number.isInteger(teamSize) || teamSize < 2 || teamSize > 5) return null;
  return `${teamSize}V${teamSize}` as ScheduledGameFormat;
}

export function creatorFirstName(name: string | undefined): string {
  const first = name?.trim().split(/\s+/)[0];
  return first || "LOCAL";
}

/**
 * Scheduled games do not accept freeform names. The stored title is generated
 * from authoritative creator + format data; the court is rendered separately.
 */
export function generatedScheduledGameTitle(
  creatorName: string | undefined,
  format: ScheduledGameFormat,
): string {
  return `${creatorFirstName(creatorName).toUpperCase()} · ${format}`;
}

export function formatScheduledGameTime(value: string): string {
  const [hourText, minute = "00"] = value.split(":");
  const hour = Number(hourText);
  const suffix = hour >= 12 ? "PM" : "AM";
  const displayHour = hour % 12 || 12;
  return `${displayHour}:${minute} ${suffix}`;
}

export function shiftScheduledGameTime(value: string, direction: -1 | 1): string {
  const [hourText] = value.split(":");
  const hour = Number(hourText);
  const next = Math.min(23, Math.max(8, hour + direction));
  return `${String(next).padStart(2, "0")}:00`;
}

export type TeamAssignment = { playerId: string; side: "a" | "b" };

export function validateTeamAssignments(
  rosterIds: string[],
  assignments: TeamAssignment[],
  format: ScheduledGameFormat,
): { valid: boolean; reason?: string } {
  const expectedTeamSize = Number(format[0]);
  const roster = new Set(rosterIds);
  const assigned = new Set(assignments.map((entry) => entry.playerId));
  const teamA = assignments.filter((entry) => entry.side === "a");
  const teamB = assignments.filter((entry) => entry.side === "b");

  if (roster.size !== expectedTeamSize * 2) {
    return { valid: false, reason: "The roster must be full before the score is submitted." };
  }
  if (assigned.size !== assignments.length) {
    return { valid: false, reason: "A player cannot appear on both teams." };
  }
  if (assigned.size !== roster.size || [...assigned].some((id) => !roster.has(id))) {
    return { valid: false, reason: "Every rostered player must be assigned to a team." };
  }
  if (teamA.length !== expectedTeamSize || teamB.length !== expectedTeamSize) {
    return { valid: false, reason: `Each team needs ${expectedTeamSize} players.` };
  }
  return { valid: true };
}
