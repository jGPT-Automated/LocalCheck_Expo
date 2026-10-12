// profiles.onboarding_completed is the only signal (D9). New signups get
// false by default; finishing onboarding sets it true. A profile loaded without
// the column (should not happen in production) is treated as finished, so an
// existing account is never routed into onboarding by mistake.
export function profileNeedsOnboarding(
  profile: { onboarding_completed?: boolean } | null,
): boolean {
  if (!profile) return false;
  return profile.onboarding_completed === false;
}

// The automatic push permission prompt (NotificationContext) needs a positive
// "onboarding is done" signal, not just "onboarding isn't known to be needed".
// profileNeedsOnboarding() answers false for a missing profile, a profile row
// that predates the column, or one left over from another account while the
// new signup's row is still loading, and any of those used to let the iOS
// alerts prompt fire before onboarding's own "why alerts" step. During signup
// and onboarding the only path to that prompt is onboarding's last step.
export function canAutoPromptPush(
  userId: string | null | undefined,
  profile: { id?: string; onboarding_completed?: boolean } | null,
): boolean {
  if (!userId || !profile) return false;
  if (profile.id !== userId) return false;
  return profile.onboarding_completed === true;
}
