-- Applied to LocalCheckProd (qkrnmyexzvaxiqfxwwfb) on 2026-07-24.
-- Schedule's heatmap listens for planned-visit changes; the table was never
-- added to the realtime publication so those events silently never fired.
alter publication supabase_realtime add table public.planned_visits;
