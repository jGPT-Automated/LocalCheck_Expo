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
