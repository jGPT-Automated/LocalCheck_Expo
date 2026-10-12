// Pure helpers for the `timers` Edge Function, kept apart so they can be
// tested without Deno or network access.

/** QStash's free plan holds a message for at most 7 days. */
export const MAX_DELAY_SECONDS = 7 * 24 * 60 * 60;

/** Leave a minute of room under the cap so QStash never rejects the delay. */
const CAP_MARGIN_SECONDS = 60;

/**
 * The Upstash-Not-Before value (Unix seconds) for a timer due at `runAt`.
 * A time in the past is sent as "now" (deliver right away). A time beyond the
 * plan's maximum delay is sent at the cap; when QStash delivers it early,
 * the database answers "early" and the function books it again.
 */
export function notBeforeSeconds(runAt: string, nowMs: number): number {
  const nowSeconds = Math.floor(nowMs / 1000);
  const dueMs = Date.parse(runAt);
  if (Number.isNaN(dueMs)) throw new Error(`invalid run_at: ${runAt}`);
  const dueSeconds = Math.ceil(dueMs / 1000);
  const capSeconds = nowSeconds + MAX_DELAY_SECONDS - CAP_MARGIN_SECONDS;
  return Math.max(nowSeconds, Math.min(dueSeconds, capSeconds));
}

/**
 * One deduplication id per booking: the timer plus the delivery time, so a
 * retried booking request never creates a second message, while re-booking
 * an "early" timer for a later time does.
 */
export function deduplicationId(timerId: string, notBefore: number): string {
  return `${timerId}-${notBefore}`;
}

/** The QStash publish URL for a destination (the destination goes in raw). */
export function publishUrl(qstashUrl: string, destination: string): string {
  return `${qstashUrl.replace(/\/+$/, "")}/v2/publish/${destination}`;
}
