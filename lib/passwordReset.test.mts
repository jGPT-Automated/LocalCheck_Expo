import assert from "node:assert/strict";
import test from "node:test";

import {
  RESET_CODE_LENGTH,
  humanizeResetError,
  normalizeResetCode,
  resetCodeError,
  resetEmailError,
} from "./passwordReset.ts";

test("reset code length matches the Supabase OTP setting (6)", () => {
  assert.equal(RESET_CODE_LENGTH, 6);
});

test("pasted codes keep digits only and stop at the code length", () => {
  assert.equal(normalizeResetCode(" 123 456 "), "123456");
  assert.equal(normalizeResetCode("12-34-56-78"), "123456");
});

test("email is required and must look like an email", () => {
  assert.equal(resetEmailError("  "), "Enter the email on your account.");
  assert.equal(resetEmailError("jesse"), "That doesn't look like an email address.");
  assert.equal(resetEmailError(" Apple@Test.com "), null);
});

test("code must be complete and the new password at least 6 characters", () => {
  assert.match(resetCodeError("12345", "secret1") ?? "", /6-digit code/);
  assert.match(resetCodeError("123456", "12345") ?? "", /at least 6/);
  assert.equal(resetCodeError("123456", "123456"), null);
});

test("Supabase errors become one plain sentence", () => {
  assert.match(humanizeResetError("Token has expired or is invalid"), /wrong or expired/);
  assert.match(
    humanizeResetError("For security purposes, you can only request this after 42 seconds."),
    /Too many tries/,
  );
  assert.match(humanizeResetError("TypeError: Network request failed"), /Can't reach/);
  assert.match(
    humanizeResetError("New password should be different from the old password."),
    /haven't used/,
  );
  assert.equal(humanizeResetError('{"status":500}'), "Something went wrong. Try again.");
});
