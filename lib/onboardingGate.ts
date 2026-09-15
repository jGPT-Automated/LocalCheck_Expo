// A profile only ever needs onboarding within a short grace window after
// creation. This is the safety property that lets the flag-based signal
// (`profiles.onboarding_completed`, which the client also writes) ship ahead
// of its migration: an existing account's `created_at` is always older than
// the window, so it can never be routed into onboarding, regardless of
// whether the column exists yet or what it defaults to.
const GRACE_MS = 30 * 60 * 1000;

export function profileNeedsOnboarding(
  profile: { created_at: string; onboarding_completed?: boolean } | null,
  now: number = Date.now(),
): boolean {
  if (!profile) return false;
  if (profile.onboarding_completed === true) return false;
  const createdAtMs = new Date(profile.created_at).getTime();
  if (Number.isNaN(createdAtMs)) return false;
  return now - createdAtMs <= GRACE_MS;
}
