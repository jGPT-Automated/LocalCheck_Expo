# Manual check-in notification gap

**Live backend inspected read-only, November 5, 2026.** Project:
[LocalCheckProd](https://supabase.com/dashboard/project/qkrnmyexzvaxiqfxwwfb).
No mutation, test check-in, notification dispatch, migration or deployment.
This report uses aggregate results, not account identifiers or push tokens.

## Confirmed cause

`public.check_in(uuid,text,text)` inserts the manual check-in and returns it.
Its check-in triggers update metrics, book checkout, broadcast invalidations
and project activity. The activity table only broadcasts invalidations.
Neither path creates a friend notification.

Friend alerts are instead inserted inside `private.post_auto_check_in(uuid)`:
after the five-minute arrival hold it creates the auto check-in, inserts
`friend_check_in` notifications for eligible friends and creates the player's
own `auto_check_in` notification. The notification insert then starts push
processing through `notify_push_dispatch`.

Thus a manual check-in never reaches recipient selection, inbox creation or
push dispatch for friends. That explains both directions of the reported
manual-check-in failure; it is upstream of phone delivery.

Live data corroborates the code: the latest 100 stored check-ins span August
16–November 5. Of these, 97 are manual (eight private), with **zero linked
friend alerts**, matched by the check-in ID in the notification dedupe key.
The three auto check-ins do have linked friend alerts.

## Other logical mismatches

1. Settings says **“Share my check-ins” / “Friends' check-ins”**, while the
   sending field is `share_auto_check_ins` and the only fanout is auto-only.
   D37 explicitly describes the older auto-only policy. The visible wording
   and today's expected manual behavior do not match that backend contract.
2. Enabling push is not the same as having a registered receiving device.
   Over the last seven days, 18 auto friend alerts were created: one is sent
   with an accepted ticket and `ok` receipt; 17 are skipped with no delivery
   attempt. Current recipient state for those skipped rows is 12 with push
   disabled/no enabled token and five with push enabled/no enabled token.
   These are current settings, not historical snapshots of the skip reason.
   A receipt marked `ok` does not establish that an OS banner was displayed.

## Small proposed fix — draft only

Add manual check-in inserts to friend-alert creation, using a shared recipient
policy with the auto path. Preserve private-check-in suppression, accepted
friendship, blocks, receiver preference, test-account/court isolation,
deduplication and the agreed rate limit. Keep manual retries and privacy-only
updates from generating new alerts. Keep the auto five-minute hold.

Before writing an executable migration, specify how the sender's sharing
switch applies to explicit manual check-ins; the current column is auto-only.
Then review one migration and its allowed/denied/privacy/idempotence cases.
Do not backfill historical check-ins or send retrospective pushes by default.
Separately inspect device registration for the specific receiving accounts
if their push preference is enabled but no token is registered.

## Read-only evidence queries

Function and trigger definitions were read through `pg_get_functiondef` and
`pg_get_triggerdef`, including `check_in`, `post_auto_check_in`,
`project_check_in_activity`, `set_auto_check_in_alerts` and
`set_push_notifications_enabled`. No inspected RPC was invoked.

```sql
with recent as (
  select id, source, visibility, checked_in_at
  from public.check_ins order by checked_in_at desc limit 100
)
select source, count(*) as check_ins,
       count(*) filter (where visibility = 'private') as private_check_ins,
       (select count(*) from public.notifications n
        where n.type = 'friend_check_in'
          and exists (select 1 from recent r
            where r.source = recent.source
              and n.dedupe_key like 'friend_check_in:' || r.id::text || ':%'))
         as linked_friend_notifications
from recent group by source;
```

References: [manual service](../../services/checkInService.ts),
[auto fanout source](../../supabase/migrations/20261012180000_qstash_timers.sql),
[push processing](../../supabase/functions/send-notification/index.ts),
[Settings wording](../../components/autoCheckIn/AutoCheckInSettingsSheet.tsx).
Live function definitions, rather than migration presence alone, established
the current behavior.
