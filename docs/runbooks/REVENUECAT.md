# RevenueCat + App Store Connect — the one runbook

LocalCheck owns this end to end (app + backend + dashboard). No handoff.

**It is NOT a submission blocker.** The app can be submitted with the current
build as-is; the real paywall ships in the next one.

## Status (2026-09-11)

| Phase | State |
|---|---|
| 1 — ASC subscription (price/availability/localization) | ✅ done |
| 1c — In-App Purchase key | ✅ done — rotated once: the first key's `.p8` was downloaded by a since-retired agent session and lost, so it was revoked and regenerated. Same for the App Store Connect API key EAS uses to submit builds (a different key, also rotated after the same incident). Neither key's private material ever passed through chat. Verified: EAS's own credentials page shows the new key in place, and it already produced one successful build+submit before any of this PR existed — the merge doesn't touch EAS credentials at all. |
| 2 — RevenueCat dashboard (app config, product, entitlement, offering, SDK key) | ✅ done |
| 3 — `revenuecat-webhook` | ✅ source written + tested, hardened after a second review pass (see below) — **not yet deployed**, and its migration (`20260911000000_subscriptions_webhook_support.sql`) is **not yet applied**. Both need one explicit go-ahead. |
| 4 — App code (`react-native-purchases`) | ✅ source written (SDK init, identify/logout, real paywall purchase/restore/redeem-code on `/localplus`; purchase **and** offer-code redemption are both disabled until RevenueCat identification actually succeeds) — **untested on a real device**. Needs a new native build. `app.json` version bumped 1.0.2 → 1.0.3 for the new native module. |
| 5 — Offer codes for the first-100 STARTER cohort | ⬜ not started |
| Cutover (`useLocalPlus()` real by default) | ✅ **done in code** — the blanket dev-unlock fallback (`LOCALPLUS_DEV_DEFAULT`) is removed entirely. A fresh account is genuinely locked unless a real `subscriptions` row says otherwise; the one named exception is `account_tag === 'TEST'` (Jesse's QA fixtures stay unlocked indefinitely, independent of any grant). Only correct once phase 3 is live, or nobody can actually complete a purchase. **Before merging:** run the FOUNDER + REVIEWER promo-row grant (`docs/runbooks/ACCOUNT_TAGS.md` step 3, now scoped to both) or those two accounts have no LocalPlus at all. Leaderboard membership is unaffected either way (`gateLeaderboard` is a separate, still-off switch). |

### A second review pass found 3 more real issues (fixed)

1. **A legacy unique index blocked the whole dual-lineage design.** `public.subscriptions` already carried `subscriptions_revenuecat_user_key` on `(revenuecat_app_user_id, coalesce(entitlement_id,''))` from the original `v2_core_schema` migration — confirmed live against LocalCheckProd. Since every row here uses the same `revenuecat_app_user_id = user_id` and `entitlement_id = 'localplus'`, that index capped a person at **one row total**, silently defeating the new `(user_id, billing_provider)` design no matter what index was added alongside it. Dropped in the same migration that introduces the design it contradicted.
2. **Event dedup needed to remember every event id, not just the last one.** Per RevenueCat's own webhook docs, a retried delivery repeats its `event.id`, and the timestamp is informational — `BILLING_ISSUE`/`CANCELLATION`/`EXPIRATION` can share a timestamp for genuinely different events. Storing only the *latest* id+timestamp let a stale retry of an *earlier* same-timestamp event slip past and re-clobber newer state. Added `private.revenuecat_processed_events` (every event id ever applied) as the real dedup key; the timestamp now only rejects a genuinely-new event that's chronologically stale.
3. **Offer-code redemption wasn't gated on identification, unlike the purchase button.** Worse than the purchase case: codes are one-time-use and scarce. Redeeming one while unidentified burns it against RevenueCat's anonymous id with no way to credit the account or reissue the code. Now gated the same way, with the same "tap to retry" UI.

## Plan — locked (supersedes `launch/REVENUECAT_START_NOW.txt` where they differ)

| Thing | Value |
|---|---|
| Plans | **Monthly only, $4.99, United States only.** No annual for v1. No annual offer codes. |
| Why US-only | EU/DSA requires a public trader address; Jesse is a non-trader. Revisit post-launch if monetization works. |
| Entitlement | `localplus` (RevenueCat says already created, `entl99df860f0d`). NOT `localcheck_pro`. |
| Offering | `default` — one package, `$rc_monthly` → `com.realjess.localcheck.localplus.monthly`. Remove any `$rc_annual`. |
| ASC product | `com.realjess.localcheck.localplus.monthly` — created, price ($4.99), US availability, and localization all set. Status "Prepare for Submission" until submitted alongside an app version. |
| First-100 free year (STARTER) | **Apple offer codes** on the monthly product — 100 one-time codes, 100% off, 1 year, then **auto-converts to paid $4.99/mo** unless cancelled (Apple has no "free then just stop" mechanism). Accepted trade-off — see Phase 5. `account_tag='STARTER'` is set at signup as the row label; it grants nothing by itself. |
| FOUNDER free access | **Promo `subscriptions` row** (`billing_provider='promo'`), inserted directly per `docs/runbooks/ACCOUNT_TAGS.md` — no App Store product involved, no expiry pressure. |
| Grant reconciliation | The webhook only writes rows for real RC purchases, keyed `(user_id, billing_provider)` — a promo row and a real store row for the same person never overwrite each other. `sync_profile_is_pro` grants `is_pro` if *either* lineage is active/unexpired; the same trigger also sets `profiles.plus_billing_provider` so the app can tell "comped" from "a real subscription you can cancel." |

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

## Phase 3 — Webhook (built; deploy needs your go)

`supabase/functions/revenuecat-webhook` — JWT off, its own `Authorization`
header check, pure event-mapping logic in `webhookLogic.ts` (unit tested —
`pnpm run test:backend`), handles INITIAL_PURCHASE / RENEWAL / UNCANCELLATION /
PRODUCT_CHANGE / NON_RENEWING_PURCHASE / CANCELLATION / BILLING_ISSUE /
SUBSCRIPTION_PAUSED / EXPIRATION / REFUND. TRANSFER / SUBSCRIBER_ALIAS are
logged and skipped (rare identity-merge events, handled manually if one ever
occurs). The actual write is one call to `public.apply_subscription_event` — a
database function that does the dedup check and the upsert in a single atomic
statement (keyed `(user_id, billing_provider)`, so a promo grant and a real
purchase for the same person never collide), closing the race two concurrent
webhook deliveries would otherwise have if the check and the write were
separate round trips. Per RevenueCat's own webhook docs, dedup is by
`event.id` (a retried delivery repeats it — that's the real "same event
again?" signal), and `event_timestamp_ms` only rejects a strictly older/stale
event — RevenueCat documents that BILLING_ISSUE/CANCELLATION/EXPIRATION can be
dispatched with identical timestamps for genuinely different events, so a tie
must still go through. Needs its migration
(`20260911000000_subscriptions_webhook_support.sql` — adds `last_event_id`,
`last_event_ms`, the composite unique index, `profiles.plus_billing_provider`,
and the RPC itself) applied first.

**To finish, in order:**
1. Apply the migration through the Supabase migration tool.
2. Deploy the function.
3. Jesse generates a random secret (e.g. `openssl rand -hex 32`), adds it as
   `REVENUECAT_WEBHOOK_AUTH_HEADER` in Supabase → **Project settings → Edge
   Functions → Secrets**.
4. RC → **Project settings → Integrations → Webhooks → ＋ New**:
   - URL `https://qkrnmyexzvaxiqfxwwfb.functions.supabase.co/revenuecat-webhook`
   - Authorization header value = the same secret.
5. **Gate:** RC webhook shows **Active**; its "Send test event" button returns
   2xx (the function acknowledges `TEST` events without writing anything).

---

## Phase 4 — App code (built; needs a native build to verify)

`services/purchasesService.ts` — the only file that imports the SDK. Configures
on `EXPO_PUBLIC_REVENUECAT_IOS_KEY` (iOS only), identifies/logs out with the
Supabase user id (wired into `context/AuthContext.tsx`), and exposes
purchase / restore / redeem-offer-code / a same-device "fast path" entitlement
check so a purchase unlocks `useLocalPlus()` instantly instead of waiting on
the webhook round trip. `app/localplus.tsx` now shows the real price from the
package, purchases it, and has Restore Purchases + "Have an offer code?"
buttons — App Review requires the restore button on any subscription screen.

**Not yet exercised on a device** — `react-native-purchases` has native code,
so this needs a fresh EAS build (dev or production; not Expo Go, not the web
preview) before it can be trusted. Verify: the price shown matches ASC, a
sandbox purchase completes and flips `useLocalPlus()` true immediately, Restore
works from a second install, and an offer code redeems.

## Phase 5 — First-100 STARTER offer codes

ASC → your app → **Subscriptions → LocalPlus → LocalPlus Monthly → Promotional
Offers / Offer Codes** (Apple's naming varies by ASC version — look for
"Offer Codes" under the subscription).
- **New Offer Code** → Reference name `STARTER-FIRST-100`.
- Discount: **100% off**, duration **1 year**, one-time (not recurring at the
  discounted rate).
- Customer eligibility: **new subscribers**.
- **Generate codes**: one-time-use, quantity **100**.
- ⚠️ **Accepted per Jesse's call:** this converts to the normal $4.99/mo
  auto-renewal after the free year unless the redeemer cancels — Apple offer
  codes don't support "free, then just stop." That's the intended behavior
  (free-year hype now, a real conversion path later), not a bug to route
  around. If that ever needs to change, it's an `account_tag='STARTER'` +
  promo `subscriptions` row per `docs/runbooks/ACCOUNT_TAGS.md` instead — a
  different mechanism, not a variant of this one.
- The redemption UI is `Purchases.presentCodeRedemptionSheet()` (already wired
  behind "Have an offer code?" on `/localplus`), or Apple's own
  Settings → \[name\] → Subscriptions → **Redeem** flow — both work with the
  same codes.

## Cutover

- **FOUNDER (Jesse) and REVIEWER (Apple)** each need a real entitlement — there
  is no fallback covering them anymore — run the promo-row grant,
  `docs/runbooks/ACCOUNT_TAGS.md` step 3 (now scoped to both tags). Both then
  see the full unlocked app permanently, no purchase or code involved —
  simplest to reason about. Say so plainly in the App Store Review notes (a
  pre-unlocked reviewer account is normal, accepted practice).
- **TEST accounts** stay unlocked automatically — `useLocalPlus()` grants
  LocalPlus to any `account_tag === 'TEST'` profile, no per-account row needed.
- Everyone else flows through real: a fresh sign-up sees the locked/paywalled
  state; the first 100 real sign-ups (STARTER) redeem an Apple offer code for
  their free year (Phase 5); anyone after that just subscribes.
- Submit the paid subscription (`Add for Review`) with the app version that
  carries the paywall.
