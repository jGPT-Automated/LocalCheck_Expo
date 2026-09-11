import { LocalPlusFlags } from "@/constants/flags";

export interface LocalCourtCooldown {
  /** True when a change is currently blocked. */
  restricted: boolean;
  /** Only meaningful when `restricted` is true. */
  remainingMs: number;
}

/**
 * LocalPlus has no cooldown at all. LocalLite can only change local court
 * once every `localCourtCooldownDays`, timed from `local_court_changed_at`
 * (stamped by a DB trigger on every change — see
 * supabase/migrations/20260906103003_pr43_founding_localplus_referral_cooldown.sql).
 * A viewer with no local court yet is never restricted — the cooldown only
 * guards *changing* an existing choice.
 */
export function getLocalCourtCooldown(
  hasLocalPlus: boolean,
  localCourtChangedAt: string | null | undefined,
): LocalCourtCooldown {
  if (hasLocalPlus || !localCourtChangedAt) {
    return { restricted: false, remainingMs: 0 };
  }
  const changedAtMs = new Date(localCourtChangedAt).getTime();
  if (Number.isNaN(changedAtMs)) return { restricted: false, remainingMs: 0 };
  const cooldownMs = LocalPlusFlags.localCourtCooldownDays * 24 * 60 * 60 * 1000;
  const remainingMs = changedAtMs + cooldownMs - Date.now();
  return remainingMs > 0
    ? { restricted: true, remainingMs }
    : { restricted: false, remainingMs: 0 };
}

/** "6 days 23 hours" / "14 hours" / "38 minutes" — matches the mock's copy. */
export function formatCooldownRemaining(remainingMs: number): string {
  const totalMinutes = Math.max(1, Math.round(remainingMs / 60000));
  const days = Math.floor(totalMinutes / (24 * 60));
  const hours = Math.floor((totalMinutes % (24 * 60)) / 60);
  const minutes = totalMinutes % 60;
  if (days > 0) return `${days} day${days === 1 ? "" : "s"} ${hours} hour${hours === 1 ? "" : "s"}`;
  if (hours > 0) return `${hours} hour${hours === 1 ? "" : "s"} ${minutes} minute${minutes === 1 ? "" : "s"}`;
  return `${minutes} minute${minutes === 1 ? "" : "s"}`;
}
