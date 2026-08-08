-- Reconstructed from the LocalCheckProd migration ledger on 2026-08-08.
-- This migration is already applied to production. Do not edit it.

alter table public.push_tokens
  drop constraint if exists push_tokens_expo_push_token_check;

alter table public.push_tokens
  add constraint push_tokens_expo_push_token_check
  check (expo_push_token ~ '^(Expo|Exponent)PushToken\[[A-Za-z0-9_-]+\]$');

