# Secrets & environment variables

Everything an agent needs to build, submit, and iterate on LocalCheck, plus
where each value lives and how to rotate it. **Nothing secret is committed to
this repo.** Values marked _public_ are safe to commit; values marked _secret_
must only live in a secret store.

---

## 1. The three "buckets" — where things live

| Bucket | What goes here | How it's consumed |
|---|---|---|
| **Local dev** (`artifacts/mobile/.env`, gitignored) | `EXPO_PUBLIC_*` only | read by `expo start` / local builds |
| **EAS** (Expo servers) | build-time env vars + iOS signing + ASC API key | used by `eas build`/`eas submit` and by EAS Workflows CI |
| **Agent session** (Devin secrets) | `EXPO_TOKEN`, ASC key, Supabase admin token | exported into the shell for CLI/MCP use |

Key idea: **EAS Workflows (CI) need NO secrets in the repo.** They run under the
connected Expo account and read signing + the ASC key + env vars already stored
on EAS. Secrets are only handled by a human/agent doing manual CLI work.

---

## 2. App runtime env (`EXPO_PUBLIC_*`)

Read at build/dev time and embedded in the JS bundle. `EXPO_PUBLIC_*` values are
shipped to the client, so only ever put **publishable/anon** values here.

| Var | Sensitivity | Value / source |
|---|---|---|
| `EXPO_PUBLIC_SUPABASE_URL` | public | `https://jzclwnzcektqhgkkdeje.supabase.co` |
| `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | public (anon) | Supabase → Project Settings → API → publishable/anon key |
| `EXPO_PUBLIC_MAPBOX_TOKEN` | public token | Mapbox public (`pk.…`) token, if maps are used |

**Where to set them:**
- **Local:** `artifacts/mobile/.env` (copy from `.env.example`).
- **Builds/CI:** as **EAS environment variables** on the `production` environment
  (Expo dashboard → project → Environment variables, or `eas env:create`). The
  production build reads these; without them the app can't reach Supabase.

**Which are actually required (verified against the code):**
- `EXPO_PUBLIC_SUPABASE_URL` + `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY` — **required.**
  Read in `lib/supabase.ts`; without them every query/auth call fails.
- `EXPO_PUBLIC_MAPBOX_TOKEN` — **optional.** Read in `MapScreen.tsx` /
  `MapScreen.web.tsx`; missing ⇒ "MAPBOX KEY NEEDED" placeholder, rest of app works.

**Legacy vars — do NOT set for the production iOS app:** `EXPO_PUBLIC_DOMAIN`,
`EXPO_PUBLIC_REPL_ID`, `REPLIT_*`, `BASE_PATH`, `PORT`. They only drive the old
Replit web-export tooling (`scripts/build.js`, `server/serve.js`, `mockup-sandbox`).
The one in-app consumer is `AddCourtModal`'s photo-verify fetch
(`POST ${EXPO_PUBLIC_DOMAIN}/api/courts/verify`) — and **that endpoint does not
exist in this repo**, so adding a court is currently blocked in production (it's
gated on a successful verify). Tracked as a follow-up, not an env you can just set.

---

## 3. Deployment credentials (secret — never committed)

| Credential | Sensitivity | Where it lives now | Notes |
|---|---|---|---|
| **Expo access token** (`EXPO_TOKEN`) | secret | Devin session secret / local shell | Runs `eas` under the `agenticjess-os` account. Create at https://expo.dev/settings/access-tokens. CI workflows don't need it (they use the connected account). |
| **App Store Connect API key** (`.p8`) | secret | **stored on EAS servers** (uploaded 2026-07-09) | Submits (manual and CI) use the EAS-stored copy — no local file needed. A local copy, if used, goes at `artifacts/mobile/.secrets/asc_api_key.p8` (gitignored). |
| ASC API **Key ID** | public id | `eas.json` history / EAS | `Y8Z8J4Q7FT` — not secret. |
| ASC API **Issuer ID** | public id | EAS | `8b08a203-9143-441b-abad-93f361dbecab` — not secret. |
| iOS **distribution cert + provisioning profile** | secret | **stored on EAS servers** (auto-managed) | Generated once via `eas credentials -p ios`. No action needed; EAS reuses them. |

**Non-secret Apple/Expo identifiers** (safe to keep in docs/config):

| Thing | Value |
|---|---|
| iOS bundle identifier | `com.realjess.localcheck` |
| Expo account (owner) | `agenticjess-os` |
| Expo / EAS project id | `9c906173-0258-45a9-a3fe-786cda373c66` |
| App Store Connect app id | `6786909608` |
| Apple Team id | `6HHLJVQC6W` (Individual) |

---

## 4. Backend admin (agent tooling only — NOT used by the app)

| Credential | Sensitivity | Use | Notes |
|---|---|---|---|
| **Supabase account access token** (`sbp_…`) | secret | agents querying/altering schema via the Supabase MCP | Store as a Devin org/user secret. **Rotate it** — it was pasted in chat during setup (Supabase → Account → Access Tokens). |
| Supabase **service_role** key | secret | server-side only, if ever needed | Never ship to the client. Not currently used by the app. |

---

## 5. Rotation & leak response

- **Rotate the Supabase account access token now** (it was pasted in chat).
  Supabase → Account → Access Tokens → revoke + create; update the Devin secret.
- **Expo token:** rotate anytime at expo.dev/settings/access-tokens; update the
  secret. Nothing else breaks.
- **ASC API key:** rotate in App Store Connect → Users and Access → Integrations
  → App Store Connect API. Then re-upload to EAS with
  `eas credentials -p ios` → App Store Connect → "Add a new API Key" (answer
  **no** to the Apple-login prompt; provide the `.p8` path, Key ID, Issuer ID).
- **If a publishable/anon Supabase key leaks:** low impact (RLS protects data),
  but you can roll it in Supabase and update `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY`.
- **If the `.p8` or service_role key leaks:** revoke immediately and reissue.

---

## 6. Onboarding a new agent (checklist)

1. Repo access to `jGPT-Automated/LocalCheck_Expo` (contributor).
2. Session secrets set: `EXPO_TOKEN`, and (only for manual submits) the ASC key —
   though it's now on EAS, so usually just `EXPO_TOKEN`.
3. Supabase access token secret (for schema/data verification via MCP).
4. `artifacts/mobile/.env` created from `.env.example` with the Supabase values.
5. Read `AGENTS.md` → `docs/SOURCE_OF_TRUTH.md` before making changes.
