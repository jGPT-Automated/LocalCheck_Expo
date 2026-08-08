-- Reconstructed from the LocalCheckProd migration ledger on 2026-08-08.
-- This migration is already applied to production. Do not edit it.

create index if not exists courts_added_by_index on public.courts (added_by);

