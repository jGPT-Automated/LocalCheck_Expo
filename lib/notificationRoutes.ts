const UUID = "[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-5][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}";

const SAFE_NOTIFICATION_ROUTES = [
  /^\/notifications$/,
  new RegExp(`^/match/${UUID}$`),
  new RegExp(`^/run/${UUID}$`),
  new RegExp(`^/challenge/${UUID}$`),
  new RegExp(`^/court/${UUID}$`),
];

/**
 * Push payloads are external input. Only routes emitted by LocalCheck's
 * notification writers may navigate the signed-in app. The legacy /friends
 * destination maps to the Friends tab retained inside Me.
 */
export function getSafeNotificationRoute(value: unknown): string | null {
  if (typeof value !== "string" || value.length > 160) return null;
  if (value === "/friends") return "/(tabs)/elo?tab=friends";
  return SAFE_NOTIFICATION_ROUTES.some((pattern) => pattern.test(value)) ? value : null;
}

/**
 * One key per tap. Auto check-in reuses one notification identifier on
 * purpose (a newer arrival replaces the older one), so the identifier alone
 * can't tell two arrivals apart: a second "Not here" was dropped as already
 * handled. The delivery time separates them; the same tap seen twice (the
 * listener and the cold-start lookup) still matches.
 */
export function notificationResponseKey(response: {
  actionIdentifier: string;
  notification: { date: number; request: { identifier: string } };
}): string {
  return `${response.notification.request.identifier}:${response.notification.date}:${response.actionIdentifier}`;
}
