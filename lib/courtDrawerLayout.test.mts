import assert from "node:assert/strict";
import test from "node:test";

import { drawerPeekHeight } from "./courtDrawerLayout.ts";

test("ordinary phone windows share the same precomputed opening detent", () => {
  for (const height of [667, 852, 932]) assert.equal(drawerPeekHeight(height), 264);
});

test("collapsed detent stays below full height on short and regular windows", () => {
  for (const height of [320, 393, 568, 667, 852, 932]) {
    const peek = drawerPeekHeight(height);
    assert.ok(peek > 0);
    assert.ok(peek < height * 0.92);
    assert.ok(peek <= 264);
  }
});

test("the stable compact detent leaves room to expand on a short window", () => {
  assert.equal(drawerPeekHeight(393), Math.round(393 * 0.6));
});
