import assert from "node:assert/strict";
import { test } from "node:test";

import { circleRing, geofenceOverlay } from "./geofenceShape.ts";

const metres = (a: [number, number], b: [number, number]) => {
  const R = 6_371_000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b[1] - a[1]);
  const dLng = toRad(b[0] - a[0]);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a[1])) * Math.cos(toRad(b[1])) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
};

test("every ring point sits on the radius and the ring closes", () => {
  const ring = circleRing(30.31, -95.46, 150);
  assert.deepEqual(ring[0], ring[ring.length - 1]);
  for (const point of ring) assert.ok(Math.abs(metres([-95.46, 30.31], point) - 150) < 1.5);
});

test("the overlay is a URL-safe geojson() segment", () => {
  const overlay = geofenceOverlay(30.31, -95.46, 150, "#000000");
  assert.ok(overlay.startsWith("geojson(%7B"));
  assert.ok(!overlay.includes(" "));
});
