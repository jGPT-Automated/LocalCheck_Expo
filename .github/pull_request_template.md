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

<!-- Accounts, browser, device, iOS/build, meaningful states. -->

- [ ] Browser preview
- [ ] iPhone development build or TestFlight
- [ ] Two to four simultaneous signed-in users where interaction changed
- [ ] Allowed and denied user where authorization changed

### Visual version history (every frontend PR)

<!-- Use actual screenshots of the rendered app, not design mockups or exports
that were not opened in the browser/device. Keep the baseline and PR head,
route, meaningful state, and viewport the same within each pair. -->

- Baseline commit: <!-- full or unambiguous SHA -->
- PR head commit: <!-- full or unambiguous SHA -->
- Rendered app/browser or device: <!-- include browser/device and build when relevant -->
- Backend isolation: <!-- live test backend, intercepted requests + in-memory fixtures, etc. State whether writes could reach a service. -->
- Remaining limits: <!-- native-only, realtime/RLS, untested states, or none -->

| Route / screen | State and reproducible journey | Viewport (CSS px) | Before: baseline capture | After: PR-head capture | Result |
| --- | --- | ---: | --- | --- | --- |
| <!-- /route --> | <!-- actions and expected result --> | <!-- 375x667, 393x852, 430x932 as applicable --> | <!-- screenshot link --> | <!-- screenshot link --> | <!-- pass / issue --> |

<!-- Include each affected route/state and the sizes where layout or content
can change. Use 375x667, 393x852, and 430x932 where applicable; explain any
omitted size. Capture browser and device evidence separately when both apply.
Record the exact command or steps and concise results for any automated
journey. For a frontend PR with no visible change, explain why this section
does not apply. -->

- Journey command or manual steps and result:
- Evidence folder: `docs/product/design-qa/<date>-<topic>/` (add an entry to [`docs/product/design-qa/README.md`](../docs/product/design-qa/README.md))

## Delivery and recovery

- Migration/function action: <!-- none, exact command/action, order -->
- EAS action: <!-- none, PR preview, production OTA, new TestFlight binary -->
- Rollback/recovery: <!-- exact safe path -->

## Handoff

- Remaining risk or blocker:
- Exact next action:
- Documentation updated in this PR (AGENTS.md "Docs on every push"; CI checks the file-based ones on every push, not whether they're true):
  - [ ] `docs/CURRENT_STATE.md` — what changed and what is true now (always)
  - [ ] `docs/SUPABASE.md` — if anything under `supabase/` changed
  - [ ] `docs/RELEASE.md` — if builds, previews, OTA or native config changed
  - [ ] `docs/GITHUB.md` — if CI or this template changed
  - [ ] `docs/runbooks/REVENUECAT.md` — if purchase code changed
  - [ ] `docs/product/DECISIONS.md` — if Jesse made a decision
  - [ ] `docs/product/DESIGN.md` — if layout, components or wording rules changed
  - [ ] `docs/product/PRODUCT.md` — if what the app does for players changed
