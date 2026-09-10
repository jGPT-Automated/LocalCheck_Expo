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
 * Fallback for `useLocalPlus()` when the viewer has no `profiles.is_pro` signal.
 *
 * `true` = blanket-unlock. Every pre-launch account (all test accounts, the
 * Apple reviewer, Jesse's FOUNDER account) has LocalPlus, which is why the
 * leaderboard is populated and nobody hits a paywall in the current build.
 *
 * Set to `false` for the real post-launch experience — a new account (past the
 * first-100 STARTER cohort, no App Store purchase) sees the locked/paywalled
 * states. Do NOT ship `false` until RevenueCat is wired: without it the
 * `/localplus` "SEE PLANS" button is a dead alert.
 */
export const LOCALPLUS_DEV_DEFAULT = true;

/**
 * Leaderboard rollout switches. See docs/runbooks/ACCOUNT_TAGS.md.
 */
export const LeaderboardFlags = {
  /** Hide TEST / REVIEWER accounts from *other* viewers' boards. Off for now so
   *  the pre-launch board isn't a ghost town — every dev account is tagged, and
   *  the tag still labels the row ("TEST" / "REVIEWER"). Turn on near public
   *  launch so burner accounts don't clutter real players' rankings. A viewer
   *  always sees their own row regardless. */
  hideTaggedAccounts: false,
} as const;
