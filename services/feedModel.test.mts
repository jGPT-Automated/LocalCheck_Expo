import assert from "node:assert/strict";
import test from "node:test";

import { summarizeActivityHype } from "./feedModel.ts";

test("hydrates the authoritative hype count", () => {
  assert.deepEqual(
    summarizeActivityHype([{ user_id: "one" }, { user_id: "two" }], "three"),
    { hypeCount: 2, hypedByCurrentUser: false },
  );
});

test("marks an event already hyped by the current user", () => {
  assert.deepEqual(
    summarizeActivityHype([{ user_id: "one" }, { user_id: "two" }], "two"),
    { hypeCount: 2, hypedByCurrentUser: true },
  );
});
