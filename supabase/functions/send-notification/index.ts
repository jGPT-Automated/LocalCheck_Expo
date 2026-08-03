import { createClient } from "npm:@supabase/supabase-js@2";

function json(status: number, body: Record<string, unknown>) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

interface WebhookPayload {
  type?: string;
  table?: string;
  record?: { id?: string };
}

async function sendToExpo(messages: Record<string, unknown>[]): Promise<Response> {
  let response: Response | null = null;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    response = await fetch("https://exp.host/--/api/v2/push/send", {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify(messages),
    });
    if (response.status !== 429 && response.status < 500) return response;
    if (attempt < 2) await new Promise((resolve) => setTimeout(resolve, 250 * (4 ** attempt)));
  }
  return response!;
}

Deno.serve(async (request) => {
  if (request.method !== "POST") return json(405, { error: "Method not allowed" });

  const expectedSecret = Deno.env.get("NOTIFICATION_WEBHOOK_SECRET");
  const receivedSecret = request.headers.get("x-localcheck-webhook-secret");
  if (!expectedSecret || receivedSecret !== expectedSecret) {
    return json(401, { error: "Unauthorized" });
  }

  const payload = await request.json().catch(() => ({})) as WebhookPayload;
  const notificationId = payload.table === "notifications" && payload.type === "INSERT"
    ? payload.record?.id
    : null;
  if (!notificationId) return json(202, { skipped: true });

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceRoleKey) return json(500, { error: "Server configuration is missing" });
  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  // Claim once. A retried webhook cannot send the same notification twice.
  const { data: notification, error: claimError } = await admin
    .from("notifications")
    .update({ push_status: "processing", push_attempts: 1, last_push_error: null })
    .eq("id", notificationId)
    .eq("push_status", "pending")
    .select("id,user_id,title,body,data,profiles!notifications_user_id_fkey(push_notifications_enabled)")
    .maybeSingle();
  if (claimError) return json(500, { error: claimError.message });
  if (!notification) return json(202, { skipped: true });

  const profile = Array.isArray(notification.profiles)
    ? notification.profiles[0]
    : notification.profiles;
  if (profile?.push_notifications_enabled === false) {
    await admin.from("notifications").update({ push_status: "skipped" }).eq("id", notification.id);
    return json(200, { skipped: true });
  }

  const { data: tokens, error: tokenError } = await admin
    .from("push_tokens")
    .select("id,expo_push_token")
    .eq("user_id", notification.user_id)
    .eq("enabled", true);
  if (tokenError) return json(500, { error: tokenError.message });
  if (!tokens?.length) {
    await admin.from("notifications").update({ push_status: "skipped" }).eq("id", notification.id);
    return json(200, { skipped: true });
  }

  const messages = tokens.map((token) => ({
    to: token.expo_push_token,
    title: notification.title,
    body: notification.body,
    data: notification.data ?? {},
    sound: "default",
    channelId: "default",
  }));
  const pushResponse = await sendToExpo(messages);
  const pushPayload = await pushResponse.json().catch(() => ({}));
  const tickets = Array.isArray(pushPayload?.data) ? pushPayload.data : [];

  const deadTokenIds: string[] = [];
  tickets.forEach((ticket: { status?: string; details?: { error?: string } }, index: number) => {
    if (ticket.status === "error" && ticket.details?.error === "DeviceNotRegistered" && tokens[index]) {
      deadTokenIds.push(tokens[index].id);
    }
  });
  if (deadTokenIds.length) {
    await admin.from("push_tokens").update({ enabled: false, updated_at: new Date().toISOString() }).in("id", deadTokenIds);
  }

  const ticketErrors = tickets.flatMap((ticket: {
    status?: string;
    message?: string;
    details?: { error?: string };
  }) => ticket.status === "error"
    ? [ticket.details?.error ?? ticket.message ?? "Unknown Expo ticket error"]
    : []
  );
  const apiErrors = Array.isArray(pushPayload?.errors)
    ? pushPayload.errors.map((error: { message?: string }) => error.message ?? "Unknown Expo API error")
    : [];
  const sent = pushResponse.ok && tickets.some((ticket: { status?: string }) => ticket.status === "ok");
  const errorSummary = [...ticketErrors, ...apiErrors].join("; ").slice(0, 1000);
  await admin.from("notifications").update(sent ? {
    push_status: "sent",
    push_sent_at: new Date().toISOString(),
    last_push_error: errorSummary || null,
  } : {
    push_status: "failed",
    last_push_error: errorSummary || `Expo push failed (${pushResponse.status})`,
  }).eq("id", notification.id);

  return json(sent ? 200 : 502, {
    sent,
    devices: messages.length,
    accepted: tickets.filter((ticket: { status?: string }) => ticket.status === "ok").length,
    failed: ticketErrors.length,
  });
});
