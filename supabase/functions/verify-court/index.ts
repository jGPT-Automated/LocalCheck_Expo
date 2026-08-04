import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const supportedMimeTypes = new Set(["image/jpeg", "image/png", "image/webp", "image/heic", "image/heif"]);
const supportedAccessTypes = new Set(["public_free", "public_paid", "private_paid"]);
const supportedSettings = new Set(["outdoor", "indoor", "mixed", "outdoor_covered"]);
const supportedSports = new Set(["basketball", "pickleball"]);

interface SubmissionBody {
  name?: unknown;
  address?: unknown;
  city?: unknown;
  state?: unknown;
  latitude?: unknown;
  longitude?: unknown;
  accessType?: unknown;
  imageBase64?: unknown;
  imageMimeType?: unknown;
}

interface GeminiCourtResult {
  verified: boolean;
  sport: "basketball" | "pickleball" | "other" | "unclear";
  setting: "outdoor" | "indoor" | "mixed" | "outdoor_covered" | "unclear";
  confidence: number;
  reason: string;
}

function json(status: number, body: Record<string, unknown>) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function cleanText(value: unknown, maxLength: number): string {
  return typeof value === "string" ? value.trim().replace(/\s+/g, " ").slice(0, maxLength) : "";
}

function slugify(value: string): string {
  const base = value
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 70) || "community-court";
  return `${base}-${crypto.randomUUID().slice(0, 8)}`;
}

function outputText(payload: unknown): string {
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

function normalizeGeminiResult(payload: unknown): GeminiCourtResult | null {
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

async function analyzeCourtPhoto(
  apiKey: string,
  imageBase64: string,
  imageMimeType: string
): Promise<GeminiCourtResult> {
  const model = Deno.env.get("GEMINI_VISION_MODEL") || "gemini-3.6-flash";
  const response = await fetch("https://generativelanguage.googleapis.com/v1beta/interactions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-goog-api-key": apiKey,
    },
    body: JSON.stringify({
      model,
      input: [
        {
          type: "text",
          text: [
            "Classify this LocalCheck community court submission using only visible evidence in the image.",
            "Set verified=true only when a real, playable basketball or pickleball court is clearly visible and the sport is unambiguous.",
            "Reject screenshots, maps, renderings, selfies, streets, empty fields, other sports, damaged/non-playable surfaces, and unclear photos.",
            "Do not infer whether access is public or private; the user reports that separately.",
            "For setting, choose outdoor, indoor, outdoor_covered, mixed, or unclear.",
            "Give a short user-facing reason that describes the visible evidence without claiming legal ownership or public access.",
          ].join(" "),
        },
        { type: "image", data: imageBase64, mime_type: imageMimeType },
      ],
      response_format: {
        type: "text",
        mime_type: "application/json",
        schema: {
          type: "object",
          additionalProperties: false,
          properties: {
            verified: { type: "boolean" },
            sport: { type: "string", enum: ["basketball", "pickleball", "other", "unclear"] },
            setting: { type: "string", enum: ["outdoor", "indoor", "mixed", "outdoor_covered", "unclear"] },
            confidence: { type: "integer", minimum: 0, maximum: 100 },
            reason: { type: "string" },
          },
          required: ["verified", "sport", "setting", "confidence", "reason"],
        },
      },
    }),
  });

  const responsePayload = await response.json().catch(() => null);
  if (!response.ok) {
    console.error("Gemini court verification failed", response.status);
    throw new Error("Photo verification is temporarily unavailable.");
  }
  const rawText = outputText(responsePayload);
  const parsed = rawText ? JSON.parse(rawText) : null;
  const result = normalizeGeminiResult(parsed);
  if (!result) throw new Error("Photo verification returned an invalid result.");
  return result;
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (request.method !== "POST") return json(405, { error: "Method not allowed" });

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const geminiApiKey = Deno.env.get("GEMINI_API_KEY");
  const authorization = request.headers.get("Authorization");
  if (!supabaseUrl || !anonKey || !serviceRoleKey || !geminiApiKey) {
    return json(503, { error: "Court verification is not configured." });
  }
  if (!authorization) return json(401, { error: "Sign in before adding a court." });

  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authorization } },
    auth: { persistSession: false },
  });
  const { data: userData, error: userError } = await userClient.auth.getUser();
  if (userError || !userData.user) return json(401, { error: "Your session expired. Sign in again." });

  const body = await request.json().catch(() => ({})) as SubmissionBody;
  const submittedName = cleanText(body.name, 120);
  const name = submittedName.length >= 2 ? submittedName : "";
  const address = cleanText(body.address, 250);
  const city = cleanText(body.city, 80);
  const state = cleanText(body.state, 2).toUpperCase();
  const accessType = cleanText(body.accessType, 32);
  const imageBase64 = typeof body.imageBase64 === "string" ? body.imageBase64 : "";
  const imageMimeType = cleanText(body.imageMimeType, 32).toLowerCase();
  const latitude = typeof body.latitude === "number" ? body.latitude : Number.NaN;
  const longitude = typeof body.longitude === "number" ? body.longitude : Number.NaN;

  if (!address || address.length < 2 || city.length < 2 || !/^[A-Z]{2}$/.test(state)) {
    return json(400, { error: "Add a valid address, city, and two-letter state." });
  }
  if (!Number.isFinite(latitude) || latitude < -90 || latitude > 90 || !Number.isFinite(longitude) || longitude < -180 || longitude > 180) {
    return json(400, { error: "The court location is invalid." });
  }
  if (!supportedAccessTypes.has(accessType)) return json(400, { error: "Choose a valid access type." });
  if (!supportedMimeTypes.has(imageMimeType) || imageBase64.length < 200 || imageBase64.length > 8_000_000) {
    return json(400, { error: "Use a clear JPEG, PNG, WebP, HEIC, or HEIF photo under 6 MB." });
  }

  let analysis: GeminiCourtResult;
  try {
    analysis = await analyzeCourtPhoto(geminiApiKey, imageBase64, imageMimeType);
  } catch (error) {
    return json(502, { error: error instanceof Error ? error.message : "Photo verification failed." });
  }

  const accepted =
    analysis.verified &&
    analysis.confidence >= 80 &&
    supportedSports.has(analysis.sport) &&
    supportedSettings.has(analysis.setting);
  if (!accepted) {
    return json(200, {
      verified: false,
      confidence: analysis.confidence,
      sport: supportedSports.has(analysis.sport) ? analysis.sport : undefined,
      reason: analysis.reason,
    });
  }

  const sportLabel = analysis.sport === "basketball" ? "Basketball" : "Pickleball";
  const courtName = name || `${sportLabel} Court`;
  const sourceUrl = `https://maps.apple.com/?ll=${latitude.toFixed(6)},${longitude.toFixed(6)}`;
  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  // The database RPC owns market resolution, quota enforcement, duplicate
  // detection, and insertion in one transaction. Keeping those decisions out
  // of the Edge Function prevents concurrent requests from racing the guards.
  const { data: court, error: insertError } = await admin.rpc("create_verified_court", {
    p_added_by: userData.user.id,
    p_slug: slugify(courtName),
    p_name: courtName,
    p_address: address,
    p_city: city,
    p_state: state,
    p_latitude: latitude,
    p_longitude: longitude,
    p_sport_type: analysis.sport,
    p_access_type: accessType,
    p_setting: analysis.setting,
    p_source_url: sourceUrl,
  });
  if (insertError || !court) {
    console.error("Verified court insert failed", insertError?.code);
    if (insertError?.message.includes("court submission limit")) {
      return json(429, { error: "You have reached today's court-submission limit." });
    }
    if (insertError?.message.startsWith("duplicate court:")) {
      return json(409, { error: `${insertError.message.slice("duplicate court:".length).trim()} is already on LocalCheck near this pin.` });
    }
    return json(409, { error: "The photo was verified, but the court could not be added." });
  }

  return json(201, {
    verified: true,
    confidence: analysis.confidence,
    sport: analysis.sport,
    reason: analysis.reason,
    court,
  });
});
