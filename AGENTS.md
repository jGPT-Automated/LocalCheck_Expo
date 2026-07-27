# LocalCheck agent entry point

Read this file first in every LocalCheck task. The goal is a functional,
great-looking app on Jesse's phone, then App Store submission, sharing, and
growth. Do not let secondary technical cleanup displace that outcome.

## Read order

1. [`docs/CURRENT_STATE.md`](docs/CURRENT_STATE.md) — exact checkpoint, source of truth, priorities, and open acceptance gates.
2. [`docs/product/ACTIVITY_LEDGER.md`](docs/product/ACTIVITY_LEDGER.md) — chronological actions, failures, decisions, and reasons.
3. [`docs/product/LAUNCH_CONTROL.md`](docs/product/LAUNCH_CONTROL.md) — launch burn-down and cross-platform status.
4. [`docs/product/screen-library/releases/ios-1.0.0-build-9/SCREEN_MAP.md`](docs/product/screen-library/releases/ios-1.0.0-build-9/SCREEN_MAP.md) — physical build-9 UI/flow baseline.
5. [`docs/RELEASE_RUNBOOK.md`](docs/RELEASE_RUNBOOK.md) — repeatable Expo → EAS → TestFlight procedure.
6. For UI work, read [`docs/product/DESIGN.md`](docs/product/DESIGN.md) and [`docs/product/DECISIONS.md`](docs/product/DECISIONS.md) before editing.

## Current authority

- **Canonical repo:** `jGPT-Automated/LocalCheck_Expo`, branch `main`.
- **Canonical local folder:** `/Users/JesseH/Projects/LocalCheck_Expo`.
- **Verified checkpoint:** commit `249c926ae3ac`, TestFlight `1.0.0 (9)`, tag `v1.0.4`.
- **Mobile app root:** `artifacts/mobile/`. Run Expo and EAS commands there.
- **EAS project:** `agenticjess-os/localcheck`, project id `9c906173-0258-45a9-a3fe-786cda373c66`.
- **Backend:** Supabase LocalCheckProd `qkrnmyexzvaxiqfxwwfb`.
- **Product/design/launch docs:** `docs/product/` in this repo.
- **Outdated local copies:** `/Users/JesseH/Projects/archive/`. Never implement, build, or release from archive.

The separate web repository's `main` at `7a5b74d03aaa` is imported under
`artifacts/web` as an exact source snapshot plus `UPSTREAM.md`. The old local
`LocalCheck_WEB_PR2` checkout was not main and is archived. The imported web app
still needs dependency/build/preview validation from this parent workspace; do
not copy the old PR branch into product truth.

## Working priorities

1. Keep the build-9 checkpoint reproducible and its docs current.
2. Restore a reliable local mobile preview.
3. Verify the physical Mapbox map: markers, camera stability, styling, selection, and sheet behavior.
4. Complete Supabase Broadcast/private-channel realtime and prove it with two active clients/phones.
5. Repair broken core actions, including Add Friend.
6. Implement the collaboratively approved shared UI system and screen polish.
7. Pass release QA and submit to the App Store.

RPC/advisor/general backend cleanup is not a launch priority unless it blocks a
real user flow, data correctness, security, or App Store review.

## Operating rules

- GitHub `main` is the code truth. Verify local branch, commit, and cleanliness before work.
- Update the activity ledger and affected current-state/design/release doc during every meaningful turn.
- Do not silently choose logos, typography, layouts, or component behavior. UI/UX is a collaborative review session before implementation.
- Do not spawn subagents or separate tasks without Jesse's confirmation.
- Preserve Apple Sign-In and previously working behavior during migrations.
- Never expose secrets. Secret values live in Expo/EAS, Supabase, Mapbox, or the local ignored `.env`.
- Never destructively delete project material. Move outdated material to `/Users/JesseH/Projects/archive/` and record it.
- Completion requires evidence: checks, live preview or physical-device behavior, and release delivery when requested.
- Do not poll long-running release workflows when Jesse says he will report completion.

## Workspace layout

```text
LocalCheck_Expo/
  AGENTS.md                         start here
  README.md                        product/repo overview
  docs/
    CURRENT_STATE.md               exact current checkpoint
    RELEASE_RUNBOOK.md              Expo/TestFlight repeatable flow
    WORKSPACE_MAP.md                active vs archived folders and monorepo direction
    product/                        product, brand, launch, decisions, ledger, screen library
  artifacts/
    mobile/                         shipping Expo app and EAS configuration
    web/                            clean web-main source snapshot; integration validation pending
  lib/                              existing workspace packages/legacy references
```

Expo officially supports apps and shared packages in one workspace. This repo
already has a pnpm workspace over `artifacts/*` and `lib/*`; keep
`artifacts/mobile` stable while EAS uses it as the configured base directory.

## Mobile quick paths

- App code: `artifacts/mobile/app`, `components`, `context`, `services`, `constants`.
- Expo config: `artifacts/mobile/app.json`, `app.config.js`.
- EAS config: `artifacts/mobile/eas.json`.
- OTA workflow: `artifacts/mobile/.eas/workflows/publish-ota-update.yml`.
- iOS/TestFlight workflow: `artifacts/mobile/.eas/workflows/release-ios.yml`.
- Local environment template: `artifacts/mobile/.env.example`; real `.env` is ignored.

## Local preview — read before running

Use this single entrypoint from the canonical repo root:

```bash
./script/start_local_preview.sh
```

Then open `http://127.0.0.1:8081/`. The script deliberately supports both
dependency states:

- With a real canonical dependency install, it runs the normal Expo web live
  server.
- While `node_modules` still links into the archived pre-main checkout, it
  creates a fresh static web export with `script/metro.preview.config.cjs` and
  serves that interactive client locally. This fallback has no hot reload, but
  it uses the canonical app source and ignored LocalCheckProd environment, so it
  can act as the second signed-in client for TestFlight Realtime testing.

The 2026-07-26 disk shortage caused the clean checkout to skip a real install
and link both `node_modules` folders plus `.env` into the archive. The immediate
Metro failure was therefore `EMFILE` while watching that external dependency
tree, not an application-code failure. Do not install Watchman or modify the
default `artifacts/mobile/metro.config.js` merely to preserve that temporary
layout.

The durable repair is still: establish safe disk headroom; move the three links
to `/Users/JesseH/Projects/Delete`; recreate the ignored `.env` locally without
logging its values; install the mobile app and required workspace packages from
the canonical pnpm lockfile; then verify typecheck and normal Expo start. Until
that repair is completed, the checked-in preview script is the documented,
repeatable fallback. TestFlight or a development build remains authoritative
for native Mapbox, Apple Sign-In, SecureStore, and Location behavior.

## Product/data guardrails

- The app is auth-first and uses the one production Supabase project above.
- Do not reintroduce mock/sample product data or global polling.
- Realtime baseline (2026-07-27): LocalCheckProd is private-only and already has scoped private Broadcast topics/triggers. Build 9 still opens rejected public Postgres Changes channels, but the current local candidate consumes private `court:*`, `market:*`, `user:*`, and `run:*` invalidations through one lifecycle-aware hub. It reports subscription status, coalesces authoritative refetches, removes every channel in the background, restores only desired topics on foreground, and passed the first TestFlight-to-browser live check without a tab switch. Do not re-enable public channels or infer checkout from connection state. This is not shipped until Jesse approves a push/release, and two-way/two-phone acceptance remains required.
- A court check-in is durable database state. Never infer checkout from phone lock, app background, socket disconnect, or leaving a screen. The separate 45-minute server auto-checkout is an explicit timer policy, not Realtime presence.
- Treat silent service failures as failures until the actual row/state is verified.
- Schema changes require a migration and documentation.
- The map uses `@rnmapbox/maps`; native dependency/config changes require a new binary, not OTA.

## Documentation rule

Do not create a competing status document. Update the files in the read order.
Historical detail belongs in the ledger or `docs/archive/`, while
`docs/CURRENT_STATE.md` remains short and current.
