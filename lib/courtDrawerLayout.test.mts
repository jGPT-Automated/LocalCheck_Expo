import assert from "node:assert/strict";
import test from "node:test";

import { drawerPeekHeight } from "./courtDrawerLayout.ts";

test("ordinary phone windows share the same precomputed opening detent", () => {
  for (const height of [667, 852, 932]) assert.equal(drawerPeekHeight(height), 238);
});

test("the home indicator's inset grows the peek by the footer's extra padding", () => {
  assert.equal(drawerPeekHeight(852, 34), 260);
});

test("collapsed detent stays below full height on short and regular windows", () => {
  for (const height of [320, 393, 568, 667, 852, 932]) {
    const peek = drawerPeekHeight(height, 34);
    assert.ok(peek > 0);
    assert.ok(peek < height * 0.92);
  }
});

test("the stable compact detent leaves room to expand on a short window", () => {
  assert.equal(drawerPeekHeight(320), Math.round(320 * 0.6));
});
