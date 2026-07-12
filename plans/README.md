# LocalCheck Advisor Plans

Audit mode: standard improve invocation. Only plan files were created; source code was intentionally left unchanged.

Written against commit: `d08156e`

## Recon summary

- App: React Native / Expo Router mobile app in `artifacts/mobile/`.
- Backend: Supabase project documented in `AGENTS.md` and `docs/SOURCE_OF_TRUTH.md`.
- Package manager: pnpm.
- Primary verification command for app work: `pnpm --filter @workspace/mobile typecheck`.
- Broader verification command: `pnpm typecheck`.
- Important exclusion: do not use or fix `artifacts/mobile/mockup-sandbox/` for app work.

## Recommended execution order

| Priority | Plan | Status | Dependencies | Why first |
|---:|---|---|---|---|
| 1 | [001-wire-game-rpc-and-match-history.md](001-wire-game-rpc-and-match-history.md) | TODO | None | Fixes broken core Log Game write path and match history. |
| 2 | [002-fix-scheduled-game-enums-and-host-run-entry.md](002-fix-scheduled-game-enums-and-host-run-entry.md) | TODO | None | Fixes run persistence and exposes Host a Run. |
| 3 | [003-use-switch-active-checkin-rpc.md](003-use-switch-active-checkin-rpc.md) | TODO | None | Makes court presence atomic and prevents duplicate active check-ins. |
| 4 | [004-replace-random-head-to-head.md](004-replace-random-head-to-head.md) | TODO | Plan 001 recommended | Replaces fake premium stats with deterministic persisted data. |
| 5 | [005-stop-client-writing-is-pro.md](005-stop-client-writing-is-pro.md) | TODO | None | Prevents subscription truth from drifting before real IAP work. |

## Considered and rejected / deferred

- Full push notifications: important, but requires new dependency and schema work; lower leverage than fixing currently broken writes.
- Complete RevenueCat integration: deferred; Plan 005 removes the incorrect client write first.
- Schema migration baseline: important process work, but outside immediate app UX fixes.
- Security-definer view review: needs Supabase advisor/context pass and likely backend ownership.

## Notes for executor agents

- Read root `AGENTS.md` first.
- Never touch deprecated repos or `artifacts/mobile/mockup-sandbox/`.
- Prefer existing Supabase RPCs over raw multi-table writes.
- Do not write `profiles.is_pro` from mobile client code.
- Preserve auth-first behavior; RLS requires authenticated sessions.
