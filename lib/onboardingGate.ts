// Before the onboarding_completed migration is applied, `onboarding_completed`
// is absent from every profile (the column doesn't exist) — there's no
// authoritative signal, so a short recency window stands in for one: within
// it, treat the profile as a fresh signup; past it, assume it's an existing
// account the migration just hasn't reached yet. This is what lets the
// flag-based feature ship ahead of its own migration with no risk of routing
// an existing account into onboarding.
//
// Once the column exists, its value is authoritative and the age window no
// longer applies at all — an explicit `false` means "still needs onboarding"
// no matter how long ago the profile was created (someone can close the app
// mid-onboarding and come back after the window; the flag is what makes that
// resumable instead of silently skipping the rest of the flow).
const GRACE_MS = 30 * 60 * 1000;

export function profileNeedsOnboarding(
  profile: { created_at: string; onboarding_completed?: boolean } | null,
  now: number = Date.now(),
): boolean {
  if (!profile) return false;
  if (profile.onboarding_completed !== undefined) {
    return profile.onboarding_completed === false;
  }
  const createdAtMs = new Date(profile.created_at).getTime();
  if (Number.isNaN(createdAtMs)) return false;
  return now - createdAtMs <= GRACE_MS;
}
