# RevenueCat + App Store Connect — the one runbook

LocalCheck owns this end to end (app + backend + dashboard). No handoff.

**It is NOT a submission blocker.** The app can be submitted today with
`app/localplus.tsx`'s "SEE PLANS" alert as-is; the paywall ships in 1.0.1.

## Plan — locked (supersedes `launch/REVENUECAT_START_NOW.txt` where they differ)

| Thing | Value |
|---|---|
| Plans | **Monthly only, $4.99, United States only.** No annual for v1. No annual offer codes. |
| Why US-only | EU/DSA requires a public trader address; Jesse is a non-trader. Revisit post-launch if monetization works. |
| Entitlement | `localplus` (RevenueCat says already created, `entl99df860f0d`). NOT `localcheck_pro`. |
| Offering | `default` — one package, `$rc_monthly` → `com.realjess.localcheck.localplus.monthly`. Remove any `$rc_annual`. |
| ASC product | `com.realjess.localcheck.localplus.monthly` — **already created**, status "Prepare for Submission", missing price/availability/localization/review-screenshot. |
| First-100 free year | **Promo `subscriptions` row**, not Apple offer codes (there's no annual product to attach one to). Launch-day migration per `docs/runbooks/ACCOUNT_TAGS.md`: `account_tag='STARTER'` + a `billing_provider='promo'` row, `is_pro` for one year, no auto-renew, no charge. |
| Grant reconciliation | The webhook only writes rows for real RC purchases. Promo rows are `billing_provider='promo'` — no double-grant. When a promo year expires the `sync_profile_is_pro` trigger flips `is_pro` false; a real purchase in the meantime keeps them active. No silent revocation. |

## Env var NAMES (values never in chat / repo / this file)

| Name | Where it lives | Who sets it |
|---|---|---|
| `EXPO_PUBLIC_REVENUECAT_IOS_KEY` | EAS env / `.env` — public `appl_…` SDK key, safe to share | Jesse pastes the key to Claude, or sets it in EAS |
| `REVENUECAT_WEBHOOK_AUTH_HEADER` | Supabase → Edge Function secrets | Jesse generates a random value, sets it in Supabase **and** in the RC webhook's Authorization header |
| Webhook URL | `https://qkrnmyexzvaxiqfxwwfb.functions.supabase.co/revenuecat-webhook` | Claude deploys the function |

---

## Phase 1 — App Store Connect (Jesse, ~20 min)

### 1a. Paid Apps agreement must be Active
ASC → **Business** (top nav) → **Agreements, Tax, and Banking**.
- Expect a row **"Paid Applications"** with status **Active**.
- If **"Pending"** — complete **Bank Account** + **Tax Forms (W-9)** first. This gates everything below.
- **Gate:** screenshot showing Paid Applications = Active.

### 1b. Finish the subscription product
ASC → your app → **Subscriptions** → **LocalPlus** → **LocalPlus Monthly**.
- **Subscription Prices** → Add → **USD 4.99** → save. (Apple generates other
  currencies; US-only availability limits it anyway.)
- **Availability** → Set Up → **United States** only.
- **Localization** → Add (English U.S.):
  - Display name (≤30 chars): **`LocalPlus`**
  - Description (≤45 chars): **`Leaderboard rank, full history & court stats`** (44)
- **Review Information → Screenshot**: a screenshot of the `/localplus` screen.
- **Review Notes**: `LocalPlus unlocks leaderboard ranking, full match history, and court-detail insights. Reviewer test account provided in App Review Information.`
- **Do NOT click "Add for Review"** — that submits it with the app version; do it when the app version is submitted.
- **Gate:** status still "Prepare for Submission"; price shows $4.99; name "LocalPlus". Screenshot → Claude.

> The **in-app** one-liner on the `/localplus` screen is separate copy (no length
> limit): *"Unlock a spot on the public leaderboard & full court stats."* Owned in
> `app/localplus.tsx`, not App Store Connect.

### 1c. Generate the In-App Purchase Key (for RevenueCat receipt validation)
ASC → **Users and Access** → **Integrations** tab → left nav **In-App Purchase** → **Generate In-App Purchase Key** (or the **+**).
- Name: `RevenueCat`.
- **Download the `.p8` file** — one-time download, keep it safe.
- Copy the **Key ID** (10 chars, on the key row) and the **Issuer ID** (UUID, top of the page).
- No agreement popup for this key itself.
- **Gate:** you have the `.p8`, Key ID, Issuer ID. Tell Claude "got the IAP key" — **do not paste the `.p8` or IDs here**; they go straight into RevenueCat in the next step.

---

## Phase 2 — RevenueCat dashboard (Jesse, ~15 min)

### 2a. Confirm the project
RC → project switcher (top-left). Expected name **"LocalCheck"**. The handoff
names project id **`b4a21053`** — confirm that's the one you're in, or tell
Claude the actual id.

### 2b. Add the real App Store app config (replaces the Test Store)
RC → **Project settings** → **Apps** → **＋ New** → **App Store**.
- App name `LocalCheck`, **Bundle ID `com.realjess.localcheck`**.
- Under **App Store Connect API** / **In-app purchase key**: upload the `.p8`,
  enter **Key ID** and **Issuer ID** from step 1c.
- **Agreements to expect on first real setup:**
  - **"RevenueCat Terms of Service"** / **"Master Subscription Agreement"** — accept.
  - Possibly a billing prompt: *"Add your credit card to avoid losing access
    when you hit $2,500 in MTR."* You do **not** need a card to configure —
    only before you exceed $2,500 monthly tracked revenue. Skip for now.
- **Gate:** the App Store app shows **Connected** (green), and the project is no
  longer "connected to the Test Store". Screenshot → Claude.

### 2c. Register the product
RC → **Products** → **＋ New** → import from App Store (or add manually):
`com.realjess.localcheck.localplus.monthly`, type = subscription.

### 2d. Entitlement
RC → **Entitlements** → open **`localplus`** → attach the product above.

### 2e. Offering
RC → **Offerings** → **`default`** → package **`$rc_monthly`** → attach
`com.realjess.localcheck.localplus.monthly`. Delete any `$rc_annual` package.

### 2f. Public SDK key
RC → **Project settings** → **API keys** → under the **App Store** app (NOT Test
Store) → copy the **public** key (`appl_…`).
- **Gate:** you have an `appl_…` key. Paste it to Claude (safe — it ships in the
  client) **or** set it yourself as `EXPO_PUBLIC_REVENUECAT_IOS_KEY` in EAS.

---

## Phase 3 — Webhook (Jesse + Claude)

- Claude deploys `supabase/functions/revenuecat-webhook` (JWT off, own
  shared-secret header check, idempotent upsert into `public.subscriptions`,
  handles INITIAL_PURCHASE / RENEWAL / CANCELLATION / EXPIRATION / BILLING_ISSUE
  / PRODUCT_CHANGE / REFUND / SUBSCRIBER_ALIAS with out-of-order protection).
- RC → **Project settings** → **Integrations** → **Webhooks** → **＋ New**:
  - URL `https://qkrnmyexzvaxiqfxwwfb.functions.supabase.co/revenuecat-webhook`
  - Authorization header value = a random secret you generate.
- Jesse: Supabase dashboard → **Project settings → Edge Functions → Secrets** →
  add `REVENUECAT_WEBHOOK_AUTH_HEADER` = that same value.
- **Gate:** RC webhook shows **Active**; a RC "send test event" returns 2xx;
  a matching row lands in `public.subscriptions`.

---

## Phase 4 — App code (Claude)

`react-native-purchases`, SDK init on `EXPO_PUBLIC_REVENUECAT_IOS_KEY`, identify
by the Supabase user UUID, login/logout isolation, CustomerInfo refresh,
purchase / restore / manage-subscription flows, failure + cancel UI. Flip
`LOCALPLUS_DEV_DEFAULT` → `false`. A native dev build is required for real Apple
sandbox testing — Expo Go is not evidence.

## Phase 5 — cutover

- Apply the launch-day STARTER migration (`docs/runbooks/ACCOUNT_TAGS.md`).
- Submit the paid subscription (`Add for Review`) with the app version that
  carries the paywall (1.0.1).
