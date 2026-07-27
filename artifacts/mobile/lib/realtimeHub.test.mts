import assert from "node:assert/strict";
import test from "node:test";

import { RealtimeHub, marketTopic } from "./realtimeHub.ts";

const USER_ID = "11111111-1111-4111-8111-111111111111";
const COURT_ID = "22222222-2222-4222-8222-222222222222";

class FakeChannel {
  handler = null;
  statusHandler = null;

  constructor(topic, options) {
    this.topic = topic;
    this.options = options;
  }

  on(type, filter, handler) {
    assert.equal(type, "broadcast");
    assert.deepEqual(filter, { event: "invalidate" });
    this.handler = handler;
    return this;
  }

  subscribe(handler) {
    this.statusHandler = handler;
    return this;
  }

  emit(payload) {
    this.handler?.({ type: "broadcast", event: "invalidate", payload });
  }

  status(status, error) {
    this.statusHandler?.(status, error);
  }
}

class FakeClient {
  channels = [];
  removed = [];

  channel(topic, options) {
    const channel = new FakeChannel(topic, options);
    this.channels.push(channel);
    return channel;
  }

  async removeChannel(channel) {
    this.removed.push(channel);
    return "ok";
  }
}

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

test("shares one private channel and coalesces invalidations", async () => {
  const client = new FakeClient();
  const hub = new RealtimeHub(client, USER_ID, { coalesceMs: 5 });
  const batches = [];
  hub.setActive(true);

  const stopA = hub.subscribe(`court:${COURT_ID}`, (batch) => batches.push(batch));
  const stopB = hub.subscribe(`court:${COURT_ID}`, () => {});

  assert.equal(client.channels.length, 1);
  assert.deepEqual(client.channels[0].options, { config: { private: true } });
  client.channels[0].emit({ resource: "check_ins", operation: "INSERT" });
  client.channels[0].emit({ resource: "check_ins", operation: "INSERT" });
  client.channels[0].emit({ resource: "profiles", operation: "UPDATE" });
  await wait(15);

  assert.equal(batches.length, 1);
  assert.deepEqual(batches[0].changes, [
    { resource: "check_ins", operation: "INSERT" },
    { resource: "profiles", operation: "UPDATE" },
  ]);

  stopA();
  assert.equal(client.removed.length, 0);
  stopB();
  assert.equal(client.removed.length, 1);
  hub.dispose();
});

test("removes channels in background and recreates only desired topics", () => {
  const client = new FakeClient();
  const hub = new RealtimeHub(client, USER_ID);
  hub.setActive(true);
  const stop = hub.subscribe(`user:${USER_ID}`, () => {});

  assert.deepEqual(hub.snapshot(), { active: true, desiredTopics: 1, connectedTopics: 1 });
  hub.setActive(false);
  assert.deepEqual(hub.snapshot(), { active: false, desiredTopics: 1, connectedTopics: 0 });
  assert.equal(client.removed.length, 1);

  hub.setActive(true);
  assert.equal(client.channels.length, 2);
  assert.deepEqual(hub.snapshot(), { active: true, desiredTopics: 1, connectedTopics: 1 });
  stop();
  hub.dispose();
});

test("fails closed after repeated channel errors instead of retrying forever", () => {
  const client = new FakeClient();
  const diagnostics = [];
  const hub = new RealtimeHub(client, USER_ID, {
    maxConsecutiveFailures: 3,
    onDiagnostic: (diagnostic) => diagnostics.push(diagnostic),
  });
  hub.setActive(true);
  hub.subscribe(`court:${COURT_ID}`, () => {});

  const channel = client.channels[0];
  channel.status("CHANNEL_ERROR", new Error("PrivateOnly"));
  channel.status("CHANNEL_ERROR", new Error("PrivateOnly"));
  channel.status("CHANNEL_ERROR", new Error("PrivateOnly"));

  assert.equal(client.removed.length, 1);
  assert.equal(hub.snapshot().connectedTopics, 0);
  assert.equal(diagnostics.at(-1).status, "FAILED_CLOSED");
  hub.dispose();
});

test("validates user and market topic boundaries", () => {
  const client = new FakeClient();
  const hub = new RealtimeHub(client, USER_ID);
  const otherUser = "33333333-3333-4333-8333-333333333333";

  assert.equal(marketTopic("New York City"), "market:new-york-city");
  assert.throws(
    () => hub.subscribe(`user:${otherUser}`, () => {}),
    /only to its own user topic/
  );
  assert.throws(
    () => hub.subscribe("market:Houston" as never, () => {}),
    /Invalid Realtime market topic/
  );
  hub.dispose();
});

test("caps exact court topics without counting shared market topics", () => {
  const client = new FakeClient();
  const hub = new RealtimeHub(client, USER_ID, { maxCourtTopics: 1 });
  const secondCourt = "44444444-4444-4444-8444-444444444444";

  hub.subscribe("market:houston", () => {});
  hub.subscribe(`court:${COURT_ID}`, () => {});
  assert.throws(
    () => hub.subscribe(`court:${secondCourt}`, () => {}),
    /court-topic cap exceeded/
  );
  hub.dispose();
});
