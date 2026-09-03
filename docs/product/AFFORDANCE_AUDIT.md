# Release 1 affordance audit

Status: automated checks and signed-out connected preview verified; signed-in and physical QA pending
Last updated: 2026-08-10

This is the explicit control inventory for the MVP snapshot. It records visible
product changes that could otherwise be lost during the repository reset.

| Surface | Control | Release 1 disposition |
| --- | --- | --- |
| Explore | Court card → drawer/detail | Preserved |
| Explore / map | Geographic court discovery | Preserved; viewport crosses market boundaries and Explore sorts geographically constrained candidates |
| Explore header | Add Court | Added; authenticated Supabase photo flow |
| Add Court | Location pin | Changed; never prefilled from the saved home court, device location is required |
| Court detail | Back logo | Preserved; frame now explicitly sized/clipped |
| Schedule | Speed-dial FAB | Preserved |
| Run detail | Roster / invite / manage / RSVP | Preserved; body scrolls above the fixed RSVP footer on compact screens |
| Compete | Log Game FAB | Preserved temporarily; Release 2 replaces it with `LOG PICKUP` |
| Player profile | Log Game | Preserved; opponent now fetched directly by ID |
| Player profile | Friend action | Preserved |
| Player profile | Report / block | Added without replacing primary actions |
| Settings → Safety | Blocked players / unblock | Added; makes every block reversible in app |
| Me header | Settings | Preserved |
| Notification feed | Informational updates | Preserved separately from Profile Inbox |
| Me tabs | Inbox | Action queue for pending friend requests, game reviews, and invitations only |
| Me tabs | Friends | Preserved; accepted friends and discovery stay here |
| Me profile avatar | QR | Avatar is the QR affordance; no duplicate QR button |
| Match detail | Confirm / reject | Preserved; copy now states the three-day timer |
| Feed | Hype | Preserved; now persisted once per user with authoritative count/liked state |
| Player profile stats | Check-ins | Preserved; now sourced from visible check-in rows instead of court-time minutes |
| QR scanning | iPhone Camera → profile | Preserved; no native camera dependency added |
| Auth | Email/password, Apple Sign-In | Preserved behind the approved signed-out reveal |

Removed or deliberately not restored:

- The legacy Add Court modal and dead `/api/courts/verify` route.
- Any second in-app QR scanner or `expo-camera` dependency.
- A separate scheduled-run match event; Release 2 keeps one persistent run.

Release 2 is allowed to replace only the scheduled-run logging path and the
Compete FAB described in its approved plan. All other controls above remain the
baseline unless a later review explicitly changes them.
