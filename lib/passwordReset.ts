// Password reset is code-based: Supabase emails a one-time code (the
// "Reset password" template renders {{ .Token }}) and the user types it into
// the app. No link, no deep link, no redirect URL.
//
// RESET_CODE_LENGTH must equal Supabase Auth → Email OTP length for project
// LocalCheckProd (set to 6 on 2026-10-03). Change both together or not at all.
export const RESET_CODE_LENGTH = 6;

// Same floor as sign-up (Supabase Auth minimum password length is 6).
export const MIN_PASSWORD_LENGTH = 6;

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function normalizeEmail(raw: string): string {
  return raw.trim().toLowerCase();
}

/** Keeps digits only, capped at the code length — paste-friendly. */
export function normalizeResetCode(raw: string): string {
  return raw.replace(/\D/g, "").slice(0, RESET_CODE_LENGTH);
}

export function resetEmailError(email: string): string | null {
  const value = normalizeEmail(email);
  if (!value) return "Enter the email on your account.";
  if (!EMAIL_PATTERN.test(value)) return "That doesn't look like an email address.";
  return null;
}

export function resetCodeError(code: string, password: string): string | null {
  if (normalizeResetCode(code).length !== RESET_CODE_LENGTH) {
    return `Enter the ${RESET_CODE_LENGTH}-digit code from the email.`;
  }
  if (password.length < MIN_PASSWORD_LENGTH) {
    return `Password needs at least ${MIN_PASSWORD_LENGTH} characters.`;
  }
  return null;
}

/** Supabase messages → one plain sentence. Never shows raw payloads. */
export function humanizeResetError(raw: string): string {
  if (!raw) return "Something went wrong. Try again.";
  if (/failed to fetch|network request failed|fetch failed/i.test(raw)) {
    return "Can't reach LocalCheck. Check your connection and try again.";
  }
  if (/expired|invalid|otp/i.test(raw)) {
    return "That code is wrong or expired. Check the email or send a new code.";
  }
  if (/for security purposes|rate limit|too many/i.test(raw)) {
    return "Too many tries. Wait a minute, then send a new code.";
  }
  if (/same.*password|different from the old/i.test(raw)) {
    return "Choose a password you haven't used on LocalCheck before.";
  }
  if (/at least \d+ characters|weak/i.test(raw)) {
    return `Password needs at least ${MIN_PASSWORD_LENGTH} characters.`;
  }
  if (raw.length > 140 || raw.trim().startsWith("{")) {
    return "Something went wrong. Try again.";
  }
  return raw;
}
