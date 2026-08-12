import assert from "node:assert/strict";
import { test } from "node:test";

import { getPushRegistrationAction } from "./pushRegistrationPolicy.ts";

test("prompts a first-time user whose system permission is undetermined", () => {
  assert.equal(getPushRegistrationAction({
    preferenceEnabled: false,
    permissionStatus: "undetermined",
  }), "prompt");
});

test("repairs an enabled user's existing system grant without prompting", () => {
  assert.equal(getPushRegistrationAction({
    preferenceEnabled: true,
    permissionStatus: "granted",
  }), "register");
});

test("does not silently re-enable a user who disabled push in LocalCheck", () => {
  assert.equal(getPushRegistrationAction({
    preferenceEnabled: false,
    permissionStatus: "granted",
  }), "none");
});

test("does not retry the system prompt after permission was denied", () => {
  assert.equal(getPushRegistrationAction({
    preferenceEnabled: false,
    permissionStatus: "denied",
  }), "none");
});
