import assert from "node:assert/strict";
import { test } from "node:test";

import {
  SIGNED_IN_TOTAL_MS,
  SIGNED_OUT_TOTAL_MS,
  splashStateAt,
} from "./splashTimeline.ts";

test("signed-in launch completes in under two seconds", () => {
  assert.ok(SIGNED_IN_TOTAL_MS < 2_000);
  assert.deepEqual(splashStateAt(0, "signed-in", false).glyph, "pin");
  assert.deepEqual(splashStateAt(300, "signed-in", false).glyph, "win");
  assert.deepEqual(splashStateAt(600, "signed-in", false).glyph, "check");
  assert.equal(
    splashStateAt(SIGNED_IN_TOTAL_MS, "signed-in", false).complete,
    true,
  );
});

test("signed-out launch gives the approved artwork a full reveal", () => {
  const opening = splashStateAt(0, "signed-out", false);
  const revealed = splashStateAt(900, "signed-out", false);
  assert.equal(opening.artworkProgress, 0);
  assert.equal(revealed.artworkProgress, 1);
  assert.equal(
    splashStateAt(SIGNED_OUT_TOTAL_MS, "signed-out", false).complete,
    true,
  );
});

test("reduced motion immediately exposes the final static state", () => {
  assert.deepEqual(splashStateAt(0, "signed-in", true), {
    artworkProgress: 1,
    complete: true,
    glyph: "check",
  });
  assert.deepEqual(splashStateAt(0, "signed-out", true), {
    artworkProgress: 1,
    complete: true,
    glyph: "check",
  });
});
