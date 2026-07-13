# Plan 007 — Stop displaying fabricated court attributes

Written against commit: `3445d36`

## Finding

`courtService.mapRow()` invents court attributes the live database does not have, and the UI presents them as real data: every court shows `rating: 4.0`, `maxCapacity: 10`, `surface: "ASPHALT"`, `lights: false`, `covered: false`, `localCount: 0`. The live `courts` table has none of these columns (see `docs/supabase/baseline_snapshot.sql` — `courts` has name/address/coords/sport_type/image_url and nothing else attribute-like).

Evidence:
- `artifacts/mobile/services/courtService.ts:45-54` — hardcoded `maxCapacity: 10`, `rating: 4.0`, `surface: "ASPHALT"`, `localCount: 0`.
- `artifacts/mobile/components/CourtBottomSheet.tsx:71` — occupancy % derived from the invented `maxCapacity`; `:125` — `<StatBlock value={court.rating} label="Rating" />`; `:160` — surface tag; `:169` — "N LOCALS" from the constant `localCount: 0`.
- `artifacts/mobile/components/CourtListItem.tsx:43` — surface label.

Impact: P2 correctness/trust. Every court shows the identical fake "4 stars, asphalt, max 10" card regardless of reality.

Effort: Small/Medium. Risk: Low — display-layer honesty; no writes involved. Confidence: High.

## Scope

In scope:
- `artifacts/mobile/services/courtService.ts` — stop inventing values; leave optional fields unset.
- `artifacts/mobile/constants/data.ts` — make `rating`, `maxCapacity`, `surface`, `localCount` optional on `Court` (keep `lights`/`covered` optional booleans).
- `artifacts/mobile/components/CourtBottomSheet.tsx`, `CourtListItem.tsx`, `HomeScreen.tsx`, `app/court/[id].tsx` — render attribute rows/tags only when data exists; use real stats (`activeCount`, `ratingCount` = total check-ins) where available.

Out of scope:
- Adding court attribute columns to the database (schema/product decision).
- `AddCourtModal` flow beyond type compatibility (user-entered values may legitimately populate these fields).
- `artifacts/mobile/mockup-sandbox/`.

## Implementation steps

1. In `constants/data.ts`, make `rating`, `ratingCount`, `maxCapacity`, `surface`, `lights`, `covered`, `localCount` optional on `Court`.
2. In `courtService.ts` `mapRow()`, remove the invented literals; keep `activeCount` (real, from `courts_with_stats`) and map `total_check_ins` to a clearly-named real stat.
3. In `CourtBottomSheet.tsx`: replace the "Rating" stat with a real stat (total check-ins as "VISITS"); render capacity/occupancy only if `maxCapacity` exists; render surface/lights tags and "N LOCALS" only when values exist.
4. In `CourtListItem.tsx`, render the surface label only when present.
5. In `HomeScreen.tsx` and `app/court/[id].tsx`, filter `courtDetails` rows to those with real values instead of defaulting.
6. Keep all styles/design tokens as-is; only conditional rendering changes.

## Verification gates

1. `pnpm --filter @workspace/mobile typecheck` — expected exit 0.
2. `rg -n "rating: 4|maxCapacity: 10|\"ASPHALT\"" artifacts/mobile/services` — no matches.
3. Manual: open a court bottom sheet — no fabricated rating/surface/max-capacity appears; real check-in counts still render.

## Done criteria

- `courtService.ts` maps only columns that exist in the live schema.
- No screen displays an invented court attribute.
- Typecheck passes.

## Escape hatches

STOP and report back if product wants real court attributes (surface, lights, capacity, ratings) — that requires schema additions and a data-entry/verification flow, not client-side constants.
