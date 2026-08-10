-- Reconstructed from the LocalCheckProd migration ledger on 2026-08-08.
-- This migration is already applied to production. Do not edit it.

-- Schedule's heatmap listens for planned-visit changes; the table was never
-- added to the realtime publication so those events silently never fired.
alter publication supabase_realtime add table public.planned_visits;

