const UUID = "[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-5][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}";

const SAFE_NOTIFICATION_ROUTES = [
  /^\/friends$/,
  /^\/notifications$/,
  new RegExp(`^/match/${UUID}$`),
  new RegExp(`^/run/${UUID}$`),
];

/**
 * Push payloads are external input. Only routes emitted by LocalCheck's
 * notification writers may navigate the signed-in app.
 */
export function getSafeNotificationRoute(value: unknown): string | null {
  if (typeof value !== "string" || value.length > 160) return null;
  return SAFE_NOTIFICATION_ROUTES.some((pattern) => pattern.test(value)) ? value : null;
}
