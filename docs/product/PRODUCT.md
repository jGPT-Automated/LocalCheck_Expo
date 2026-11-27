# Product context

## LocalPlus saved courts on PR 93

The proposed backend uses the same five visible courts for the picker and auto check-in. If an archived court returns after the player fills its place, a stored court outside the five stays inactive. An explicit Off at the default survives subscription expiry. Players can add up to five courts to the visible list. Explore lists them first. Home and Schedule each choose which court to view. Settings chooses the default and which individual courts should trigger auto check-in. See the [tested flow](design-qa/2026-11-27-locallist/README.md) and CURRENT_STATE for deployment status.

## November 22 — main Settings row correction (on branch)

Main Settings has clearer labels/descriptions, consistent grouping and gutters,
and long values can wrap without clipping. Push notifications use the existing
native control and preference handler; this is a layout correction, not a push
registration/delivery change. LocalList's editor/persistence are not completed
by this main-page pass. Native phone acceptance remains pending.

## November 18 — Explore correction on PR #93

Explore clearly separates saved and nearby courts with matching section labels.
Default status is attached to its court. Compact court names and live counts fit
across phone widths; the count sits inside the same court-art circle on Home,
Explore, court detail and expanded drawer. Search placeholders are readable and
clear has a full touch target. No selection, persistence, check-in or notification
policy changes. Screenshot review and native phone acceptance remain distinct.

## November 17 — compact court-card correction (on branch)

Explore court cards return to a compact single-line name with width-based
fitting. The same court identity is used by Home, court drawers, full court
detail and saved-court cards. Existing short names remain preferred. The court
trace stays aligned to the live-count group. No court selection, check-in,
notification or persistence behavior changes. Native phone review is pending.

## November 17 — first screenshot correction on #92

Actions no longer display temporary drop-down banners inside the app. Their
screen state still updates, with existing native tactile feedback and spoken
feedback for screen-reader users. Court headers keep the name/count layout
stable after check-in and centre the count beside names that wrap.

## November 14 — branch UI preview

The #91 follow-up prepares LocalList: LocalPlus users add courts from the court
plus and see the same list on Explore, Settings and Home. Settings' star chooses
the default first court; page selectors only change the view. This pass stores
the extra list/default only in memory, not in the backend or device storage.

Home's fixed LOCALCHECK header shows a five-minute automatic pending countdown
or elapsed confirmed session time. Cancel/Post controls stay by the hero;
Post awaits the separate backend action and is disabled. Manual check-in posts
immediately and has no new waiting window. Compact inbox history remains
independent of phone-alert preference, with recorded own-event metadata.

## Notifications log — November 8 frontend slice

The Notifications screen lists existing own-event notices and incoming alerts
newest first. It loads 20 at a time with Load more, uses exact local date/time,
and keeps unread status separate from event visibility. Phone-alert opt-out
does not remove inbox history. An own-event audience label appears only when
the notification payload explicitly includes visibility; absent historical
metadata is not guessed. Complete own manual-event history and historical
privacy snapshots await backend implementation after UI approval.



LocalCheck is the live layer for local pickup sports. It helps players
understand a court before leaving home, check in when they arrive, organize the
next run, and recognize the people who make a court a community. Launch sports
are basketball and pickleball.

## Primary users

- Regular players who loosely plan their week around a home court.
- Players deciding whether a nearby court is active enough to visit now.
- Newcomers who need honest venue facts and a legible local community.

## Core jobs

1. Know before you go: see court identity, current activity, access facts, and
   the next likely run.
2. Check in: improve the live picture without exposing private identities.
3. Plan: signal intent, coordinate runs, and reduce group-message overhead.
4. Belong: recognize friends, locals, and a player's home-court relationship.
5. Compete: submit reviewed results and maintain sport-specific standings.

## Non-negotiable truths

- A court is a shared destination and community identity, not a name plus two
  counters.
- Home, Explore, the map sheet, and Court detail use one court identity model at
  different densities.
- Court opens on Feed: a linked hourly chart and timeline of past activity,
  current visible presence and upcoming planned attendance. Scrub an hour,
  scroll its rows or switch days. Going adds/removes a planned visit using
  the existing server contract; it does not check in or join a game.
- Court tabs are Feed / Schedule / Players / Info. Schedule combines the
  heatmap and upcoming games; tapping a heatmap block opens its exact start
  hour in Feed, including the current two-hour block. Completed blocks remain disabled.
- Home and the court drawer stay compact action dashboards: who's here, the
  next scheduled game and selectable daily planning. Their Court link opens
  Feed. Event history and duplicate court tab pills live off the dashboard.
  Existing LocalPlus/free visibility rules are unchanged.
- Orange identifies LocalCheck, live truth, check-in and selection. Other
  primary actions are white (D56).
  Sport is metadata, not a competing theme.
- Counts and venue attributes are real. Empty states explain confirmed zeroes;
  failures do not masquerade as zero.
- Generated media may be atmospheric only. It never represents a real venue.
- Durable product state lives in Supabase and is protected by RLS.
- Privacy is enforced by data access and aggregation, not by hiding a control.

## Brand register and accessibility

The register is premium athletic and editorial: confident, direct, sharp,
physical, and useful. Avoid generic dashboards, hacker neon, gaming tropes, or
decorative card collections.

Meet WCAG AA contrast, support bright outdoor use, provide 44x44 minimum touch
targets, label controls, communicate state without color alone, and replace
spatial motion with concise alternatives when reduced motion is enabled.
