# PR 93 · LocalPlus saved courts database review

**Proposed for LocalCheckProd.** The [complete migration](../../supabase/migrations/20261127120000_saved_courts.sql) is the file to review. It has been applied only to an isolated PostgreSQL fixture. Production application and the PR merge await Jesse’s approval.

| Migration version | SQL file size | SHA-256 of the SQL file |
| --- | ---: | --- |
| `20261127120000` | 10,599 bytes | `ad17ecda656c0afecd034a8158b3672b49c7dd647ed9b42a60447cc18205fd4b` |

## What applying the file does

The transaction creates an empty membership table, one read policy, three public RPCs and a private eligibility function. It saves the four pre-change function definitions in `private.migration_backups` under version `20261127120000`, patches those functions and sends PostgREST a schema reload notification at commit. Existing profiles, subscriptions, courts and historical check-ins receive zero row updates during installation.

| Object | Exact contract |
| --- | --- |
| `public.saved_courts` | Composite primary key `(user_id uuid, court_id uuid)`. Both columns are required foreign keys with cascading deletion from profiles and courts. `auto_check_in boolean` is nullable. `added_at timestamptz` is required and defaults to `now()`. |
| `read_own_saved_courts` | Row-level security allows authenticated players to select only their own rows. The app roles receive no direct insert, update or delete grant. A lapsed member still owns and can read their stored rows through this policy. |
| `public.get_local_list()` | A caller-privilege read returns `court jsonb` from `courts_with_stats`, `is_default boolean` and `auto_check_in boolean`. It reads the existing default from `profiles.local_court_id` even with no membership row. It returns up to five visible, unarchived courts, default first, then by date added and court ID. |
| `public.update_local_list(text, uuid, boolean)` | A privileged write RPC identifies the caller from `auth.uid()` and locks their profile. The third argument defaults to null. It checks entitlement and court eligibility before editing. Archived courts are ineligible, pending-review courts are restricted to their submitter, and test courts follow the existing test-data visibility rules. |
| `private.allows_auto_court(uuid, uuid)` | Checks court availability and visibility. A paid or TEST player’s default is eligible unless explicitly off. An additional court requires an entitled player and explicit opt-in. Free accounts follow the existing single-default arrival rule. This helper has no execute grant for app roles. |
| `public.undo_auto_check_in_at(uuid)` | Hide cancels the caller’s pending arrival at that court first. Otherwise it deletes the caller’s most recent automatic check-in at that court within three hours and its linked activity events. It returns whether it found anything. The existing no-argument Hide RPC remains available to installed clients. |

All three new public RPCs grant execution to `authenticated`. Anonymous clients have no execute grant. The two privileged public RPCs and the private helper use an empty search path.

## What a player can change

| Action | Result |
| --- | --- |
| Add | Saving an existing member succeeds without creating a duplicate. Adding after the list reaches five is rejected. A new row starts with auto check-in off. With no prior default, the first addition also sets the profile’s local court and preferred sport. |
| Make default | Requires a member. Sets the profile’s local court and preferred sport. Keeps the former default in the list, preserving any saved preference. If it had no membership row, it is saved with automatic check-in off. |
| Remove | Removes a non-default membership and cancels its pending arrival. Removing the current default is rejected until the player chooses another. |
| Auto check-in | Stores an explicit true or false for this court. Turning it off cancels its pending arrival. Neither an opt-out nor a removal retroactively deletes a posted check-in. A separate Hide action handles that. |

Home and Schedule select which court to view. Browsing either picker does not write a new default. Settings manages the default and per-court switches. Explore and court detail let the player add a court. [Screenshots across three phone widths](../product/design-qa/2026-11-27-locallist/README.md)

## Four existing functions change at runtime

| Function | Change |
| --- | --- |
| `public.auto_check_in_arrive(uuid)` | Locks the caller’s profile and consults the eligibility helper. When already checked in, it clears only the pending arrival at that court. The existing pending-arrival table still holds one arrival per player. Entering another eligible court replaces that pending arrival. |
| `public.resume_auto_check_in(uuid)` | “I’m still here” accepts any currently eligible court. The existing check-in and checkout logic then runs. |
| `private.post_auto_check_in(uuid)` | After the five-minute hold, consumes the pending arrival and checks eligibility again before posting. Loss of entitlement during the hold prevents a post at an additional court. |
| `private.end_auto_check_in_on_court_change()` | When the default moves, the trigger clears the old court’s pending arrival and closes an open automatic check-in there only if the old court is no longer eligible. |

## Accounts at launch

| Account state | Observable result |
| --- | --- |
| Paid or promoted player with `profiles.is_pro = true` | Can manage the full list. A newly purchased entitlement must reach the server through the existing subscription sync before the first saved-court write can succeed. |
| Free player | Sees their existing default through the list RPC. Additional-court arrivals and all list edits are denied. |
| Subscription expires | Additional memberships and preferences are retained. The app-facing list returns only the default. Additional-court arrivals, delayed posts and resumes are denied until entitlement returns. The default uses the legacy free-account rule, with monitoring controlled on the device. |
| Test fixtures | `account_tag = 'TEST'` grants access without a purchase. Other tags, including REVIEWER and FOUNDER, require `is_pro` for list management. |

## Verified and pending

Isolated PostgreSQL tests exercised a paid profile without a TEST tag, a free profile, the TEST exception, a REVIEWER without entitlement, account isolation and anonymous denial. They covered duplicate saves, the sixth-court rejection, a hidden test court, default changes, per-court opt-in, expiry during a pending arrival, court-specific resume and Hide, and preservation of a manual check-in. A deliberately changed function guard aborted the migration and rolled back the new table, backups and earlier function edits.

The fixture used the inspected live function bodies with a reduced surrounding schema. The database test set `is_pro` directly. Store purchase → RevenueCat webhook → profile entitlement and physical iOS background entry/exit still need launch verification. The Expo web journey verified persistence after reload and produced the linked screenshots.

## Deployment and recovery

After approval, use the [project SQL editor procedure](../SUPABASE.md#apply-a-change-to-production-the-sql-editor-flow). Compare the file hash first. The SQL expects the four named routines and the existing private backup table. A missing dependency, existing conflicting object or changed anchor aborts the entire transaction. The lock timeout is five seconds and the statement timeout is sixty seconds. This is a one-time migration.

After commit, verify all four saved definitions, app-role grants, owner-only reads, and an allowed and denied account using rolled-back test transactions. Record the version in the migration ledger per the project procedure. If recovery is needed after writes begin, coordinate the client rollback, retain the membership rows and export the current state before restoring the four saved definitions. Those definitions restore the previous checks. They do not reverse default changes or reconstruct visits a player chose to hide.
