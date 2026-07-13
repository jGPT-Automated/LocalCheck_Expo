-- Applied to project jzclwnzcektqhgkkdeje on 2026-07-13 via Supabase MCP
-- (also recorded in the project's supabase_migrations history).
--
-- Planned presence ("pulling up"): a user posts times they plan to be at a
-- court so others can see who's coming before they head over. Lightweight —
-- not a hosted run: no title, no capacity, no RSVP. One row per user/court/time.

create table public.planned_visits (
  id uuid not null default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  court_id uuid not null references public.courts(id) on delete cascade,
  planned_at timestamptz not null,
  note text check (note is null or char_length(note) <= 280),
  created_at timestamptz not null default now(),
  constraint planned_visits_pkey primary key (id),
  constraint planned_visits_unique unique (user_id, court_id, planned_at)
);

create index planned_visits_planned_at_idx on public.planned_visits (planned_at);
create index planned_visits_court_time_idx on public.planned_visits (court_id, planned_at);

alter table public.planned_visits enable row level security;

create policy planned_visits_select_authenticated
  on public.planned_visits for select
  to authenticated
  using (true);

create policy planned_visits_insert_self
  on public.planned_visits for insert
  to authenticated
  with check (user_id = (select auth.uid()));

create policy planned_visits_delete_self
  on public.planned_visits for delete
  to authenticated
  using (user_id = (select auth.uid()));
