# LocalCheck Elo system

Living document. This is the rating system's product and technical contract in
one place. Update it in the same change that alters the behaviour — if this file
and the SQL disagree, the SQL is what runs, and that is a bug in this file.

Status: **rough system, not yet live in production.** The algorithm below is
implemented in `docs/supabase/migrations/20260804_sport_elo_completion.sql` and
has not been applied to LocalCheckProd. Ratings on the installed build still
come from the single legacy `profiles.elo_rating`.

Last verified against the SQL: 2026-08-04.

---

## 1. What a rating means

A rating is a running estimate of how likely you are to beat a given opponent.
It is not a score, a streak, or a measure of effort. Two players on the same
number should be a coin flip.

Every player carries **three** numbers:

| Field | Scope | Start |
| --- | --- | --- |
| `profiles.elo_basketball` | Basketball only | 1200 |
| `profiles.elo_pickleball` | Pickleball only | 1200 |
| `profiles.elo_rating` | Legacy, all sports combined | 1200 |

The per-sport ratings are the real product. The combined `elo_rating` is kept
and still updated so an older installed build keeps rendering a sane number
while a new client rolls out. Do not delete it until no shipped build reads it.

Win/loss counts are tracked per sport as well: `basketball_wins`,
`basketball_losses`, `pickleball_wins`, `pickleball_losses`.

---

## 2. The maths

Standard Elo. For player A against player B:

```
expected_A = 1 / (1 + 10 ^ ((rating_B - rating_A) / 400))
delta      = max(1, round(K * (actual_A - expected_A)))
```

- **K = 32**, fixed. No provisional period, no rating-dependent K yet.
- `actual_A` is 1 for a win, 0 for a loss. There are no draws.
- **Zero-sum**: the winner gains exactly what the loser drops.
- **Minimum movement of 1 point.** Without the `max(1, …)` a heavy favourite
  beating a much weaker opponent would round to 0 and the game would feel like
  it did not count.
- **Clamped to `0 … 5000`.** The floor stops a losing streak going negative;
  the ceiling is a sanity bound, not a reachable goal.

The sport rating and the legacy combined rating are calculated **independently**
— each uses its own pair of current ratings to compute its own expected score.
They will drift apart, and that is intended: they answer different questions.

Which sport a match counts for is taken from the **court**, not from user input.
`matches.sport` is backfilled from `courts.sport_type`.

---

## 3. Lifecycle of a match

```
log_match()  →  pending  ─┬─ confirm_match()   → confirmed   (ratings move)
                          ├─ reject_match()    → rejected    (no rating change)
                          └─ 7 days elapse     → confirmed   (ratings move)
```

**Logging.** `public.log_match(...)` records the result as `pending` and stamps
`review_due_at = now() + 7 days`. Nothing moves yet.

**Confirming.** `public.confirm_match(match_id)` may only be called by the
**named opponent** — the person who would lose points. Anyone else gets `42501`.
This is what stops a player from inventing wins. It records
`confirmation_method = 'manual'`.

**Rejecting.** `public.reject_match(match_id)` may be called by **either**
participant while the match is pending. The match becomes `rejected` and **no
rating changes at all** — a disputed score is thrown away rather than
negotiated. Whether a rejected score should be retained for moderation is an
open question (§6).

**Automatic confirmation.** `private.auto_confirm_due_matches()` sweeps matches
whose `review_due_at` has passed and confirms them with
`confirmation_method = 'automatic'`. Silence is agreement — otherwise one player
ignoring their phone freezes the other player's rating forever. It uses
`FOR UPDATE SKIP LOCKED`, so concurrent runs cannot double-apply, and it returns
how many it confirmed.

> **Not yet scheduled.** Nothing calls `auto_confirm_due_matches()` on a timer
> today. It needs a `pg_cron` schedule or an external trigger. Until then the
> seven-day rule exists in code but never fires.

---

## 4. Correctness guarantees

`private.apply_match_elo` is the only thing that ever moves a rating. It is
`SECURITY DEFINER` and revoked from `public`/`anon` — reachable only through
`confirm_match` or the auto-confirm sweep.

- **Idempotent.** Already `confirmed` → returns the match untouched. A retried
  call cannot double-count.
- **Row-locked.** Takes `FOR UPDATE` on the match, then on both profiles
  **ordered by id**. The ordering is what prevents deadlock when two matches
  involving the same two people confirm simultaneously.
- **Invariant-checked.** Aborts unless the match has exactly two participants.
- **Auditable.** Writes `elo_before` / `elo_after` (the *sport* rating) onto
  `match_participants`, so any rating is reconstructable from history.

---

## 5. Deliberate omissions

These are choices, not oversights:

- **No decay.** Ratings do not fade with inactivity.
- **No provisional period.** A first game moves a rating as much as a hundredth.
- **No margin of victory.** 21–0 and 21–20 are the same result.
- **No team ratings.** Strictly 1v1 between `created_by` and `opponent_id`.
- **No draws.** `winner_side` is always `'a'` or `'b'`.

---

## 6. Open questions

1. **Scheduling auto-confirm.** `pg_cron` inside Supabase, or an Edge Function
   on a schedule? Nothing runs it today.
2. **Rejected-score retention.** A rejected match currently just stops. Should
   the claimed score be kept for abuse detection?
3. **Provisional K.** A higher K for a player's first ~10 games would let new
   players find their level faster. Costs nothing but a `games_played` count.
4. **Retiring `elo_rating`.** Safe to drop only once no installed build reads
   it — which means after the sport-split client has fully rolled out.
5. **Leaderboard privacy.** `profiles` still has no persisted visibility field,
   so a hidden player cannot be filtered out server-side.

---

## 7. Where the code lives

| Concern | Location |
| --- | --- |
| Schema, algorithm, RPCs | `docs/supabase/migrations/20260804_sport_elo_completion.sql` |
| Original combined migration | `docs/supabase/migrations/20260729_mvp_notifications_and_sport_elo.sql` |
| Product/activation contract | `docs/NOTIFICATIONS_AND_ELO.md` |
| Live vs missing objects | `docs/CURRENT_STATE.md` |
