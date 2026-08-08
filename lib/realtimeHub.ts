import type { RealtimeChannel, SupabaseClient } from "@supabase/supabase-js";

export type RealtimeScope = "court" | "market" | "run" | "user";
export type RealtimeTopic = `${RealtimeScope}:${string}`;

export interface RealtimeInvalidation {
  resource: string;
  operation: string;
}

export interface RealtimeInvalidationBatch {
  topic: RealtimeTopic;
  changes: RealtimeInvalidation[];
}

export type RealtimeListener = (batch: RealtimeInvalidationBatch) => void;

export interface RealtimeDiagnostic {
  topic: RealtimeTopic;
  status:
    | "SUBSCRIBED"
    | "CHANNEL_ERROR"
    | "TIMED_OUT"
    | "CLOSED"
    | "MALFORMED_EVENT"
    | "FAILED_CLOSED";
  error?: string;
  activeTopics: number;
}

type HubClient = Pick<SupabaseClient, "channel" | "removeChannel">;

interface TopicRecord {
  topic: RealtimeTopic;
  listeners: Set<RealtimeListener>;
  channel?: RealtimeChannel;
  failures: number;
  pending: Map<string, RealtimeInvalidation>;
  flushTimer?: ReturnType<typeof setTimeout>;
}

interface RealtimeHubOptions {
  coalesceMs?: number;
  maxCourtTopics?: number;
  maxConsecutiveFailures?: number;
  onDiagnostic?: (diagnostic: RealtimeDiagnostic) => void;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const MARKET_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const VALUE_RE = /^[a-z0-9_]{1,64}$/i;

export function toMarketSlug(value: string | null | undefined): string | null {
  const slug = (value ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return slug && MARKET_RE.test(slug) ? slug : null;
}

export function marketTopic(value: string | null | undefined): RealtimeTopic | null {
  const slug = toMarketSlug(value);
  return slug ? `market:${slug}` : null;
}

export function batchHasResource(
  batch: RealtimeInvalidationBatch,
  resources: readonly string[]
): boolean {
  const wanted = new Set(resources);
  return batch.changes.some((change) => wanted.has(change.resource));
}

/**
 * One lifecycle-aware owner for every Supabase Realtime channel in the app.
 *
 * - every channel is private and authorized by the signed-in user's JWT
 * - duplicate consumers share one physical channel per topic
 * - events are tiny invalidations, coalesced before authoritative refetches
 * - background/hidden apps hold no Realtime channels
 * - repeated subscription failures stop instead of retrying forever
 */
export class RealtimeHub {
  private readonly client: HubClient;
  private readonly userId: string;
  private readonly records = new Map<RealtimeTopic, TopicRecord>();
  private readonly coalesceMs: number;
  private readonly maxCourtTopics: number;
  private readonly maxConsecutiveFailures: number;
  private readonly onDiagnostic?: (diagnostic: RealtimeDiagnostic) => void;
  private active = false;
  private disposed = false;

  constructor(
    client: HubClient,
    userId: string,
    options: RealtimeHubOptions = {}
  ) {
    this.client = client;
    this.userId = userId;
    this.coalesceMs = options.coalesceMs ?? 300;
    this.maxCourtTopics = options.maxCourtTopics ?? 20;
    this.maxConsecutiveFailures = options.maxConsecutiveFailures ?? 3;
    this.onDiagnostic = options.onDiagnostic;
  }

  subscribe(topic: RealtimeTopic, listener: RealtimeListener): () => void {
    if (this.disposed) throw new Error("RealtimeHub is disposed");
    this.assertAllowedTopic(topic);

    let record = this.records.get(topic);
    if (!record) {
      if (topic.startsWith("court:") && this.courtTopicCount() >= this.maxCourtTopics) {
        throw new Error(`Realtime court-topic cap exceeded (${this.maxCourtTopics})`);
      }
      record = {
        topic,
        listeners: new Set(),
        failures: 0,
        pending: new Map(),
      };
      this.records.set(topic, record);
    }

    record.listeners.add(listener);
    if (this.active) this.bind(record);

    let stopped = false;
    return () => {
      if (stopped) return;
      stopped = true;
      const current = this.records.get(topic);
      if (!current) return;
      current.listeners.delete(listener);
      if (current.listeners.size === 0) {
        this.unbind(current);
        this.records.delete(topic);
      }
    };
  }

  setActive(active: boolean): void {
    if (this.disposed || this.active === active) return;
    this.active = active;
    for (const record of this.records.values()) {
      if (active) {
        record.failures = 0;
        this.bind(record);
      } else {
        this.unbind(record);
      }
    }
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.active = false;
    for (const record of this.records.values()) this.unbind(record);
    this.records.clear();
  }

  snapshot(): { active: boolean; desiredTopics: number; connectedTopics: number } {
    let connectedTopics = 0;
    for (const record of this.records.values()) {
      if (record.channel) connectedTopics += 1;
    }
    return {
      active: this.active,
      desiredTopics: this.records.size,
      connectedTopics,
    };
  }

  private bind(record: TopicRecord): void {
    if (!this.active || record.channel || record.listeners.size === 0) return;

    const channel = this.client
      .channel(record.topic, { config: { private: true } })
      .on("broadcast", { event: "invalidate" }, (message) => {
        this.handleMessage(record, message);
      });
    record.channel = channel;

    channel.subscribe((status, error) => {
      if (record.channel !== channel) return;
      if (status === "SUBSCRIBED") {
        record.failures = 0;
        this.report(record.topic, "SUBSCRIBED");
        return;
      }
      if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
        record.failures += 1;
        this.report(record.topic, status, error);
        if (record.failures >= this.maxConsecutiveFailures) {
          this.report(record.topic, "FAILED_CLOSED", error);
          this.unbind(record);
        }
        return;
      }
      if (status === "CLOSED") this.report(record.topic, "CLOSED", error);
    });
  }

  private unbind(record: TopicRecord): void {
    if (record.flushTimer) clearTimeout(record.flushTimer);
    record.flushTimer = undefined;
    record.pending.clear();

    const channel = record.channel;
    record.channel = undefined;
    if (!channel) return;
    try {
      void Promise.resolve(this.client.removeChannel(channel)).catch((error) => {
        this.report(record.topic, "CHANNEL_ERROR", error);
      });
    } catch (error) {
      this.report(record.topic, "CHANNEL_ERROR", error);
    }
  }

  private handleMessage(record: TopicRecord, message: unknown): void {
    const envelope = this.asRecord(message);
    const payload = this.asRecord(envelope?.payload ?? message);
    const resource = payload?.resource;
    const operation = payload?.operation;
    if (
      typeof resource !== "string" ||
      !VALUE_RE.test(resource) ||
      typeof operation !== "string" ||
      !VALUE_RE.test(operation)
    ) {
      this.report(record.topic, "MALFORMED_EVENT");
      return;
    }

    record.pending.set(`${resource}:${operation}`, { resource, operation });
    if (record.flushTimer) return;
    record.flushTimer = setTimeout(() => {
      record.flushTimer = undefined;
      if (!this.active || record.listeners.size === 0) {
        record.pending.clear();
        return;
      }
      const changes = Array.from(record.pending.values());
      record.pending.clear();
      if (changes.length === 0) return;
      const batch: RealtimeInvalidationBatch = { topic: record.topic, changes };
      for (const listener of record.listeners) listener(batch);
    }, this.coalesceMs);
  }

  private assertAllowedTopic(topic: RealtimeTopic): void {
    const split = topic.indexOf(":");
    const scope = topic.slice(0, split) as RealtimeScope;
    const id = topic.slice(split + 1);
    if (scope === "market") {
      if (!MARKET_RE.test(id)) throw new Error(`Invalid Realtime market topic: ${topic}`);
      return;
    }
    if (!UUID_RE.test(id)) throw new Error(`Invalid Realtime UUID topic: ${topic}`);
    if (scope === "user" && id.toLowerCase() !== this.userId.toLowerCase()) {
      throw new Error("A client may subscribe only to its own user topic");
    }
    if (scope !== "court" && scope !== "run" && scope !== "user") {
      throw new Error(`Unsupported Realtime topic: ${topic}`);
    }
  }

  private courtTopicCount(): number {
    let count = 0;
    for (const topic of this.records.keys()) {
      if (topic.startsWith("court:")) count += 1;
    }
    return count;
  }

  private report(
    topic: RealtimeTopic,
    status: RealtimeDiagnostic["status"],
    error?: unknown
  ): void {
    this.onDiagnostic?.({
      topic,
      status,
      error: error instanceof Error ? error.message : error ? String(error) : undefined,
      activeTopics: this.snapshot().connectedTopics,
    });
  }

  private asRecord(value: unknown): Record<string, unknown> | null {
    return value !== null && typeof value === "object"
      ? (value as Record<string, unknown>)
      : null;
  }
}
