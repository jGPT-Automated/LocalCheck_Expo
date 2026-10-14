## Outcome

<!-- What is better for the user? Keep this specific and observable. -->

## Scope

<!-- Important files/contracts changed and intentionally excluded work. -->

## Risk classification

- [ ] JavaScript, styles, or assets only; compatible with installed runtime
- [ ] Native dependency, plugin, permission, entitlement, Expo config, or SDK
- [ ] Supabase migration, RLS, RPC, Realtime, or Edge Function
- [ ] Authentication, privacy, destructive write, or account lifecycle
- [ ] No production release is required

## Verification

### Automated

- [ ] `pnpm check:release`
- [ ] `git diff --check`
- [ ] Focused regression test added or not applicable (explain below)

### Runtime evidence

<!-- Accounts, browser, device, iOS/build, meaningful states, screenshots. -->

- [ ] Browser preview
- [ ] iPhone development build or TestFlight
- [ ] Two to four simultaneous signed-in users where interaction changed
- [ ] Allowed and denied user where authorization changed

## Delivery and recovery

- Migration/function action: <!-- none, exact command/action, order -->
- EAS action: <!-- none, PR preview, production OTA, new TestFlight binary -->
- Rollback/recovery: <!-- exact safe path -->

## Handoff

- Remaining risk or blocker:
- Exact next action:
- Documentation updated in this PR (AGENTS.md "Docs on every push"; CI checks the first two on every push):
  - [ ] `docs/CURRENT_STATE.md` — what changed and what is true now (always)
  - [ ] `docs/SUPABASE.md` — if anything under `supabase/` changed
  - [ ] `docs/product/DECISIONS.md` — if Jesse made a decision
  - [ ] `docs/product/DESIGN.md` — if layout, components or wording rules changed
  - [ ] `docs/product/PRODUCT.md` — if what the app does for players changed
