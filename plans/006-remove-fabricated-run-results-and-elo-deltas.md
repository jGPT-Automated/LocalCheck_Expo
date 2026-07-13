# Plan 006 — Remove fabricated run results and fake ELO deltas

Written against commit: `3445d36`

## Finding

Two client paths fabricate match/ELO data that was never persisted or computed:

1. The run detail screen has "A WINS" / "B WINS" buttons that call `recordResult()`, which fabricates a `MatchResult` with hardcoded scores (`"21"–"14"` for a win, `"11"–"21"` for a loss) and a flat ±15 ELO delta, then appends it to in-memory match state only. Nothing is written to Supabase; the fake row vanishes on the next `refreshMatches()`.
2. Every real game fetched from Supabase is displayed with `eloDelta: won ? 15 : -15` — a fabricated number. The live `log_game` RPC computes a real K=32 expected-score delta, but it is applied to `profiles.elo_rating` and not stored per game, so the client cannot know the per-game delta. The feed also hardcodes the string `"WON A GAME — +15 ELO"`.

Evidence:
- `artifacts/mobile/app/run/[id].tsx:87-88` — result buttons calling `recordResult(run.id, "A" | "B")`.
- `artifacts/mobile/context/AppContext.tsx:435-480` — `recordResult`, `recordWin`, `recordLoss` with hardcoded scores/delta; `addMatchResult` is their only consumer (`AppContext.tsx:431`).
- `artifacts/mobile/services/gameService.ts:48` — `eloDelta: won ? 15 : -15`.
- `artifacts/mobile/services/feedService.ts:163` — `` `${player.name.toUpperCase()} WON A GAME — +15 ELO` ``.
- `docs/supabase/baseline_snapshot.sql` (`log_game` definition) — real delta computed server-side, returned game row does not include it.

Impact: P1 correctness/trust. Users can "record" a result that never happened with scores nobody entered, and every match row shows an ELO change that is simply false.

Effort: Small/Medium. Risk: Low — removals plus display honesty. Confidence: High.

## Scope

In scope:
- `artifacts/mobile/context/AppContext.tsx` — remove `recordResult`, `recordWin`, `recordLoss`, `addMatchResult` and their context-type entries.
- `artifacts/mobile/app/run/[id].tsx` — remove the fake result buttons; keep the rest of the screen.
- `artifacts/mobile/constants/data.ts` — make `MatchResult.eloDelta` optional (`eloDelta?: number`).
- `artifacts/mobile/services/gameService.ts` — stop fabricating `eloDelta`.
- `artifacts/mobile/services/feedService.ts` — feed message without the fake "+15 ELO".
- `artifacts/mobile/components/MatchRow.tsx`, `artifacts/mobile/app/(tabs)/elo.tsx` — render the delta only when present (show `—` or omit otherwise).

Out of scope:
- Persisting per-game ELO deltas (requires schema change — `games.elo_delta` column or RPC return change).
- Scheduled-game result recording as a product feature (needs backend model; see escape hatch).
- `artifacts/mobile/mockup-sandbox/`.

## Implementation steps

1. In `constants/data.ts`, change `MatchResult.eloDelta: number` to `eloDelta?: number`.
2. In `gameService.ts` `mapGameToMatchResult()`, drop the fabricated `eloDelta` (leave the field unset).
3. In `MatchRow.tsx` and `elo.tsx`'s match detail modal, render the ELO change only when `eloDelta` is a number; otherwise show `—`.
4. In `AppContext.tsx`, delete `recordResult`, `recordWin`, `recordLoss`, `addMatchResult`, their interface entries, and provider wiring.
5. In `app/run/[id].tsx`, remove the "A WINS"/"B WINS" buttons and the `recordResult` import. Real games are logged through Compete → Log Game (`log_game` RPC).
6. In `feedService.ts`, change the game feed message to state the score (e.g. `X WON 21–14 AT <court>`) using the real `score_a`/`score_b` values — no ELO claim.

## Verification gates

1. `pnpm --filter @workspace/mobile typecheck` — expected exit 0.
2. `rg -n "recordResult|recordWin|recordLoss|addMatchResult" artifacts/mobile -g '!mockup-sandbox/**'` — no matches.
3. `rg -n "15" artifacts/mobile/services/gameService.ts` — no fabricated delta remains.
4. Manual: open ELO tab, match rows render without invented +15/−15; run detail screen shows no result buttons.

## Done criteria

- No client code fabricates match results or ELO deltas.
- Match UI renders honestly when the delta is unknown.
- Typecheck passes.

## Escape hatches

STOP and report back if product wants per-game ELO deltas displayed — that needs a `games.elo_delta` column (or equivalent) written by `log_game`, a backend change out of client scope. STOP if product wants scheduled-run result recording — that needs a real server-side model, not fabricated client rows.
