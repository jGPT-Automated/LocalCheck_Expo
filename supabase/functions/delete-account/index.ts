import { createClient } from "npm:@supabase/supabase-js@2";

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

async function revokeAppleAuthorizationCode(code: string): Promise<void> {
  const clientId = Deno.env.get("APPLE_CLIENT_ID");
  const clientSecret = Deno.env.get("APPLE_CLIENT_SECRET");
  if (!clientId || !clientSecret) {
    throw new Error("Apple account deletion is not configured yet.");
  }

  const tokenResponse = await fetch("https://appleid.apple.com/auth/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      code,
      grant_type: "authorization_code",
    }),
  });
  const tokenPayload = await tokenResponse.json();
  if (!tokenResponse.ok) throw new Error("Apple reauthentication could not be verified.");

  const token = tokenPayload.refresh_token ?? tokenPayload.access_token;
  const tokenType = tokenPayload.refresh_token ? "refresh_token" : "access_token";
  if (!token) throw new Error("Apple did not return a revocable token.");

  const revokeResponse = await fetch("https://appleid.apple.com/auth/revoke", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      token,
      token_type_hint: tokenType,
    }),
  });
  if (!revokeResponse.ok) throw new Error("Apple authorization could not be revoked.");
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (request.method !== "POST") return json(405, { error: "Method not allowed" });

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const authorization = request.headers.get("Authorization");
  if (!supabaseUrl || !anonKey || !serviceRoleKey || !authorization) {
    return json(401, { error: "Unauthorized" });
  }

  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authorization } },
    auth: { persistSession: false },
  });
  const { data: userData, error: userError } = await userClient.auth.getUser();
  const user = userData.user;
  if (userError || !user) return json(401, { error: "Unauthorized" });

  const payload = await request.json().catch(() => ({}));
  const usesApple = user.identities?.some((identity) => identity.provider === "apple") ?? false;

  try {
    if (usesApple) {
      const appleCode = typeof payload.appleAuthorizationCode === "string"
        ? payload.appleAuthorizationCode
        : "";
      if (!appleCode) return json(400, { error: "Apple reauthentication is required." });
      await revokeAppleAuthorizationCode(appleCode);
    }

    const adminClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { error: deleteError } = await adminClient.auth.admin.deleteUser(user.id, false);
    if (deleteError) return json(409, { error: deleteError.message });
    return json(200, { ok: true });
  } catch (error) {
    return json(409, {
      error: error instanceof Error ? error.message : "Account deletion failed.",
    });
  }
});
