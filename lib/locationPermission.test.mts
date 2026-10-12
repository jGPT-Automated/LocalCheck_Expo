import assert from "node:assert/strict";
import test from "node:test";

import { locationPermissionLabel } from "./locationPermission.ts";

test("no foreground grant reads OFF", () => {
  assert.equal(
    locationPermissionLabel({ foregroundGranted: false, backgroundGranted: false }),
    "OFF",
  );
});

test("foreground only reads WHILE USING", () => {
  assert.equal(
    locationPermissionLabel({ foregroundGranted: true, backgroundGranted: false }),
    "WHILE USING",
  );
});

test("a background grant reads ALWAYS", () => {
  assert.equal(
    locationPermissionLabel({ foregroundGranted: true, backgroundGranted: true }),
    "ALWAYS",
  );
});
