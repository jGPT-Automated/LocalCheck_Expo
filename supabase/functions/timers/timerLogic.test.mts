import assert from "node:assert/strict";
import test from "node:test";

import { deduplicationId, MAX_DELAY_SECONDS, notBeforeSeconds, publishUrl } from "./timerLogic.ts";

const NOW = Date.parse("2026-10-12T17:00:00Z");
const NOW_S = NOW / 1000;

test("a future time is delivered at that time", () => {
  assert.equal(notBeforeSeconds("2026-10-12T17:30:00Z", NOW), NOW_S + 30 * 60);
});

test("fractional seconds round up so delivery is never early", () => {
  assert.equal(notBeforeSeconds("2026-10-12T17:00:03.200Z", NOW), NOW_S + 4);
});

test("a past time is delivered right away", () => {
  assert.equal(notBeforeSeconds("2026-10-12T16:00:00Z", NOW), NOW_S);
});

test("a time past the 7-day limit is capped just under it", () => {
  const eightDays = new Date(NOW + 8 * 24 * 60 * 60 * 1000).toISOString();
  assert.equal(notBeforeSeconds(eightDays, NOW), NOW_S + MAX_DELAY_SECONDS - 60);
});

test("a held score's 7-day deadline is capped, then re-booked when early", () => {
  const sevenDaysAndFive = new Date(NOW + MAX_DELAY_SECONDS * 1000 + 5000).toISOString();
  assert.ok(notBeforeSeconds(sevenDaysAndFive, NOW) < NOW_S + MAX_DELAY_SECONDS);
});

test("an invalid time is refused", () => {
  assert.throws(() => notBeforeSeconds("not a date", NOW));
});

test("each booking gets its own deduplication id", () => {
  assert.equal(deduplicationId("abc", 100), "abc-100");
  assert.notEqual(deduplicationId("abc", 100), deduplicationId("abc", 200));
});

test("the publish URL puts the destination in raw", () => {
  assert.equal(
    publishUrl("https://qstash-us-east-1.upstash.io/", "https://x.supabase.co/functions/v1/timers"),
    "https://qstash-us-east-1.upstash.io/v2/publish/https://x.supabase.co/functions/v1/timers",
  );
});
