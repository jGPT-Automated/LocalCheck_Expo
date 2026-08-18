# Product Backlog

Items here are intentionally outside the current MVP implementation.

## Scheduled games

- Send participants a reminder one hour before a scheduled game. Reuse the existing Supabase notification creation, delivery, retry, and receipt pipeline; do not implement this with an app-side timer. Validate reminder wording and opt-out behavior during beta testing before scheduling the backend job.
