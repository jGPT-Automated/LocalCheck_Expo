# LocalPlus court list implementation plan

> Execute inline with superpowers:executing-plans; one fresh review at the end.

Goal/spec (Jesse, Oct 29): restore card art, city top right, centered court name;
reuse one identity on card/drawer/Home. Drawer holds check-in and court-page link.
Court-page header plus/check adds to LocalPlus's list of up to five courts.
Home header count/dropdown switches the viewed court. Settings replaces the
LocalPlus local-court row with that list and per-court auto check-in toggles.
The free tier keeps its single court and existing auto check-in behavior.

Architecture: existing CourtArt/SportLabel/MetricStrip compose CourtSummary;
CompactSelect owns Home's dropdown; existing PressableScale, Switch and
Settings surfaces own actions. A focused SavedCourtsContext under AppProvider
owns the paid list and transient viewed-court selection. Domain writes go
through services and atomic Supabase RPCs; owner-only RLS, server entitlement,
profile-row locking and a five-court cap enforce the contract. Extend the
existing geofencing task rather than introducing a second background task.
SDK54, no new app dependency, no payment configuration or native config change.

Review focus: sixth/concurrent add; duplicate add; free-tier regression;
downgrade and token-refresh races; disabled/removed/hidden courts; changing
Home must replace all court data and never the primary court; legacy enabled
geofence must survive migration without opting another court in.

- [x] Persist owner-only saved courts and nullable legacy opt-in; cap five
  on server; serialize changes on profile row. Add/remove/toggle RPCs.
  Mirror existing primary so existing accounts begin with their existing court.
  Preserve free auto eligibility; paid requires enabled saved court. Guard
  arrive/resume and delayed posting. Test using isolated PostgreSQL and two
  callers, with duplicate/limit/entitlement/privacy/disabled checks.
- [x] Add service + SavedCourtsContext. Reuse useLocalPlus entitlement path.
  Subscribe to own user invalidations; refresh on foreground. No localStorage.
- [x] Header plus saves paid membership; free keeps existing set-local path.
  Home CompactSelect displays count and switches summary, counts, feed, plans,
  check-in and links together, without changing primary local court.
- [x] Settings paid list with per-court switches and removal; free editor and
  auto sheet remain intact. Extend existing geofence service/provider to the
  enabled paid courts, with existing permissions/alerts/hold/leave lifecycle.
- [x] Inspect full card → drawer → court → Home → Settings journey at three
  sizes, both tiers and long names; exercise save/limit/switch/toggle/reload.
  Save route screenshots in `docs/preview/localplus-courts/` for the PR and
  inline handoff; draft PR #84 is the delivery destination after review.

Deployment boundary: author and verify migration locally first. AGENTS.md
requires Jesse to run production SQL; no live schema mutation, build or OTA
without explicit authorization. Deliver the concrete reviewed migration and
preview evidence before asking for that final action.

Verification: PostgreSQL 17 fixture runs the actual migration, original stored
functions, authorization/cap/concurrent-add/visibility/opt-in tests and rollback.
Seven pure rules cover free selection, explicit and legacy regions, concurrent
preference resolution and paid identifier decoding. Full 52-state × 3-size
rendering captured; no clipping/overlap failures. Existing baseline target/text
counts remain on older Schedule/Court Week surfaces; limits were not raised.
The interactive three-size journey exercised add/check/reload, Home switch,
Settings toggle/reload, unavailable removal, five entries, read recovery,
remove-all/empty Home, and free Home/Settings, with zero application page errors.
Screenshots use the actual exported components with isolated auth/data fixtures;
no production user data was mutated. Background iOS event delivery was not run
on this Linux host; it is not claimed as browser evidence.

Fresh whole-change review identified four important issues, all addressed in
one fix pass: legacy task-wide running state could opt the primary in; partial
court hydration could erase a verified list; inaccessible rows could strand
slots; auto eligibility omitted moderation visibility. Added failing cases,
then fixed them: CAS legacy resolution before new registration; a single
embedded saved/court/profile snapshot that throws on read failure; removable
unavailable membership rows; matching court visibility in auto eligibility.

Ruling: first saved court establishes primary only when none exists; removing
primary atomically chooses the oldest remaining court — preserves a valid
single-court fallback. Cost: that fallback can differ from the last Home view.
Ruling: unavailable courts retain a removable owner-only row — avoids hidden
slots and metadata leaks. Cost: the slot remains occupied until removal.
Ruling: freeze the inherited primary preference once with compare-and-set
before registering extras — an explicit concurrent setting wins. Cost: the
first updated native client resolves an otherwise device-only legacy choice.
Ruling: paid OS region identifiers are namespaced and decoded by the existing
task; expiry retires those registrations — avoids silently moving another
court's enabled state onto an opted-out primary. Cost: after downgrade the
player enables their one free court with the existing control.
Ruling: leave unrelated preexisting planner typography/target work outside
this correction, preserve its limits and keep the PR a review draft — avoids
expanding the approved scope. Cost: those older small controls remain.
