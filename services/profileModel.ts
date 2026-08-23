export type ProfileSport = "BASKETBALL" | "PICKLEBALL" | "TENNIS" | "SOCCER" | "VOLLEYBALL";

const PROFILE_SPORTS: ProfileSport[] = [
  "BASKETBALL",
  "PICKLEBALL",
  "TENNIS",
  "SOCCER",
  "VOLLEYBALL",
];

export function resolveProfileSport(
  preferredSport: string | null | undefined,
  explicitSport?: ProfileSport | null,
): ProfileSport | undefined {
  if (explicitSport) return explicitSport;
  const normalized = preferredSport?.trim().toUpperCase();
  return PROFILE_SPORTS.includes(normalized as ProfileSport)
    ? (normalized as ProfileSport)
    : undefined;
}
