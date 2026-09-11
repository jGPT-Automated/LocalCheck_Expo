-- RevenueCat webhook support for public.subscriptions.
--
-- Target: LocalCheckProd (qkrnmyexzvaxiqfxwwfb), PostgreSQL 17. Additive only.
--
-- One row per user: a person has exactly one LocalPlus lineage at a time (a
-- real purchase, or a promo grant). The unique index makes the webhook's
-- upsert idempotent — the same RevenueCat subscriber always lands on the same
-- row instead of accumulating history rows.
--
-- last_event_ms guards against RevenueCat's webhook delivering events
-- out of order (retries, at-least-once delivery): the webhook only applies an
-- incoming event if it is newer than the last one it wrote for that user.

begin;

set local lock_timeout = '5s';
set local statement_timeout = '60s';

alter table public.subscriptions
  add column if not exists last_event_ms bigint;

comment on column public.subscriptions.last_event_ms is
  'event_timestamp_ms of the last RevenueCat webhook event applied to this row. Older/duplicate events are ignored.';

create unique index if not exists subscriptions_user_id_key
  on public.subscriptions (user_id);

commit;
