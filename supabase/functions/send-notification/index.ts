import { createClient, type SupabaseClient } from "npm:@supabase/supabase-js@2";

import {
  classifyExpoReceipts,
  classifyExpoTickets,
  isRetryableExpoError,
  retryDelayMs,
  type ExpoReceipt,
  type ExpoTicket,
} from "./pushDelivery.ts";

const EXPO_SEND_URL = "https://exp.host/--/api/v2/push/send";
const EXPO_RECEIPTS_URL = "https://exp.host/--/api/v2/push/getReceipts";

function json(status: number, body: Record<string, unknown>) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function readBackendKey(collectionName: string, legacyName: string): string | null {
  const collection = Deno.env.get(collectionName);
  if (collection) {
    try {
      const keys = JSON.parse(collection) as Record<string, unknown>;
      const preferred = keys.default ?? Object.values(keys)[0];
      if (typeof preferred === "string" && preferred) return preferred;
    } catch {
      // Fall through while projects transition from legacy service-role keys.
    }
  }
  return Deno.env.get(legacyName) ?? null;
}

function expoHeaders(): Record<string, string> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Accept: "application/json",
  };
  const accessToken = Deno.env.get("EXPO_ACCESS_TOKEN");
  if (accessToken) headers.Authorization = `Bearer ${accessToken}`;
  return headers;
}

async function expoRequest(url: string, body: Record<string, unknown> | Record<string, unknown>[]) {
  let response: Response | null = null;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    response = await fetch(url, {
      method: "POST",
      headers: expoHeaders(),
      body: JSON.stringify(body),
    });
    if (response.status !== 429 && response.status < 500) return response;
    if (attempt < 2) await new Promise((resolve) => setTimeout(resolve, 250 * (4 ** attempt)));
  }
  return response!;
}

interface NotificationRow {
  id: string;
  user_id: string;
  title: string;
  body: string;
  data: Record<string, unknown> | null;
  push_attempts: number;
  profiles?: { push_notifications_enabled?: boolean } | Array<{ push_notifications_enabled?: boolean }> | null;
}

interface PushTokenRow {
  id: string;
  expo_push_token: string;
}

interface DeliveryAttemptRow {
  id: string;
  notification_id: string;
  push_token_id: string;
  expo_ticket_id: string;
}

function profileAllowsPush(row: NotificationRow): boolean {
  const profile = Array.isArray(row.profiles) ? row.profiles[0] : row.profiles;
  return profile?.push_notifications_enabled !== false;
}

async function setInvalidTokens(admin: SupabaseClient, ids: string[]) {
  if (!ids.length) return;
  await admin
    .from("push_tokens")
    .update({ enabled: false, updated_at: new Date().toISOString() })
    .in("id", [...new Set(ids)]);
}

async function markForRetry(
  admin: SupabaseClient,
  notificationId: string,
  attempt: number,
  error: string,
) {
  await admin.from("notifications").update({
    push_status: "failed",
    push_claimed_at: null,
    next_push_attempt_at: attempt < 5
      ? new Date(Date.now() + retryDelayMs(attempt)).toISOString()
      : null,
    last_push_error: error.slice(0, 1000),
  }).eq("id", notificationId);
}

async function processNotification(admin: SupabaseClient, notificationId: string) {
  const { data, error } = await admin
    .from("notifications")
    .select("id,user_id,title,body,data,push_attempts,profiles!notifications_user_id_fkey(push_notifications_enabled)")
    .eq("id", notificationId)
    .maybeSingle();
  if (error || !data) throw new Error(error?.message ?? "Claimed notification was not found");
  const notification = data as unknown as NotificationRow;

  if (!profileAllowsPush(notification)) {
    await admin.from("notifications").update({
      push_status: "skipped",
      push_claimed_at: null,
      next_push_attempt_at: null,
    }).eq("id", notification.id);
    return { accepted: 0, failed: 0, skipped: true };
  }

  const [{ data: tokenData, error: tokenError }, { data: previousAttempts, error: attemptError }] =
    await Promise.all([
      admin.from("push_tokens")
        .select("id,expo_push_token")
        .eq("user_id", notification.user_id)
        .eq("enabled", true),
      admin.from("push_delivery_attempts")
        .select("push_token_id,ticket_status,receipt_status")
        .eq("notification_id", notification.id),
    ]);
  if (tokenError || attemptError) throw new Error(tokenError?.message ?? attemptError?.message);

  const completedTokenIds = new Set(
    (previousAttempts ?? [])
      .filter((attempt) => attempt.ticket_status === "accepted"
        && (attempt.receipt_status === "pending" || attempt.receipt_status === "ok"))
      .map((attempt) => attempt.push_token_id as string),
  );
  const allTokens = (tokenData ?? []) as PushTokenRow[];
  const tokens = allTokens.filter((token) => !completedTokenIds.has(token.id));

  if (!tokens.length) {
    await admin.from("notifications").update({
      push_status: completedTokenIds.size ? "sent" : "skipped",
      push_claimed_at: null,
      next_push_attempt_at: null,
      push_sent_at: completedTokenIds.size ? new Date().toISOString() : null,
    }).eq("id", notification.id);
    return { accepted: completedTokenIds.size, failed: 0, skipped: !completedTokenIds.size };
  }

  const messages = tokens.map((token) => ({
    to: token.expo_push_token,
    title: notification.title,
    body: notification.body,
    data: notification.data ?? {},
    sound: "default",
    channelId: "default",
  }));
  const response = await expoRequest(EXPO_SEND_URL, messages);
  const payload = await response.json().catch(() => ({})) as {
    data?: ExpoTicket[];
    errors?: Array<{ message?: string }>;
  };
  const tickets = Array.isArray(payload.data) ? payload.data : [];
  const result = classifyExpoTickets(tokens, tickets);
  await setInvalidTokens(admin, result.invalidTokenIds);

  const now = new Date().toISOString();
  const nextReceiptCheck = new Date(Date.now() + 15 * 60_000).toISOString();
  const rows = [
    ...result.accepted.map((accepted) => ({
      notification_id: notification.id,
      push_token_id: accepted.tokenId,
      attempt_number: notification.push_attempts,
      expo_ticket_id: accepted.ticketId,
      ticket_status: "accepted",
      ticket_error: null,
      receipt_status: "pending",
      next_receipt_check_at: nextReceiptCheck,
      response: tickets[tokens.findIndex((token) => token.id === accepted.tokenId)] ?? {},
      updated_at: now,
    })),
    ...result.errors.map((failed) => ({
      notification_id: notification.id,
      push_token_id: failed.tokenId,
      attempt_number: notification.push_attempts,
      expo_ticket_id: null,
      ticket_status: "error",
      ticket_error: failed.error,
      receipt_status: null,
      next_receipt_check_at: null,
      response: failed.response,
      updated_at: now,
    })),
  ];
  if (rows.length) {
    const { error: insertError } = await admin.from("push_delivery_attempts").insert(rows);
    if (insertError) throw new Error(insertError.message);
  }

  const apiErrors = Array.isArray(payload.errors)
    ? payload.errors.map((item) => item.message ?? "Unknown Expo API error")
    : [];
  const errors = [...result.errors.map((item) => item.error), ...apiErrors];
  const retryable = response.status === 429
    || response.status >= 500
    || result.errors.some((item) => isRetryableExpoError(item.error));

  if (result.accepted.length && !retryable) {
    await admin.from("notifications").update({
      push_status: "sent",
      push_sent_at: now,
      push_claimed_at: null,
      next_push_attempt_at: null,
      last_push_error: errors.join("; ").slice(0, 1000) || null,
    }).eq("id", notification.id);
  } else if (retryable) {
    await markForRetry(
      admin,
      notification.id,
      notification.push_attempts,
      errors.join("; ") || `Expo push failed (${response.status})`,
    );
  } else {
    await admin.from("notifications").update({
      push_status: result.accepted.length ? "sent" : "failed",
      push_sent_at: result.accepted.length ? now : null,
      push_claimed_at: null,
      next_push_attempt_at: null,
      last_push_error: errors.join("; ").slice(0, 1000) || "Expo rejected every device token",
    }).eq("id", notification.id);
  }

  return { accepted: result.accepted.length, failed: result.errors.length, skipped: false };
}

async function reconcileReceipts(admin: SupabaseClient) {
  const { data, error } = await admin
    .from("push_delivery_attempts")
    .select("id,notification_id,push_token_id,expo_ticket_id")
    .eq("receipt_status", "pending")
    .lte("next_receipt_check_at", new Date().toISOString())
    .order("next_receipt_check_at", { ascending: true })
    .limit(1000);
  if (error) throw new Error(error.message);
  const attempts = (data ?? []) as DeliveryAttemptRow[];
  if (!attempts.length) return { checked: 0, errors: 0 };

  const response = await expoRequest(EXPO_RECEIPTS_URL, {
    ids: attempts.map((attempt) => attempt.expo_ticket_id),
  });
  if (!response.ok) throw new Error(`Expo receipt request failed (${response.status})`);
  const payload = await response.json().catch(() => ({})) as { data?: Record<string, ExpoReceipt> };
  const result = classifyExpoReceipts(
    attempts.map((attempt) => ({
      attemptId: attempt.id,
      tokenId: attempt.push_token_id,
      ticketId: attempt.expo_ticket_id,
    })),
    payload.data ?? {},
  );
  const now = new Date().toISOString();

  if (result.okAttemptIds.length) {
    await admin.from("push_delivery_attempts").update({
      receipt_status: "ok",
      receipt_checked_at: now,
      next_receipt_check_at: null,
      updated_at: now,
    }).in("id", result.okAttemptIds);
  }
  if (result.missingAttemptIds.length) {
    await admin.from("push_delivery_attempts").update({
      next_receipt_check_at: new Date(Date.now() + 5 * 60_000).toISOString(),
      updated_at: now,
    }).in("id", result.missingAttemptIds);
  }
  for (const receiptError of result.errorAttempts) {
    await admin.from("push_delivery_attempts").update({
      receipt_status: "error",
      receipt_error: receiptError.error,
      receipt_checked_at: now,
      next_receipt_check_at: null,
      response: receiptError.response,
      updated_at: now,
    }).eq("id", receiptError.attemptId);
  }
  await setInvalidTokens(admin, result.invalidTokenIds);

  const retryableNotificationIds = [...new Set(
    result.errorAttempts
      .filter((item) => isRetryableExpoError(item.error))
      .map((item) => attempts.find((attempt) => attempt.id === item.attemptId)?.notification_id)
      .filter((id): id is string => Boolean(id)),
  )];
  if (retryableNotificationIds.length) {
    const { data: notifications } = await admin.from("notifications")
      .select("id,push_attempts")
      .in("id", retryableNotificationIds);
    for (const notification of notifications ?? []) {
      await markForRetry(
        admin,
        notification.id as string,
        notification.push_attempts as number,
        "Expo requested a delivery retry after receipt processing",
      );
    }
  }

  return { checked: attempts.length, errors: result.errorAttempts.length };
}

interface WebhookPayload {
  notification_id?: unknown;
  type?: unknown;
  table?: unknown;
  record?: { id?: unknown };
}

Deno.serve(async (request) => {
  if (request.method !== "POST") return json(405, { error: "Method not allowed" });

  const expectedSecret = Deno.env.get("NOTIFICATION_WEBHOOK_SECRET");
  const receivedSecret = request.headers.get("x-localcheck-webhook-secret");
  if (!expectedSecret || receivedSecret !== expectedSecret) {
    return json(401, { error: "Unauthorized" });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const secretKey = readBackendKey("SUPABASE_SECRET_KEYS", "SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !secretKey) return json(500, { error: "Server configuration is missing" });
  const admin = createClient(supabaseUrl, secretKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const payload = await request.json().catch(() => ({})) as WebhookPayload;
  const directId = typeof payload.notification_id === "string"
    ? payload.notification_id
    : payload.table === "notifications" && payload.type === "INSERT"
    && typeof payload.record?.id === "string"
    ? payload.record.id
    : null;

  try {
    const receipts = await reconcileReceipts(admin);
    const { data: claims, error: claimError } = await admin.rpc("claim_push_notifications", {
      p_notification_id: directId,
      p_limit: directId ? 1 : 25,
    });
    if (claimError) throw new Error(claimError.message);

    let accepted = 0;
    let failed = 0;
    let skipped = 0;
    for (const claim of claims ?? []) {
      try {
        const result = await processNotification(admin, claim.notification_id as string);
        accepted += result.accepted;
        failed += result.failed;
        skipped += result.skipped ? 1 : 0;
      } catch (error) {
        const notificationId = claim.notification_id as string;
        const { data: notification } = await admin.from("notifications")
          .select("push_attempts")
          .eq("id", notificationId)
          .maybeSingle();
        await markForRetry(
          admin,
          notificationId,
          (notification?.push_attempts as number | undefined) ?? 1,
          error instanceof Error ? error.message : "Push delivery failed",
        );
        failed += 1;
      }
    }

    return json(200, {
      claimed: claims?.length ?? 0,
      accepted,
      failed,
      skipped,
      receipts_checked: receipts.checked,
      receipt_errors: receipts.errors,
    });
  } catch (error) {
    console.error("send-notification worker failed", error);
    return json(500, { error: error instanceof Error ? error.message : "Push worker failed" });
  }
});
