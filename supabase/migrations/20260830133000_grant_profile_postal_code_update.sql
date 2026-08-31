-- Allow signed-in users to save their own manual ZIP through the existing
-- profiles_update_self row-level security policy.

grant update (postal_code)
  on table public.profiles
  to authenticated;
