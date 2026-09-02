export const supportedMimeTypes = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/heic",
  "image/heif",
]);
export const supportedSettings = new Set(["outdoor", "indoor", "mixed", "outdoor_covered"]);
export const supportedSports = new Set(["basketball", "pickleball"]);

export interface GeminiCourtResult {
  verified: boolean;
  sport: "basketball" | "pickleball" | "other" | "unclear";
  setting: "outdoor" | "indoor" | "mixed" | "outdoor_covered" | "unclear";
  confidence: number;
  reason: string;
  nameOkay: boolean;
  nameReason: string;
}

export interface ValidCourtSubmission {
  sourceOfficialName: string;
  sourceShortName: string;
  officialName: string;
  shortName: string;
  nameWasEdited: boolean;
  address: string;
  city: string;
  state: string;
  latitude: number;
  longitude: number;
  imageBase64: string;
  imageMimeType: string;
  requestedSport: "basketball" | "pickleball" | null;
}

type ValidationResult =
  | { ok: true; value: ValidCourtSubmission }
  | { ok: false; error: string };

export function cleanText(value: unknown, maxLength: number): string {
  return typeof value === "string"
    ? value.trim().replace(/\s+/g, " ").slice(0, maxLength)
    : "";
}

function comparableName(value: string): string {
  return value.trim().replace(/\s+/g, " ").toLocaleLowerCase();
}

export function courtNamesWereEdited(
  sourceOfficialName: string,
  sourceShortName: string,
  officialName: string,
  shortName: string,
): boolean {
  return comparableName(sourceOfficialName) !== comparableName(officialName)
    || comparableName(sourceShortName) !== comparableName(shortName);
}

export function outputText(payload: unknown): string {
  if (!payload || typeof payload !== "object") return "";
  const steps = (payload as { steps?: unknown }).steps;
  if (!Array.isArray(steps)) return "";
  const textParts: string[] = [];
  for (const step of steps) {
    if (!step || typeof step !== "object" || (step as { type?: unknown }).type !== "model_output") continue;
    const content = (step as { content?: unknown }).content;
    if (!Array.isArray(content)) continue;
    for (const item of content) {
      if (item && typeof item === "object" && (item as { type?: unknown }).type === "text") {
        const text = (item as { text?: unknown }).text;
        if (typeof text === "string") textParts.push(text);
      }
    }
  }
  return textParts.join("");
}

export function normalizeGeminiResult(payload: unknown): GeminiCourtResult | null {
  if (!payload || typeof payload !== "object") return null;
  const candidate = payload as Record<string, unknown>;
  const sport = typeof candidate.sport === "string" ? candidate.sport.toLowerCase() : "";
  const setting = typeof candidate.setting === "string" ? candidate.setting.toLowerCase() : "";
  if (!["basketball", "pickleball", "other", "unclear"].includes(sport)) return null;
  if (!["outdoor", "indoor", "mixed", "outdoor_covered", "unclear"].includes(setting)) return null;
  if (typeof candidate.name_okay !== "boolean") return null;
  const confidence = typeof candidate.confidence === "number"
    ? Math.max(0, Math.min(100, Math.round(candidate.confidence)))
    : 0;
  return {
    verified: candidate.verified === true,
    sport: sport as GeminiCourtResult["sport"],
    setting: setting as GeminiCourtResult["setting"],
    confidence,
    reason: cleanText(candidate.reason, 240) || "The photo did not contain enough visual evidence.",
    nameOkay: candidate.name_okay,
    nameReason: cleanText(candidate.name_reason, 240) || "The submitted name needs manual review.",
  };
}

export function validateCourtSubmission(body: Record<string, unknown>): ValidationResult {
  const address = cleanText(body.address, 250);
  const city = cleanText(body.city, 80);
  const state = cleanText(body.state, 2).toUpperCase();
  const imageBase64 = typeof body.imageBase64 === "string" ? body.imageBase64 : "";
  const imageMimeType = cleanText(body.imageMimeType, 32).toLowerCase();
  const requestedSportValue = cleanText(body.sport, 24).toLowerCase();
  const requestedSport = supportedSports.has(requestedSportValue)
    ? requestedSportValue as "basketball" | "pickleball"
    : null;
  const latitude = typeof body.latitude === "number" ? body.latitude : Number.NaN;
  const longitude = typeof body.longitude === "number" ? body.longitude : Number.NaN;
  const legacyName = cleanText(body.name, 120);
  const streetFallback = cleanText(address.split(",")[0], 120);
  const sourceOfficialName = cleanText(body.suggestedOfficialName, 120)
    || legacyName
    || streetFallback;
  const officialName = cleanText(body.officialName, 120)
    || legacyName
    || sourceOfficialName;
  const sourceShortName = cleanText(body.suggestedShortName, 32)
    || cleanText(sourceOfficialName, 32);
  const shortName = cleanText(body.shortName, 32)
    || cleanText(officialName, 32);

  if (!address || address.length < 2 || city.length < 2 || !/^[A-Z]{2}$/.test(state)) {
    return { ok: false, error: "Add a valid address, city, and two-letter state." };
  }
  if (!Number.isFinite(latitude) || latitude < -90 || latitude > 90
    || !Number.isFinite(longitude) || longitude < -180 || longitude > 180) {
    return { ok: false, error: "The court location is invalid." };
  }
  if (!supportedMimeTypes.has(imageMimeType) || imageBase64.length < 200 || imageBase64.length > 8_000_000) {
    return { ok: false, error: "Use a clear JPEG, PNG, WebP, HEIC, or HEIF photo under 6 MB." };
  }
  if (sourceOfficialName.length < 2 || officialName.length < 2
    || sourceShortName.length < 2 || shortName.length < 2) {
    return { ok: false, error: "Confirm the official court name and short card name." };
  }
  if (requestedSportValue && !requestedSport) {
    return { ok: false, error: "Choose basketball or pickleball." };
  }

  return {
    ok: true,
    value: {
      sourceOfficialName,
      sourceShortName,
      officialName,
      shortName,
      nameWasEdited: courtNamesWereEdited(
        sourceOfficialName,
        sourceShortName,
        officialName,
        shortName,
      ),
      address,
      city,
      state,
      latitude,
      longitude,
      imageBase64,
      imageMimeType,
      requestedSport,
    },
  };
}

export function acceptsVerifiedCourt(analysis: GeminiCourtResult): boolean {
  return analysis.verified
    && analysis.confidence >= 80
    && supportedSports.has(analysis.sport)
    && supportedSettings.has(analysis.setting);
}

export function matchesRequestedSport(
  analysis: GeminiCourtResult,
  requestedSport: ValidCourtSubmission["requestedSport"],
): boolean {
  return requestedSport == null || analysis.sport === requestedSport;
}
