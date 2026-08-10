export const supportedMimeTypes = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/heic",
  "image/heif",
]);
export const supportedAccessTypes = new Set(["public_free", "public_paid", "private_paid"]);
export const supportedSettings = new Set(["outdoor", "indoor", "mixed", "outdoor_covered"]);
export const supportedSports = new Set(["basketball", "pickleball"]);

export interface GeminiCourtResult {
  verified: boolean;
  sport: "basketball" | "pickleball" | "other" | "unclear";
  setting: "outdoor" | "indoor" | "mixed" | "outdoor_covered" | "unclear";
  confidence: number;
  reason: string;
}

export interface ValidCourtSubmission {
  name: string;
  address: string;
  city: string;
  state: string;
  latitude: number;
  longitude: number;
  accessType: string;
  imageBase64: string;
  imageMimeType: string;
}

type ValidationResult =
  | { ok: true; value: ValidCourtSubmission }
  | { ok: false; error: string };

export function cleanText(value: unknown, maxLength: number): string {
  return typeof value === "string"
    ? value.trim().replace(/\s+/g, " ").slice(0, maxLength)
    : "";
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
  const confidence = typeof candidate.confidence === "number"
    ? Math.max(0, Math.min(100, Math.round(candidate.confidence)))
    : 0;
  return {
    verified: candidate.verified === true,
    sport: sport as GeminiCourtResult["sport"],
    setting: setting as GeminiCourtResult["setting"],
    confidence,
    reason: cleanText(candidate.reason, 240) || "The photo did not contain enough visual evidence.",
  };
}

export function validateCourtSubmission(body: Record<string, unknown>): ValidationResult {
  const submittedName = cleanText(body.name, 120);
  const address = cleanText(body.address, 250);
  const city = cleanText(body.city, 80);
  const state = cleanText(body.state, 2).toUpperCase();
  const accessType = cleanText(body.accessType, 32);
  const imageBase64 = typeof body.imageBase64 === "string" ? body.imageBase64 : "";
  const imageMimeType = cleanText(body.imageMimeType, 32).toLowerCase();
  const latitude = typeof body.latitude === "number" ? body.latitude : Number.NaN;
  const longitude = typeof body.longitude === "number" ? body.longitude : Number.NaN;

  if (!address || address.length < 2 || city.length < 2 || !/^[A-Z]{2}$/.test(state)) {
    return { ok: false, error: "Add a valid address, city, and two-letter state." };
  }
  if (!Number.isFinite(latitude) || latitude < -90 || latitude > 90
    || !Number.isFinite(longitude) || longitude < -180 || longitude > 180) {
    return { ok: false, error: "The court location is invalid." };
  }
  if (!supportedAccessTypes.has(accessType)) {
    return { ok: false, error: "Choose a valid access type." };
  }
  if (!supportedMimeTypes.has(imageMimeType) || imageBase64.length < 200 || imageBase64.length > 8_000_000) {
    return { ok: false, error: "Use a clear JPEG, PNG, WebP, HEIC, or HEIF photo under 6 MB." };
  }

  return {
    ok: true,
    value: {
      name: submittedName.length >= 2 ? submittedName : "",
      address,
      city,
      state,
      latitude,
      longitude,
      accessType,
      imageBase64,
      imageMimeType,
    },
  };
}

export function acceptsVerifiedCourt(analysis: GeminiCourtResult): boolean {
  return analysis.verified
    && analysis.confidence >= 80
    && supportedSports.has(analysis.sport)
    && supportedSettings.has(analysis.setting);
}
