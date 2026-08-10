import assert from "node:assert/strict";
import test from "node:test";

import {
  courtDiscoveryBounds,
  MARKET_DISCOVERY_RADII_DEG,
} from "./courtDiscoveryModel.ts";

test("expands market discovery from neighborhood to metro scale", () => {
  assert.deepEqual(MARKET_DISCOVERY_RADII_DEG, [0.15, 0.5, 2.5]);
});

test("widens longitude bounds at higher latitudes", () => {
  const equator = courtDiscoveryBounds({ lat: 0, lng: -95 }, 0.5);
  const northern = courtDiscoveryBounds({ lat: 60, lng: -95 }, 0.5);

  assert.equal(equator.neLng - equator.swLng, 1);
  assert.ok(northern.neLng - northern.swLng > 1.9);
});

test("keeps discovery bounds inside valid coordinate ranges", () => {
  assert.deepEqual(courtDiscoveryBounds({ lat: 95, lng: 200 }, 2.5), {
    swLat: 87.5,
    swLng: 167.5,
    neLat: 90,
    neLng: 180,
  });
});
