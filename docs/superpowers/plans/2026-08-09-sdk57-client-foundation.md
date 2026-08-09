# SDK 57 Client Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use
> `superpowers:subagent-driven-development` (recommended) or
> `superpowers:executing-plans` to implement this plan task-by-task. Check off
> each step only after its command and evidence pass.

**Goal:** Replace the SDK 54 client foundation with a clean SDK 57 client in the
existing LocalCheck repository and existing Apple, Expo/EAS, and Supabase
product identities, then prove a reusable card, drawer, and transition system
before feature migration begins.

**Architecture:** The replacement is built on a feature branch/worktree from
the merged lifecycle reset. The official SDK 57 template is generated only as
a disposable reference. Tracked SDK 54 frontend source is replaced in this
repository, while Git history, `supabase/`, product documentation, assets, and
deployment identity remain intact. Routes under `src/app/` are thin; features
use typed services, TanStack Query, and approved Supabase RPCs. No second Expo
project, Apple app, or backend is created.

**Tech stack:** Expo SDK 57, React Native 0.86, React 19.2, Expo Router,
TypeScript 6 strict mode, NativeWind 4.2.6, Tailwind CSS 3, Reanimated, React
Native Gesture Handler, `@gorhom/bottom-sheet`, TanStack Query, typed Supabase,
pnpm, Node 22, GitHub Actions, EAS development builds.

**Primary references:** [official SDK 57 template command](https://docs.expo.dev/more/create-expo/),
[Expo SDK upgrade workflow](https://docs.expo.dev/workflow/upgrading-expo-sdk-walkthrough/),
[runtime fingerprint policy](https://docs.expo.dev/eas-update/runtime-versions/),
[EAS build configuration](https://docs.expo.dev/build-reference/build-configuration/),
[NativeWind 4 Expo installation](https://www.nativewind.dev/docs/getting-started/installation),
and [Supabase logical backups](https://supabase.com/docs/guides/platform/backups).

---

## Global constraints

- Do not run `eas init`, change the EAS project, create a second App Store
  Connect record, or create a second production backend.
- Preserve these invariants and fail CI if they drift:
  - bundle/package identifier: `com.realjess.localcheck`
  - Expo owner/slug: `agenticjess-os/localcheck`
  - EAS project ID: `9c906173-0258-45a9-a3fe-786cda373c66`
  - updates URL:
    `https://u.expo.dev/9c906173-0258-45a9-a3fe-786cda373c66`
  - URL scheme: `localcheck`
  - App Store Connect app ID: `6786909608`
  - Apple team ID: `6HHLJVQC6W`
  - Supabase production ref: `qkrnmyexzvaxiqfxwwfb`
- The installed SDK 54 TestFlight build stays live and recoverable throughout
  this branch. Do not publish an OTA to its production channel.
- Do not change production schema during this foundation plan. Generate types
  from production, but make no migrations or remote mutations.
- Keep the backend compatible with the installed client throughout later
  vertical-slice migration.
- Do not port client-side profile provisioning, `profiles.email`, sport-specific
  ELO columns, local product state, or the incorrect notification preference
  path. Server triggers and approved RPCs own durable behavior.
- Do not pause the production Supabase project for this code-only rebuild.
- Use `apply_patch` for tracked file changes. Git history is the old-client
  archive; do not add a duplicate `legacy/` frontend.
- The gooey FAB and Skia are outside this foundation. First prove reusable
  cards, drawers/sheets, and transitions.

## Task 0: Start from the authoritative branch

**Files:** None.

- [ ] In the browser, confirm the lifecycle-reset PR is merged and all required
      conversations/checks are resolved.

  PR: <https://github.com/jGPT-Automated/LocalCheck_Expo/pull/27>

- [ ] Refresh the canonical checkout and create a dedicated worktree.

  ```bash
  cd /Users/jesseharrick/Documents/LocalCheck_Expo
  git fetch origin
  git status --short --branch
  git switch main
  git pull --ff-only
  git worktree add ../LocalCheck_SDK57 -b codex/sdk57-client-foundation main
  cd ../LocalCheck_SDK57
  ```

- [ ] Confirm the worktree is authoritative and clean.

  ```bash
  git remote -v
  git status --short --branch
  git log -1 --oneline
  ```

  Expected: `origin` is `jGPT-Automated/LocalCheck_Expo`, the branch is
  `codex/sdk57-client-foundation`, and there are no uncommitted files.

## Task 1: Turn product identity into an executable guardrail

**Files:**

- Create: `scripts/verify-product-identity.mjs`
- Create: `scripts/verify-product-identity.test.mjs`
- Modify: `package.json`

- [ ] Write the failing identity-validator test first.

  ```js
  // scripts/verify-product-identity.test.mjs
  import assert from "node:assert/strict";
  import test from "node:test";
  import {
    EXPECTED_PRODUCT_IDENTITY,
    validateProductIdentity,
  } from "./verify-product-identity.mjs";

  const validInput = {
    app: {
      expo: {
        owner: "agenticjess-os",
        slug: "localcheck",
        scheme: "localcheck",
        ios: { bundleIdentifier: "com.realjess.localcheck" },
        android: { package: "com.realjess.localcheck" },
        extra: {
          eas: { projectId: "9c906173-0258-45a9-a3fe-786cda373c66" },
        },
        updates: {
          url: "https://u.expo.dev/9c906173-0258-45a9-a3fe-786cda373c66",
        },
      },
    },
    eas: {
      submit: {
        production: {
          ios: { appleTeamId: "6HHLJVQC6W", ascAppId: "6786909608" },
        },
      },
    },
    envExample: [
      "EXPO_PUBLIC_SUPABASE_URL=",
      "EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY=",
    ].join("\n"),
  };

  test("accepts LocalCheck's preserved product identity", () => {
    assert.deepEqual(validateProductIdentity(validInput), []);
    assert.equal(
      EXPECTED_PRODUCT_IDENTITY.easProjectId,
      "9c906173-0258-45a9-a3fe-786cda373c66",
    );
  });

  test("reports every changed product identity field", () => {
    const changed = structuredClone(validInput);
    changed.app.expo.ios.bundleIdentifier = "com.example.newapp";
    changed.app.expo.extra.eas.projectId = "different-project";

    assert.deepEqual(validateProductIdentity(changed), [
      "expo.ios.bundleIdentifier must remain com.realjess.localcheck",
      "expo.extra.eas.projectId must remain 9c906173-0258-45a9-a3fe-786cda373c66",
    ]);
  });
  ```

- [ ] Run the test and verify it fails because the module does not exist.

  ```bash
  node --test scripts/verify-product-identity.test.mjs
  ```

  Expected: `ERR_MODULE_NOT_FOUND`.

- [ ] Implement the validator as a pure function plus a CLI entry point. Keep
      the expected values in this one module and compare all invariants listed
      under Global constraints. Parse `app.json`, `eas.json`, and
      `.env.example`; print every error and exit nonzero on drift.

  ```js
  // scripts/verify-product-identity.mjs
  import fs from "node:fs";
  import path from "node:path";
  import { pathToFileURL } from "node:url";

  export const EXPECTED_PRODUCT_IDENTITY = Object.freeze({
    owner: "agenticjess-os",
    slug: "localcheck",
    scheme: "localcheck",
    bundleIdentifier: "com.realjess.localcheck",
    easProjectId: "9c906173-0258-45a9-a3fe-786cda373c66",
    updatesUrl: "https://u.expo.dev/9c906173-0258-45a9-a3fe-786cda373c66",
    appleTeamId: "6HHLJVQC6W",
    ascAppId: "6786909608",
  });

  export function validateProductIdentity({ app, eas, envExample }) {
    const errors = [];
    const expo = app.expo ?? {};
    const expected = EXPECTED_PRODUCT_IDENTITY;
    const checks = [
      ["expo.owner", expo.owner, expected.owner],
      ["expo.slug", expo.slug, expected.slug],
      ["expo.scheme", expo.scheme, expected.scheme],
      ["expo.ios.bundleIdentifier", expo.ios?.bundleIdentifier, expected.bundleIdentifier],
      ["expo.android.package", expo.android?.package, expected.bundleIdentifier],
      ["expo.extra.eas.projectId", expo.extra?.eas?.projectId, expected.easProjectId],
      ["expo.updates.url", expo.updates?.url, expected.updatesUrl],
      ["eas.submit.production.ios.appleTeamId", eas.submit?.production?.ios?.appleTeamId, expected.appleTeamId],
      ["eas.submit.production.ios.ascAppId", eas.submit?.production?.ios?.ascAppId, expected.ascAppId],
    ];

    for (const [label, actual, required] of checks) {
      if (actual !== required) errors.push(`${label} must remain ${required}`);
    }

    for (const name of [
      "EXPO_PUBLIC_SUPABASE_URL",
      "EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
    ]) {
      if (!envExample.includes(`${name}=`)) errors.push(`.env.example must declare ${name}`);
    }

    return errors;
  }

  function readJson(file) {
    return JSON.parse(fs.readFileSync(file, "utf8"));
  }

  if (import.meta.url === pathToFileURL(process.argv[1]).href) {
    const root = process.cwd();
    const errors = validateProductIdentity({
      app: readJson(path.join(root, "app.json")),
      eas: readJson(path.join(root, "eas.json")),
      envExample: fs.readFileSync(path.join(root, ".env.example"), "utf8"),
    });
    if (errors.length) {
      for (const error of errors) console.error(`- ${error}`);
      process.exitCode = 1;
    } else {
      console.log("LocalCheck product identity verified.");
    }
  }
  ```

- [ ] Add these scripts to `package.json`:

  ```json
  {
    "scripts": {
      "test:identity": "node --test scripts/verify-product-identity.test.mjs",
      "verify:identity": "node scripts/verify-product-identity.mjs"
    }
  }
  ```

- [ ] Run the focused tests and guardrail.

  ```bash
  pnpm test:identity
  pnpm verify:identity
  ```

  Expected: both pass.

- [ ] Commit the identity gate.

  ```bash
  git add scripts/verify-product-identity.mjs scripts/verify-product-identity.test.mjs package.json
  git commit -m "test: guard LocalCheck product identity"
  ```

## Task 2: Replace the client baseline with the official SDK 57 shape

**Files:**

- Modify: `package.json`
- Modify: `pnpm-lock.yaml`
- Modify: `app.json`
- Modify: `eas.json`
- Modify: `babel.config.js`
- Modify: `metro.config.js`
- Modify: `tsconfig.json`
- Create: `src/app/_layout.tsx`
- Create: `src/app/index.tsx`
- Create: `src/app/+not-found.tsx`
- Create: `src/global.css`
- Delete: tracked SDK 54 frontend files under `app/`, `components/`,
  `constants/`, `context/`, `lib/`, and `services/`

- [ ] Generate a disposable official reference outside the repository. Never
      run EAS commands in the reference directory.

  ```bash
  npm_config_cache=/private/tmp/localcheck-npm-cache \
    npx create-expo-app@latest /private/tmp/localcheck-sdk57-reference \
    --template default@sdk-57 --no-install --yes
  ```

- [ ] Compare its package, Router, Metro, Babel, TypeScript, and `src/app`
      conventions. Record any deviation needed for LocalCheck in the PR; do not
      copy sample screens or sample branding.

  ```bash
  diff -u /private/tmp/localcheck-sdk57-reference/package.json package.json || true
  find /private/tmp/localcheck-sdk57-reference -maxdepth 3 -type f | sort
  ```

- [ ] Use `apply_patch` to delete the tracked SDK 54 frontend source listed
      above. Do not delete `supabase/`, `docs/`, `.github/`, `assets/brand/`,
      `.env.example`, product-identity config, or scripts unrelated to the old
      UI. Git history is the recovery path.

- [ ] Set the SDK foundation to the official compatible core versions:

  ```json
  {
    "dependencies": {
      "expo": "~57.0.11",
      "expo-router": "~57.0.11",
      "react": "19.2.3",
      "react-dom": "19.2.3",
      "react-native": "0.86.2",
      "react-native-gesture-handler": "~2.32.0",
      "react-native-reanimated": "4.5.1",
      "react-native-safe-area-context": "~5.7.0",
      "react-native-screens": "~4.26.0",
      "react-native-web": "~0.21.2",
      "react-native-worklets": "0.10.1"
    },
    "devDependencies": {
      "typescript": "~6.0.3"
    }
  }
  ```

  Retain `@supabase/supabase-js`, TanStack Query, Bottom Sheet, Mapbox, Apple
  authentication, SecureStore, Location, Notifications, Updates, Linking, and
  other product-required modules. Install Expo-owned modules with
  `pnpm exec expo install ...` so SDK 57 selects compatible versions. Do not add
  Skia or NativeWind v5.

- [ ] Preserve every identity field in `app.json`. Replace the legacy `splash`
      object with the SDK 57 `expo-splash-screen` config plugin and retain
      `assets/images/splash-icon.png` until branded splash assets are approved.
      Change the runtime policy to `fingerprint` before the first SDK 57 build:

  ```json
  {
    "expo": {
      "owner": "agenticjess-os",
      "slug": "localcheck",
      "scheme": "localcheck",
      "ios": { "bundleIdentifier": "com.realjess.localcheck" },
      "android": { "package": "com.realjess.localcheck" },
      "extra": {
        "eas": { "projectId": "9c906173-0258-45a9-a3fe-786cda373c66" }
      },
      "updates": {
        "url": "https://u.expo.dev/9c906173-0258-45a9-a3fe-786cda373c66"
      },
      "runtimeVersion": { "policy": "fingerprint" }
    }
  }
  ```

- [ ] Add a minimal Router shell under `src/app/` with a root `View` using
      `flex: 1`; do not use a root `ScrollView`.

  ```tsx
  // src/app/_layout.tsx
  import "../global.css";
  import { Stack } from "expo-router";
  import { GestureHandlerRootView } from "react-native-gesture-handler";

  export default function RootLayout() {
    return (
      <GestureHandlerRootView style={{ flex: 1 }}>
        <Stack screenOptions={{ headerShown: false }} />
      </GestureHandlerRootView>
    );
  }
  ```

- [ ] Install and normalize dependency versions.

  ```bash
  pnpm install
  pnpm exec expo install --fix
  pnpm install
  ```

- [ ] Verify identity before any native build.

  ```bash
  pnpm verify:identity
  pnpm exec expo config --type public
  pnpm exec expo-doctor
  pnpm typecheck
  pnpm export:web
  ```

  Expected: all commands pass; the public config contains the preserved bundle
  identifier and EAS project ID.

- [ ] Commit the fresh SDK 57 baseline.

  ```bash
  git add -A
  git commit -m "feat: establish clean Expo SDK 57 client"
  ```

## Task 3: Generate and enforce the live Supabase contract

**Files:**

- Create: `src/lib/supabase/database.types.ts`
- Create: `src/lib/supabase/schema-contract.test.mts`
- Create: `src/lib/supabase/client.ts`
- Modify: `package.json`
- Modify: `docs/SUPABASE.md`

- [ ] Generate TypeScript types from production ref
      `qkrnmyexzvaxiqfxwwfb` using the authenticated Supabase CLI or the
      Supabase management connector. This is read-only.

  ```bash
  supabase gen types typescript --project-id qkrnmyexzvaxiqfxwwfb \
    --schema public > /private/tmp/localcheck-database.types.ts
  ```

  Review the generated file, then add it using `apply_patch` or an approved
  mechanical copy. Do not hand-author the schema.

- [ ] Add a focused contract test that reads the generated file and asserts:
      expected combined fields and important RPC names exist; phantom profile
      and sport-specific metrics do not.

  ```ts
  // src/lib/supabase/schema-contract.test.mts
  import assert from "node:assert/strict";
  import fs from "node:fs";
  import test from "node:test";

  const source = fs.readFileSync(
    new URL("./database.types.ts", import.meta.url),
    "utf8",
  );

  test("generated production contract contains authoritative metrics and RPCs", () => {
    for (const token of ["elo_rating", "wins", "losses", "check_in_to_court", "submit_match_result"]) {
      assert.match(source, new RegExp(`\\b${token}\\b`));
    }
  });

  test("generated profile contract does not restore phantom fields", () => {
    for (const token of ["pickleball_elo", "basketball_wins", "profiles.email"]) {
      assert.doesNotMatch(source, new RegExp(token.replace(".", "\\.")));
    }
  });
  ```

- [ ] Add `test:schema-contract` to `package.json` and include it in `test`.

- [ ] Create one typed Supabase client. Use only these environment names:
      `EXPO_PUBLIC_SUPABASE_URL` and
      `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY`. The auth session adapter may use
      SecureStore on native and browser storage on web; no other product data
      is persisted.

- [ ] Update `docs/SUPABASE.md` with the verified current constraints:
      production is authoritative; `delete-account` is the only deployed Edge
      Function; physical push delivery is not yet complete; there is no
      application Storage bucket; profile provisioning is server-owned; and
      `court_planned_times` is authenticated-only. Do not copy the external
      audit wholesale into the repository.

- [ ] Run contract and type checks.

  ```bash
  pnpm test:schema-contract
  pnpm typecheck
  pnpm verify:identity
  ```

- [ ] Commit the typed backend boundary.

  ```bash
  git add src/lib/supabase package.json docs/SUPABASE.md
  git commit -m "feat: bind client to verified Supabase contract"
  ```

## Task 4: Add the NativeWind 4 foundation and semantic tokens

**Files:**

- Modify: `package.json`
- Modify: `pnpm-lock.yaml`
- Modify: `babel.config.js`
- Modify: `metro.config.js`
- Modify: `src/global.css`
- Create: `tailwind.config.js`
- Create: `nativewind-env.d.ts`
- Create: `src/theme/tokens.ts`
- Create: `src/theme/motion.ts`

- [ ] Install the production-stable styling foundation.

  ```bash
  pnpm add nativewind@4.2.6
  pnpm add -D tailwindcss@3.4.17
  ```

- [ ] Follow the NativeWind 4 Expo setup exactly: content paths include
      `./src/**/*.{js,jsx,ts,tsx}`; `src/global.css` contains Tailwind layers;
      Metro uses `withNativeWind`; Babel uses the NativeWind preset required by
      4.2.6. Keep the official SDK 57 Reanimated configuration intact.

- [ ] Define semantic tokens, not feature-specific hex values:

  ```ts
  // src/theme/tokens.ts
  export const colors = {
    canvas: "#0B0D10",
    surface: "#15191F",
    surfaceElevated: "#1D232B",
    text: "#F7F8FA",
    textMuted: "#9AA4B2",
    accent: "#FF6A2A",
    border: "#2A323D",
    danger: "#FF5A66",
  } as const;

  export const spacing = { xs: 4, sm: 8, md: 16, lg: 24, xl: 32 } as const;
  export const radii = { sm: 10, md: 16, lg: 24, full: 999 } as const;
  ```

  Reconcile final values with `docs/product/DESIGN.md`; the example is a shape,
  not permission to invent a second palette.

- [ ] Verify CSS/class resolution on native and web with a temporary probe in
      `src/app/index.tsx`, then keep only the reusable tokenized implementation.

  ```bash
  pnpm typecheck
  pnpm export:web
  pnpm exec expo-doctor
  ```

- [ ] Commit the styling foundation.

  ```bash
  git add package.json pnpm-lock.yaml babel.config.js metro.config.js \
    tailwind.config.js nativewind-env.d.ts src/global.css src/theme
  git commit -m "feat: add NativeWind design foundation"
  ```

## Task 5: Build the first reusable UI system and component gallery

**Files:**

- Create: `src/components/ui/AppText.tsx`
- Create: `src/components/ui/Button.tsx`
- Create: `src/components/ui/Card.tsx`
- Create: `src/components/ui/Screen.tsx`
- Create: `src/components/ui/AppDrawer.tsx`
- Create: `src/components/ui/MotionScreen.tsx`
- Create: `src/components/ui/ui-contract.test.mts`
- Create: `src/features/dev/ComponentGalleryScreen.tsx`
- Create: `src/app/component-gallery.tsx`
- Modify: `src/app/_layout.tsx`
- Modify: `package.json`

- [ ] Write a failing source contract test that protects the layout rules:
      `Screen` must use `SafeAreaView`/`View` with `flex: 1`; a root
      `ScrollView` is rejected; repeated gallery examples must use a list or
      bounded inner scroll container.

- [ ] Implement `Screen` with fixed-root and explicit scroll modes:

  ```tsx
  type ScreenProps = PropsWithChildren<{
    scroll?: boolean;
    className?: string;
  }>;

  export function Screen({ children, scroll = false, className }: ScreenProps) {
    return (
      <SafeAreaView className={cn("flex-1 bg-canvas", className)}>
        {scroll ? (
          <ScrollView contentContainerClassName="grow px-4 py-3">
            {children}
          </ScrollView>
        ) : (
          <View className="flex-1 px-4 py-3">{children}</View>
        )}
      </SafeAreaView>
    );
  }
  ```

- [ ] Implement accessible variants for `Card`, `Button`, and `AppText`. Keep
      the public props semantic (`tone`, `size`, `emphasis`) and hide raw
      third-party implementation details.

- [ ] Implement `AppDrawer` behind the LocalCheck API using
      `@gorhom/bottom-sheet`. The gallery must prove open, close, backdrop,
      swipe dismissal, keyboard interaction, safe-area padding, and reduced
      motion.

- [ ] Implement `MotionScreen` and Router stack transitions with a calm default
      and a reduced-motion path. Do not add decorative animation to every
      element.

- [ ] Build a development-only gallery showing:
      default/pressed/disabled/loading/error cards and buttons; short and long
      content; drawer states; transition forward/back; light/dark/system
      appearance; and dynamic text sizing. In production, the route must return
      `+not-found` or redirect safely.

- [ ] Run the component contract, typecheck, and web export.

  ```bash
  pnpm test:ui-contract
  pnpm typecheck
  pnpm export:web
  ```

- [ ] Start web preview and record screenshots at phone and desktop widths.

  ```bash
  pnpm start:web
  ```

- [ ] Commit the first reusable component system.

  ```bash
  git add src/components src/features/dev src/app package.json
  git commit -m "feat: add reusable cards drawers and transitions"
  ```

## Task 6: Establish providers, auth ownership, and Realtime invalidation

**Files:**

- Create: `src/app/providers.tsx`
- Create: `src/features/auth/auth-state.ts`
- Create: `src/features/auth/auth-state.test.mts`
- Create: `src/features/auth/AuthProvider.tsx`
- Create: `src/data/query-client.ts`
- Create: `src/data/query-keys.ts`
- Create: `src/realtime/realtime-hub.ts`
- Create: `src/realtime/realtime-hub.test.mts`
- Modify: `src/app/_layout.tsx`
- Modify: `package.json`

- [ ] Write pure auth-state tests for signed-out, restoring, signed-in, and
      recoverable session failure. Assert there is no client fallback insert
      into `profiles`; server triggers own provisioning.

- [ ] Implement one `AuthProvider` that owns only session lifecycle. Feature
      data must not enter auth context.

- [ ] Add a stable QueryClient and centralized query-key factory.

- [ ] Port the existing scoped Realtime behavior into a small subscription
      registry. Write tests first for one physical subscription per topic,
      multiple listeners, cleanup after the last listener, and invalidation of
      the correct query keys. Realtime signals refetch; it never becomes a
      second product-state store.

- [ ] Compose root providers in this order: Gesture Handler, safe area, query
      client, auth, Realtime lifetime, Router stack, error boundary.

- [ ] Run all foundation checks.

  ```bash
  pnpm test
  pnpm typecheck
  pnpm verify:identity
  pnpm export:web
  ```

- [ ] Commit the state foundation.

  ```bash
  git add src/app src/features/auth src/data src/realtime package.json
  git commit -m "feat: establish typed client state boundaries"
  ```

## Task 7: Make the foundation a required CI gate

**Files:**

- Modify: `.github/workflows/ci.yml`
- Modify: `.github/pull_request_template.md`
- Modify: `package.json`
- Modify: `scripts/doctor.sh`
- Modify: `docs/CURRENT_STATE.md`
- Modify: `docs/ARCHITECTURE.md`
- Modify: `docs/DEVELOPMENT.md`
- Modify: `docs/TESTING.md`
- Modify: `docs/RELEASE.md`

- [ ] Define the local aggregate commands:

  ```json
  {
    "scripts": {
      "check": "pnpm verify:identity && pnpm typecheck && pnpm test",
      "check:foundation": "pnpm doctor && pnpm check && pnpm export:web"
    }
  }
  ```

- [ ] Update CI so `quality` performs frozen install, product identity,
      Expo Doctor, TypeScript, all unit/contract tests, and production web
      export. Keep placeholder public environment values and least-privilege
      permissions; do not add production secrets.

- [ ] Update the PR template with a mandatory identity-verification result and
      SDK/native-build classification. Preserve browser, registered iPhone,
      simultaneous-user, backend, rollback, and handoff evidence sections.

- [ ] Update authority documentation to say exactly what now exists. Mark all
      vertical slices as pending; do not describe the SDK 57 foundation as a
      production release.

- [ ] Run the same commands CI will run.

  ```bash
  pnpm install --frozen-lockfile
  pnpm check:foundation
  git diff --check
  ```

- [ ] Commit CI and authority documentation.

  ```bash
  git add .github package.json scripts/doctor.sh docs
  git commit -m "ci: require SDK 57 foundation checks"
  ```

## Task 8: Produce a development build without touching production

**Files:**

- Modify: `eas.json`
- Modify: `docs/CURRENT_STATE.md`
- Modify: `docs/TESTING.md`
- Modify: `docs/RELEASE.md`

- [ ] Keep the `development` profile and production submit mapping unchanged.
      Change only its update channel to `sdk57-rebuild-development`; retain
      `developmentClient: true`, `distribution: internal`, registered-device
      provisioning, and the SDK 57-compatible EAS image. Do not reuse the
      production update channel.

- [ ] Inspect resolved native configuration before spending a build credit.

  ```bash
  pnpm verify:identity
  pnpm exec expo config --type public
  pnpm exec eas config --platform ios --profile development
  ```

- [ ] Only after explicit authorization, create the existing app's development
      build. This creates a new binary for the same bundle/EAS project; it does
      not create a second product.

  ```bash
  pnpm exec eas build --platform ios --profile development --non-interactive
  ```

- [ ] Install on the registered iPhone and verify: launch/static splash,
      development client connection, component gallery, card states, drawer
      gesture/backdrop/keyboard, transitions, safe areas, dark appearance,
      larger text, and reduced motion.

- [ ] Run the browser check at the same commit and attach both sets of evidence
      to the draft PR.

- [ ] Record the build URL and results in authority docs, then commit.

  ```bash
  git add eas.json docs/CURRENT_STATE.md docs/TESTING.md docs/RELEASE.md
  git commit -m "build: verify SDK 57 foundation on iPhone"
  ```

## Task 9: Open the foundation PR and stop before feature migration

**Files:** None beyond PR metadata.

- [ ] Rebase on current `main` and rerun the full gate.

  ```bash
  git fetch origin
  git rebase origin/main
  pnpm install --frozen-lockfile
  pnpm check:foundation
  git status --short --branch
  ```

- [ ] Push and open a draft PR.

  ```bash
  git push -u origin codex/sdk57-client-foundation
  gh pr create --draft \
    --base main \
    --head codex/sdk57-client-foundation \
    --title "Replace client foundation with Expo SDK 57" \
    --body-file .github/pull_request_template.md
  ```

- [ ] Fill in the PR template with actual outcomes and URLs. Do not check boxes
      for tests that did not run.

- [ ] Stop here for review. Do not begin vertical slices until CI passes, the
      registered-iPhone foundation is accepted, and review conversations are
      resolved.

## Foundation completion criteria

- SDK 57, React Native 0.86, React 19.2, and TypeScript 6 resolve from the lock.
- Product identity verification passes locally and in CI.
- Expo Doctor, typecheck, tests, and production web export pass.
- Production types are generated and stale client schema assumptions are
  rejected.
- Root screens follow the fixed flex/safe-area contract.
- NativeWind 4.2.6 renders on browser and registered iPhone.
- Reusable cards, drawers/sheets, and transitions pass the component gallery.
- Authentication owns only session state; Realtime invalidates typed queries.
- A development build belongs to the existing EAS/Apple product and uses no
  production OTA channel.
- The SDK 54 known-good TestFlight binary remains available for rollback.
- Feature migration has not silently begun inside the foundation PR.

## Follow-on plans after this foundation is accepted

Create one reviewed implementation plan and PR series for each independently
testable subsystem:

1. authentication and profile;
2. home, courts, map, court detail, and durable check-in;
3. schedule, planned visits, and hosted runs;
4. competition, match review, and combined ELO metrics;
5. profiles, friendships, feed, and in-app notifications;
6. push registration/delivery, settings, account deletion, and native
   permissions;
7. brand splash handoff, selected component-library adaptations, optional FAB,
   accessibility polish, and external-TestFlight acceptance.
