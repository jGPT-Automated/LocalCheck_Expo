/**
 * PR #43 LocalPlus rollout switches.
 *
 * Every locked surface reads `useLocalPlus()` (the viewer's own entitlement,
 * derived from profiles.is_pro). These flags decide whether a gate is actually
 * *enforced* yet — the UI is built now, turned on once the founding-member
 * migration is applied and RevenueCat is live so nobody is wrongly locked out.
 */
export const LocalPlusFlags = {
  /** Only LocalPlus players are ranked; LocalLite stays unranked (the
   *  paywall's LEADERBOARD perk). FOUNDER and REVIEWER hold promo grants;
   *  TEST accounts count as LocalPlus. */
  gateLeaderboard: true,
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
