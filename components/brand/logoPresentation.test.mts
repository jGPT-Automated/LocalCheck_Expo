import assert from "node:assert/strict";
import { test } from "node:test";

import { backLogoContainerStyle, backLogoFrameStyle, brandHeaderGap } from "./logoPresentation.ts";

test("back-logo frame is explicitly constrained to its requested square", () => {
  assert.deepEqual(backLogoFrameStyle(30), {
    position: "absolute",
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    width: 30,
    height: 30,
  });
  assert.equal(backLogoContainerStyle(30).overflow, "hidden");
  assert.equal(backLogoContainerStyle(30).width, 30);
  assert.equal(backLogoContainerStyle(30).height, 30);
});

test("detail-header spacing follows the final full-lockup geometry", () => {
  assert.equal(brandHeaderGap(30), 9);
  assert.equal(brandHeaderGap(24), 7);
});
