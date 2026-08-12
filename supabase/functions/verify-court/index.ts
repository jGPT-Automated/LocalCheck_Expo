import { createClient } from "npm:@supabase/supabase-js@2";
import {
  acceptsVerifiedCourt,
  type GeminiCourtResult,
  normalizeGeminiResult,
  outputText,
  supportedSports,
  validateCourtSubmission,
} from "./courtVerification.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function json(status: number, body: Record<string, unknown>) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
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

function readBackendKey(collectionName: string, legacyName: string): string | null {
  const collection = Deno.env.get(collectionName);
  if (collection) {
    try {
      const keys = JSON.parse(collection) as Record<string, unknown>;
      const preferred = keys.default ?? Object.values(keys)[0];
      if (typeof preferred === "string" && preferred) return preferred;
    } catch {
      // Fall through to the legacy project key during the transition window.
    }
  }
  return Deno.env.get(legacyName) ?? null;
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
      store: false,
      input: [
        {
          type: "text",
          text: [
            "Classify this LocalCheck community court submission using only visible evidence in the image.",
            "Set verified=true only when a real, playable basketball or pickleball court is clearly visible and the sport is unambiguous.",
            "Reject screenshots, maps, renderings, selfies, streets, empty fields, other sports, damaged/non-playable surfaces, and unclear photos.",
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
  const publishableKey = readBackendKey("SUPABASE_PUBLISHABLE_KEYS", "SUPABASE_ANON_KEY");
  const secretKey = readBackendKey("SUPABASE_SECRET_KEYS", "SUPABASE_SERVICE_ROLE_KEY");
  const geminiApiKey = Deno.env.get("GEMINI_API_KEY");
  const authorization = request.headers.get("Authorization");
  if (!supabaseUrl || !publishableKey || !secretKey || !geminiApiKey) {
    return json(503, { error: "Court verification is not configured." });
  }
  if (!authorization) return json(401, { error: "Sign in before adding a court." });

  const userClient = createClient(supabaseUrl, publishableKey, {
    global: { headers: { Authorization: authorization } },
    auth: { persistSession: false },
  });
  const { data: userData, error: userError } = await userClient.auth.getUser();
  if (userError || !userData.user) return json(401, { error: "Your session expired. Sign in again." });

  const body = await request.json().catch(() => ({})) as Record<string, unknown>;
  const submission = validateCourtSubmission(body);
  if (!submission.ok) return json(400, { error: submission.error });
  const {
    name,
    address,
    city,
    state,
    latitude,
    longitude,
    imageBase64,
    imageMimeType,
  } = submission.value;

  let analysis: GeminiCourtResult;
  try {
    analysis = await analyzeCourtPhoto(geminiApiKey, imageBase64, imageMimeType);
  } catch (error) {
    return json(502, { error: error instanceof Error ? error.message : "Photo verification failed." });
  }

  if (!acceptsVerifiedCourt(analysis)) {
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
  const admin = createClient(supabaseUrl, secretKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  // The database RPC owns market resolution, quota enforcement, duplicate
  // detection, and insertion in one transaction. Keeping those decisions out
  // of the Edge Function prevents concurrent requests from racing the guards.
  const { data: court, error: insertError } = await admin.rpc("create_verified_court_v2", {
    p_added_by: userData.user.id,
    p_slug: slugify(courtName),
    p_name: courtName,
    p_address: address,
    p_city: city,
    p_state: state,
    p_latitude: latitude,
    p_longitude: longitude,
    p_sport_type: analysis.sport,
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
