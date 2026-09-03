-- Restore the relationship used when Schedule loads runs with an optional
-- official result. This is deliberately limited to the missing link; the
-- broader rating and match-review migrations remain separate.

begin;

alter table public.matches
  add column if not exists run_id uuid;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'matches_run_id_fkey'
      and conrelid = 'public.matches'::regclass
  ) then
    alter table public.matches
      add constraint matches_run_id_fkey
      foreign key (run_id)
      references public.runs(id)
      on delete set null;
  end if;
end
$$;

create unique index if not exists matches_one_result_per_run_idx
  on public.matches (run_id)
  where run_id is not null;

notify pgrst, 'reload schema';

commit;
