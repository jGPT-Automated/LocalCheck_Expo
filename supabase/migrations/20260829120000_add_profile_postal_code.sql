-- Manual location fallback for users who cannot or do not share device GPS.
-- The selected local court remains profiles.local_court_id; this postal code
-- narrows court discovery and is never treated as a live device position.

alter table public.profiles
  add column if not exists postal_code text;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'profiles_postal_code_format'
      and conrelid = 'public.profiles'::regclass
  ) then
    alter table public.profiles
      add constraint profiles_postal_code_format
      check (postal_code is null or postal_code ~ '^[0-9]{5}$');
  end if;
end
$$;

comment on column public.profiles.postal_code is
  'Optional five-digit manual location used to narrow court selection when GPS is unavailable or disabled.';
