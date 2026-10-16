export const supportedMimeTypes = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/heic",
  "image/heif",
]);
export const supportedSettings = new Set(["outdoor", "indoor", "mixed", "outdoor_covered"]);
export const supportedSports = new Set(["basketball", "pickleball"]);

// Gemini picks exactly one of these — never free prose. The Edge Function maps
// the code to the single user-facing sentence in REJECTION_COPY.
export const REJECTION_CODES = [
  "none",
  "not_a_court",
  "photo_of_screen",
  "not_at_court",
  "wrong_sport",
  "surface_unplayable",
  "too_unclear",
] as const;
export type RejectionCode = (typeof REJECTION_CODES)[number];

export const NAME_CODES = [
  "none",
  "offensive",
  "contact_info",
  "promotional",
  "not_a_name",
] as const;
export type NameCode = (typeof NAME_CODES)[number];

export interface GeminiCourtResult {
  verified: boolean;
  sport: "basketball" | "pickleball" | "other" | "unclear";
  setting: "outdoor" | "indoor" | "mixed" | "outdoor_covered" | "unclear";
  confidence: number;
  rejectionCode: RejectionCode;
  nameOkay: boolean;
  nameCode: NameCode;
  /** The model's own explanation in plain words, shown to the submitter
   * until launch (Jesse, Oct 11 and Oct 16). Empty when it gave none. */
  note: string;
}

/** Free-text answer from the model, capped so the screen stays readable. */
export const NOTE_MAX_LENGTH = 500;

/** Fallbacks when the pin's address can't be looked up (Jesse, Oct 16: the
 * photo and the pin are all that matter). */
export const UNKNOWN_CITY = "Unknown";
export const UNKNOWN_STATE = "US";

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
  const rawRejection = typeof candidate.rejection_code === "string"
    ? candidate.rejection_code.toLowerCase()
    : "";
  const rejectionCode = (REJECTION_CODES as readonly string[]).includes(rawRejection)
    ? (rawRejection as RejectionCode)
    : "too_unclear";
  const rawName = typeof candidate.name_code === "string"
    ? candidate.name_code.toLowerCase()
    : "";
  const nameCode = (NAME_CODES as readonly string[]).includes(rawName)
    ? (rawName as NameCode)
    : "none";
  return {
    verified: candidate.verified === true,
    sport: sport as GeminiCourtResult["sport"],
    setting: setting as GeminiCourtResult["setting"],
    confidence,
    rejectionCode: candidate.verified === true ? "none" : rejectionCode,
    nameOkay: candidate.name_okay,
    nameCode: candidate.name_okay ? "none" : nameCode,
    note: cleanText(candidate.reason, NOTE_MAX_LENGTH),
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

  if (!Number.isFinite(latitude) || latitude < -90 || latitude > 90
    || !Number.isFinite(longitude) || longitude < -180 || longitude > 180) {
    return { ok: false, error: "The court location is invalid." };
  }
  if (!supportedMimeTypes.has(imageMimeType) || imageBase64.length < 200 || imageBase64.length > 8_000_000) {
    return { ok: false, error: "Use a clear JPEG, PNG, WebP, HEIC, or HEIF photo under 6 MB." };
  }
  if (requestedSportValue && !requestedSport) {
    return { ok: false, error: "Choose basketball or pickleball." };
  }

  // Only the photo and the pin are required. Missing names fall back to a
  // generic one; the server fills a missing address from the pin.
  const fallbackName = "Community Court";
  const finalOfficial = officialName.length >= 2 ? officialName : fallbackName;
  const finalShort = shortName.length >= 2 ? shortName : cleanText(finalOfficial, 32);
  const finalSourceOfficial = sourceOfficialName.length >= 2 ? sourceOfficialName : finalOfficial;
  const finalSourceShort = sourceShortName.length >= 2 ? sourceShortName : finalShort;
  return {
    ok: true,
    value: {
      sourceOfficialName: finalSourceOfficial,
      sourceShortName: finalSourceShort,
      officialName: finalOfficial,
      shortName: finalShort,
      nameWasEdited: courtNamesWereEdited(
        finalSourceOfficial,
        finalSourceShort,
        finalOfficial,
        finalShort,
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

/**
 * Until launch almost everything passes (Jesse, Oct 16): no confidence bar.
 * A photo is turned down only when the model says it is not a court at all
 * and saw no basketball or pickleball in it. Blurry, dark, the "wrong" sport
 * or a beat-up surface all pass; bad ones get cleaned up afterwards.
 */
export function acceptsVerifiedCourt(
  analysis: GeminiCourtResult,
  _requestedSport: ValidCourtSubmission["requestedSport"] = null,
): boolean {
  if (analysis.verified) return true;
  if (supportedSports.has(analysis.sport)) return true;
  return analysis.rejectionCode !== "not_a_court";
}

/** The sport saved on the court: the submitter's pick, else the model's. */
export function savedSport(
  analysis: GeminiCourtResult,
  requestedSport: ValidCourtSubmission["requestedSport"],
): "basketball" | "pickleball" {
  if (requestedSport) return requestedSport;
  return analysis.sport === "pickleball" ? "pickleball" : "basketball";
}

/** The setting saved on the court; "unclear" is stored as outdoor. */
export function savedSetting(analysis: GeminiCourtResult): string {
  return supportedSettings.has(analysis.setting) ? analysis.setting : "outdoor";
}

/**
 * "Wrong sport" only when the photo really is a court for another sport: the
 * model said so, or it saw a supported court that isn't the one picked. A
 * living room (sport "unclear") is "not a court", never "wrong sport".
 */
export function isWrongSport(
  analysis: GeminiCourtResult,
  requestedSport: ValidCourtSubmission["requestedSport"],
): boolean {
  if (analysis.rejectionCode === "wrong_sport") return true;
  return requestedSport != null
    && supportedSports.has(analysis.sport)
    && analysis.sport !== requestedSport;
}

/** No sport check while testing: the submitter's pick is saved. */
export function matchesRequestedSport(
  _analysis: GeminiCourtResult,
  _requestedSport: ValidCourtSubmission["requestedSport"],
): boolean {
  return true;
}
