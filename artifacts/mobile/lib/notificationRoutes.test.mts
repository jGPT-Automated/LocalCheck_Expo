import assert from "node:assert/strict";
import test from "node:test";

import { getSafeNotificationRoute } from "./notificationRoutes.ts";

const id = "123e4567-e89b-42d3-a456-426614174000";

test("accepts LocalCheck notification destinations", () => {
  assert.equal(getSafeNotificationRoute("/friends"), "/friends");
  assert.equal(getSafeNotificationRoute(`/match/${id}`), `/match/${id}`);
  assert.equal(getSafeNotificationRoute(`/run/${id}`), `/run/${id}`);
});

test("rejects malformed or unrelated destinations", () => {
  assert.equal(getSafeNotificationRoute("https://example.com"), null);
  assert.equal(getSafeNotificationRoute("/(tabs)/compete?admin=true"), null);
  assert.equal(getSafeNotificationRoute("/run/not-a-uuid"), null);
  assert.equal(getSafeNotificationRoute(null), null);
});
