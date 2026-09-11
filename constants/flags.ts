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
 * `false` = the real experience: a fresh account with no purchase and no
 * grant sees the locked/paywalled states and a working "SUBSCRIBE" button —
 * exactly what a real person downloading the app sees. This is now correct to
 * ship, because RevenueCat is wired (this PR): `/localplus` does a real
 * purchase, not a dead alert.
 *
 * Flipping this to `false` costs LocalPlus for every account that was only
 * "Plus" via this fallback and has no real subscriptions row — that's every
 * TEST account and the Apple reviewer account (expected: neither should be
 * comped going forward; the reviewer redeems a STARTER offer code or buys in
 * sandbox instead) and, critically, **Jesse's own FOUNDER account**, unless
 * its promo `subscriptions` row has been inserted first — see
 * `docs/runbooks/ACCOUNT_TAGS.md` step 3, `docs/runbooks/REVENUECAT.md`
 * Cutover. Do that grant before or in the same release as this flip, or
 * FOUNDER loses LocalPlus too. Leaderboard membership is untouched either way
 * — `LocalPlusFlags.gateLeaderboard` is a separate, still-`false` switch.
 */
export const LOCALPLUS_DEV_DEFAULT = false;

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
