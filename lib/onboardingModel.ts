import type { CourtSport } from "../constants/data";

export type InviteResult =
  | { ok: true }
  | { ok: false; reason: "empty" | "not_found" | "self" | "already_set" | "error" };

/** Usernames (D46): the name shown everywhere, 3-10 letters and numbers. */
export const USERNAME_MAX = 10;

/** Keeps only what a username can contain, cut to fit. */
export function cleanUsername(raw: string): string {
  return raw.replace(/[^A-Za-z0-9]/g, "").slice(0, USERNAME_MAX);
}

export function isValidUsername(value: string): boolean {
  return /^[A-Za-z0-9]{3,10}$/.test(value);
}

/** Referral codes are frozen at the old username rules, so they keep "_". */
export function normalizeInviter(raw: string): string {
  return raw.replace(/[^A-Za-z0-9_]/g, "").slice(0, 32);
}

/** null = fine to continue. Already having an inviter is not an error. */
export function inviteErrorMessage(result: InviteResult): string | null {
  if (result.ok) return null;
  switch (result.reason) {
    case "empty":
    case "already_set":
      return null;
    case "not_found":
      return "No player with that username. Check the spelling, or leave it blank.";
    case "self":
      return "That's your own username. Leave it blank, or enter who invited you.";
    default:
      return "Couldn't check that username. Try again, or leave it blank.";
  }
}

/** Enough to search: at least two letters ("LA" counts). */
export function isCityQuery(raw: string): boolean {
  return (raw.match(/[A-Za-z]/g)?.length ?? 0) >= 2;
}

/** "0.8 mi" — one decimal under 10 miles, whole miles beyond. */
export function formatMiles(km: number | undefined): string | null {
  if (km == null || Number.isNaN(km)) return null;
  const mi = km * 0.621371;
  return mi < 10 ? `${mi.toFixed(1)} mi` : `${Math.round(mi)} mi`;
}

const SPORT_LABEL: Record<CourtSport, string> = {
  BASKETBALL: "Basketball",
  PICKLEBALL: "Pickleball",
  TENNIS: "Tennis",
  SOCCER: "Soccer",
  VOLLEYBALL: "Volleyball",
};

/** Second line under a court name in the picker: "0.8 mi · Basketball · Conroe". */
export function courtPickerDetail(court: {
  distanceKm?: number;
  sport: CourtSport;
  city?: string;
}): string {
  return [formatMiles(court.distanceKm), SPORT_LABEL[court.sport], court.city || null]
    .filter(Boolean)
    .join(" · ");
}

/** Past this, the nearest court is not "near" anyone. */
export const FAR_COURT_MILES = 50;

/**
 * One line shown above the picker when even the closest court is far away,
 * so a 1,354-mi court is not presented as a nearby option. `place` is what
 * the player typed; null means their device location. Null = nothing to say.
 */
export function farCourtNote(
  courts: { distanceKm?: number }[],
  place: string | null,
): string | null {
  const km = courts
    .map((c) => c.distanceKm)
    .filter((d): d is number => d != null && !Number.isNaN(d));
  if (km.length === 0) return null;
  if (Math.min(...km) * 0.621371 <= FAR_COURT_MILES) return null;
  const where = place?.trim().replace(/\s+/g, " ") || "you";
  return `No courts near ${where} yet. Closest:`;
}
