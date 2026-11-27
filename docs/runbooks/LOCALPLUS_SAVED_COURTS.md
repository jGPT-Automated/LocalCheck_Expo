# PR 93 · Saved courts database review, revision 2

**Ready for review. Production application and merge are pending.** A player who has only their existing default court can keep using automatic check-in without migrating any personal settings. LocalPlus adds saved courts with a separate on/off choice for each. Adding a court starts it off.

[Exact SQL to review](../../supabase/migrations/20261127120000_saved_courts.sql) · [Regression test for a disposable database](../../supabase/scripts/20261127120000_saved_courts_regression.sql)

Migration version `20261127120000` · 12,150 bytes · SHA-256 `f7132687ac6f0b71ec582f1c2744ddded09946154f1228d34ebe3e84c8af6a94`. This replaces the SQL in the first review packet.

## What changes for a player

| Action | Today | With the migration and the new client |
| --- | --- | --- |
| Arrive | The server accepts the default court. | It also accepts an enabled court on the player’s list. When the default has no saved preference, the device’s existing opt-in still works. |
| Stay for five minutes | The server posts the pending check-in. | The same timer checks the list again before posting. Switching the court off during the wait cancels the post. One player has one pending arrival at a time. |
| Tap “I’m still here” | Resumes at the default court. | Resumes at the court named by the notification if that court is still enabled. |
| Change default | Ends an automatic visit at the old default. | Keeps the visit there if that court is still enabled. Changing the Home or Schedule view does not change the default. |
| Tap Hide | The existing client calls the original Hide function. | A new function cancels the pending arrival or removes the most recent automatic visit within three hours at the specified court, including linked activity. Previously sent friend alerts stay sent. |

## What changed since the first review

- **A court outside the picker cannot auto-check someone in.** Reading the list, counting available places and accepting an arrival all consult the same five courts. The default comes first, then saved courts by date added and ID. A private or archived court cannot take up a visible place.
- **Old apps can still change the default.** If a LocalPlus player already has five visible courts, a direct profile update to a sixth is rejected. The current default and saved choices are preserved. They can choose any of the five or remove one in the new app.
- **Archiving and restoring a court preserves preferences.** If a player fills the free place while a court is archived, restoring it can leave six stored choices. Only the first five in the order above appear or can trigger check-in. The sixth preference is dormant until a place opens. No saved court is silently deleted.
- **Off survives subscription expiry.** Extra courts stop qualifying when LocalPlus expires. An explicit Off at the default also stays off. A free player can explicitly switch their own default back on through the new endpoint. Other list edits require LocalPlus or the existing TEST exception.
- **A changed production function stops installation.** Each of the seven text fragments the migration edits must occur exactly once. A missing or duplicated fragment rolls back the whole transaction.

## What the SQL installs

One empty table, `public.saved_courts`, stores player ID, court ID, preference and date added. Players may read their own rows. All app writes go through `update_local_list`. Deleting a player or court cascades to its saved rows. The default remains in `profiles.local_court_id`.

The three authenticated public functions are `get_local_list`, `update_local_list` and `undo_auto_check_in_at`. Private functions select eligible courts and protect writes from older clients. Court stats still use the caller’s existing read permissions.

The migration saves the original definitions of `auto_check_in_arrive`, `resume_auto_check_in`, `post_auto_check_in` and `end_auto_check_in_on_court_change` before editing them. Installation updates zero existing player, court or visit records. Lock timeout is five seconds. Statement timeout is sixty seconds.

## Verification and remaining app work

On November 27, a read-only production query confirmed all seven fragments matched once, old clients had the default-column write grant, the private-schema usage grant existed, and both the new table and migration version were absent. The migration and regression tests ran against isolated PostgreSQL with the inspected function definitions and a reduced surrounding schema. Checks passed for the older client’s sixth-court write, archive/restore, hidden courts, expiry with Off, explicit re-enable, denied cross-account reads and a duplicated fragment rolling back installation.

**This revision changes SQL and documents the client work.** Before shipping the new client, the main switch needs to follow a default changed on another phone, and the free default switch needs to send explicit changes after a saved preference exists. The client’s local and server-posted check-in notifications also need matching IDs. A first save immediately after a purchase can still arrive before the server receives the entitlement. These are integration points for the saved list. Apple sign-in and purchase processing receive no changes here.

Apply and verify the approved SQL before releasing the client that uses the new Hide function. Physical iPhone testing of the new multi-court flow is pending. For recovery after installation, coordinate the client rollback, disable the new write functions and default guard, and restore the four backed-up definitions. Retain saved rows. Restoring definitions does not undo actual player choices or reconstruct a visit someone hid. [Project deployment procedure](../SUPABASE.md#apply-a-change-to-production-the-sql-editor-flow)
