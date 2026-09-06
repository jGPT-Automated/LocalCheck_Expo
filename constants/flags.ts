/**
 * PR #43 LocalPlus rollout switches.
 *
 * Every locked surface reads `useLocalPlus()` (the viewer's own entitlement,
 * derived from profiles.is_pro). These flags decide whether a gate is actually
 * *enforced* yet — the UI is built now, turned on once the founding-member
 * migration is applied and RevenueCat is live so nobody is wrongly locked out.
 */
export const LocalPlusFlags = {
  /** Hide non-subscribers from the public leaderboard query. Needs the
   *  founding-grant backfill applied first, or the board goes empty. */
  gateLeaderboard: false,
  /** Profile activity blurs everything past the 10 most recent games. Safe to
   *  enable now — a non-founder simply sees the paywall prompt. */
  gateHistory: true,
  /** Non-local courts: the swipe-up detail (players / schedule) is paywalled. */
  gateCourtInsights: true,
  /** Games always visible on a profile before the blur kicks in. */
  freeHistoryCount: 10,
  /** Days a local court is locked after being set. */
  localCourtCooldownDays: 7,
} as const;

/**
 * Fallback for `useLocalPlus()` before profiles.is_pro is populated for the
 * founding cohort (the migration inserts promo subscription rows). The whole
 * current user base gets a free year, so `true` is the honest default; flip to
 * `false` to preview the locked states during development.
 */
export const LOCALPLUS_DEV_DEFAULT = true;
