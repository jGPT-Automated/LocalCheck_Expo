import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { coordinateForLocationAction } from "./deviceLocationModel.ts";

const coordinate = { lat: 34.0522, lng: -118.2437 };

test("location actions use only a permission-backed device fix", () => {
  assert.deepEqual(coordinateForLocationAction("granted", coordinate), coordinate);
});

test("location actions reject display fallbacks and unresolved fixes", () => {
  assert.equal(coordinateForLocationAction("denied", coordinate), null);
  assert.equal(coordinateForLocationAction("unavailable", coordinate), null);
  assert.equal(coordinateForLocationAction("loading", coordinate), null);
  assert.equal(coordinateForLocationAction("granted", null), null);
});

test("cached coordinates are display-only until a fresh fix succeeds", async () => {
  const provider = await readFile(
    new URL("./DeviceLocationContext.tsx", import.meta.url),
    "utf8",
  );
  const cachedRead = provider.indexOf("getLastKnownPositionAsync");
  const freshRead = provider.indexOf("getCurrentPositionAsync", cachedRead);
  const granted = provider.indexOf('setStatus("granted")', freshRead);

  assert.ok(cachedRead >= 0);
  assert.ok(freshRead > cachedRead);
  assert.ok(granted > freshRead);
  assert.doesNotMatch(provider, /last\s*\?\?/);
});
