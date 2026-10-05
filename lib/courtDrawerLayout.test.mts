import assert from "node:assert/strict";
import test from "node:test";

import {
  DRAWER_DETAIL_MIN,
  drawerDetailHeight,
  drawerFooterGap,
  drawerLocalsThatFit,
} from "./courtDrawerLayout.ts";

const iphone15 = { windowHeight: 844, peekHeight: 330, bottomInset: 34 };

test("same height for every court on the same phone", () => {
  const a = drawerDetailHeight({ ...iphone15, showViewAll: true });
  const b = drawerDetailHeight({ ...iphone15, showViewAll: true });
  assert.equal(a, b);
});

test("fits inside the expanded sheet with the View all row", () => {
  const h = drawerDetailHeight({ ...iphone15, showViewAll: true });
  // 844 * 0.92 = 776; minus handle 12, peek 330, view all 44, gap 20
  assert.equal(h, 370);
});

test("the paywall gets the View all space back", () => {
  const withRow = drawerDetailHeight({ ...iphone15, showViewAll: true });
  const gated = drawerDetailHeight({ ...iphone15, showViewAll: false });
  assert.equal(gated - withRow, 44);
});

test("small phones never go below the minimum", () => {
  const h = drawerDetailHeight({ windowHeight: 568, peekHeight: 360, bottomInset: 0, showViewAll: true });
  assert.equal(h, DRAWER_DETAIL_MIN);
});

test("before the peek is measured, a fallback is used", () => {
  const h = drawerDetailHeight({ ...iphone15, peekHeight: 0, showViewAll: true });
  assert.equal(h, 370);
});

test("View all tucks toward the home indicator but never touches the edge", () => {
  assert.equal(drawerFooterGap(34), 20);
  assert.equal(drawerFooterGap(0), 8);
});

test("locals: at most 4, only whole rows, at least 1", () => {
  assert.equal(drawerLocalsThatFit({ available: 400, rowHeight: 72, total: 12 }), 4);
  assert.equal(drawerLocalsThatFit({ available: 220, rowHeight: 72, total: 12 }), 3);
  assert.equal(drawerLocalsThatFit({ available: 400, rowHeight: 72, total: 2 }), 2);
  assert.equal(drawerLocalsThatFit({ available: 30, rowHeight: 72, total: 5 }), 1);
  assert.equal(drawerLocalsThatFit({ available: 400, rowHeight: 72, total: 0 }), 0);
});
