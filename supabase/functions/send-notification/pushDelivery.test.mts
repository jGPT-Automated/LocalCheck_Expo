import assert from "node:assert/strict";
import { test } from "node:test";

import {
  classifyExpoTickets,
  classifyExpoReceipts,
  isRetryableExpoError,
  retryDelayMs,
} from "./pushDelivery.ts";

test("maps Expo tickets to tokens and disables unregistered devices", () => {
  const result = classifyExpoTickets(
    [{ id: "t1" }, { id: "t2" }],
    [
      { status: "ok", id: "ticket-1" },
      { status: "error", message: "gone", details: { error: "DeviceNotRegistered" } },
    ],
  );
  assert.deepEqual(result.accepted, [{ tokenId: "t1", ticketId: "ticket-1" }]);
  assert.deepEqual(result.invalidTokenIds, ["t2"]);
  assert.equal(result.errors[0]?.tokenId, "t2");
});

test("classifies receipt errors and missing receipts for retry", () => {
  const result = classifyExpoReceipts(
    [
      { attemptId: "a1", tokenId: "t1", ticketId: "ticket-1" },
      { attemptId: "a2", tokenId: "t2", ticketId: "ticket-2" },
      { attemptId: "a3", tokenId: "t3", ticketId: "ticket-3" },
    ],
    {
      "ticket-1": { status: "ok" },
      "ticket-2": { status: "error", details: { error: "DeviceNotRegistered" } },
    },
  );
  assert.deepEqual(result.okAttemptIds, ["a1"]);
  assert.deepEqual(result.invalidTokenIds, ["t2"]);
  assert.deepEqual(result.missingAttemptIds, ["a3"]);
});

test("uses bounded exponential retry delays", () => {
  assert.equal(retryDelayMs(1), 30_000);
  assert.equal(retryDelayMs(2), 120_000);
  assert.equal(retryDelayMs(8), 3_600_000);
});

test("retries rate limits but not permanent device or credential errors", () => {
  assert.equal(isRetryableExpoError("MessageRateExceeded"), true);
  assert.equal(isRetryableExpoError("DeviceNotRegistered"), false);
  assert.equal(isRetryableExpoError("InvalidCredentials"), false);
  assert.equal(isRetryableExpoError("MessageTooBig"), false);
});
