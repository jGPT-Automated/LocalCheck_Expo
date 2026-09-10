-- Harden public.client_errors (from the PR #48 review).
--
--  - drop user_id — crash diagnostics are a code path, not user data. The table
--    is then NOT "data linked to you", and there is no identity to spoof on a
--    direct insert with the public anon key.
--  - authenticated-only insert (revoke anon) — a caller needs a real session, so
--    the "grow the DB without using the app" vector needs a signed-in user.
--  - per-row size caps via CHECK so a direct request can't send huge payloads.
--  - a generous global hourly ceiling (silently drops excess) so the table is
--    useless as a storage-exhaustion target even for a signed-in caller.
--  - carry the EAS update id / channel / runtime so one OTA's crashes are
--    distinguishable from the embedded bundle's or another update's.
--
-- Applied to LocalCheckProd 2026-09-09.

begin;

alter table public.client_errors drop column if exists user_id;

alter table public.client_errors
  add column if not exists update_id text,
  add column if not exists channel text,
  add column if not exists runtime_version text;

alter table public.client_errors
  drop constraint if exists client_errors_len_chk,
  add constraint client_errors_len_chk check (
    char_length(message) <= 2000
    and (error_stack is null or char_length(error_stack) <= 12000)
    and (component_stack is null or char_length(component_stack) <= 12000)
    and (route is null or char_length(route) <= 300)
    and (source is null or char_length(source) <= 40)
    and (platform is null or char_length(platform) <= 16)
    and (app_version is null or char_length(app_version) <= 40)
    and (update_id is null or char_length(update_id) <= 64)
    and (channel is null or char_length(channel) <= 64)
    and (runtime_version is null or char_length(runtime_version) <= 64)
  );

drop policy if exists client_errors_insert on public.client_errors;
create policy client_errors_insert on public.client_errors
  for insert to authenticated with check (true);

revoke insert on public.client_errors from anon;
grant insert on public.client_errors to authenticated;

-- Global hourly ceiling. This table has no identity to key a per-user cap on,
-- and real crash volume for the pilot is a handful/day — 300/hr is generous
-- headroom for legit use and still caps abuse at a trivial size.
create or replace function private.cap_client_errors()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (
    select count(*) from public.client_errors
    where created_at > now() - interval '1 hour'
  ) >= 300 then
    return null;
  end if;
  return new;
end
$$;

drop trigger if exists cap_client_errors on public.client_errors;
create trigger cap_client_errors
  before insert on public.client_errors
  for each row execute function private.cap_client_errors();

commit;
