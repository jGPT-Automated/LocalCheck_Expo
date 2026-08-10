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
