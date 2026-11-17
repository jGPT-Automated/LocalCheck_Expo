import assert from "node:assert/strict";
import { test } from "node:test";
import { addLocalListCourt, orderLocalList } from "./localListModel.ts";

test("adding courts preserves the default and never duplicates membership", () => {
  const a = { id: "a" },
    b = { id: "b" };
  assert.deepEqual(addLocalListCourt([a], b), [a, b]);
  assert.deepEqual(addLocalListCourt([a, b], b), [a, b]);
});
test("five courts is the limit including the default", () => {
  const rows = ["a", "b", "c", "d", "e"].map((id) => ({ id }));
  assert.throws(() => addLocalListCourt(rows, { id: "f" }), /5 courts/);
  assert.deepEqual(addLocalListCourt(rows, rows[0]), rows);
});
test("choosing a default changes order without removing the other courts", () => {
  const rows = ["a", "b", "c"].map((id) => ({ id }));
  assert.deepEqual(
    orderLocalList(rows, "c", true).map((x) => x.id),
    ["c", "a", "b"],
  );
  assert.deepEqual(
    rows.map((x) => x.id),
    ["a", "b", "c"],
  );
});
test("a free account sees only its default and extras survive in the draft", () => {
  const rows = ["a", "b", "c"].map((id) => ({ id }));
  assert.deepEqual(
    orderLocalList(rows, "b", false).map((x) => x.id),
    ["b"],
  );
  assert.equal(rows.length, 3);
});
