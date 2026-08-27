export function normalizePlayerInitials(value?: string | null): string {
  const words = (value ?? "")
    .trim()
    .split(/\s+/)
    .map((word) => word.replace(/[^a-z0-9]/gi, ""))
    .filter(Boolean);

  if (words.length >= 2) {
    return `${words[0][0]}${words.at(-1)![0]}`.toLocaleUpperCase();
  }

  return words[0]?.slice(0, 2).toLocaleUpperCase() || "LC";
}

const PLAYER_ID = "[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-5][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}";
const PLAYER_QR = new RegExp(`^localcheck://player/(${PLAYER_ID})/?$`);

export function parsePlayerQrCode(value: string): string | null {
  return value.trim().match(PLAYER_QR)?.[1] ?? null;
}
