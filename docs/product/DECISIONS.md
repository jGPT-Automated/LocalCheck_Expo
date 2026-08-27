# LocalCheck Design Decisions

Status: Current MVP decisions. Newer dated decisions supersede older entries.

## 2026-08-13 — Home matches the established tab-header treatment

**Decision confirmed by Jesse:** Home uses the same mark, title typography,
height, and spacing as Schedule, Compete, Explore, and Me. The thin full lockup
remains available for dedicated brand moments, but not primary tab headers.

**Why:** The established tab headers read better in the product context, and a
single shared treatment prevents Home from looking like a separate system.

## 2026-08-12 — Final logo geometry owns every brand lockup

**Decision confirmed by Jesse:** `localcheck-logo-final.svg` is the source of
truth wherever the product spells LocalCheck. Its extracted mark and supplied
chevron are used for icon-only contexts. The W/L variants remain reserved for a
future head-to-head treatment and are not placed in activity or navigation.
Court detail matches the source lockup's icon/title spacing and uses an
edge-aligned `LOCALCOURT` / `SET LOCALCOURT` label instead of the star.

**Why:** One source asset prevents the wordmark, header icon, and detail-back
treatment from drifting while leaving result-specific W/L placement available
for deliberate review later.

## 2026-08-11 — Ranking membership follows saved player identity

**Decision confirmed by Jesse:** Preserve the existing Compete scopes: Local is
the player's saved home court, Regional is that court's market/city, and Global
is nationwide. Within every scope, the saved preferred sport is authoritative;
when it is empty, the saved home court's sport is the fallback. A player with
neither a preferred sport nor a home court does not appear in sport rankings.

**Why:** Basketball and pickleball must not filter the same shared list, and a
missing home court must never make Local or Regional silently behave as Global.

## 2026-08-11 — Compete uses an explicit Log Game action

**Decision confirmed by Jesse:** Compete places a compact rectangular
`+ LOG GAME` action beside the ranking filters. It opens the existing game form
directly; it is not a floating pencil button or an expandable speed dial.
Player-profile and QR routes continue to open the same form with the opponent
prefilled.

**Why:** Logging a game is a named Compete action, not a generic edit. Keeping
it in the ranking controls makes it discoverable without repeating the
Schedule tab's floating creation pattern.

## 2026-08-11 — Court verification requires an on-site camera capture

**Decision confirmed by Jesse:** Add Court communicates three requirements:
a live location pin, a basketball or pickleball court, and a live photo. The
verification photo must come from the device camera; selecting an existing
image from the photo library is not offered.

**Why:** Pairing an on-site pin with a live capture keeps unrelated or saved
court images from populating the map and makes the verification promise clear.

## 2026-08-09 — Shared MVP visual system and interaction hierarchy

**Decision confirmed by Jesse:** Keep the working SDK 54 application and make
material MVP improvements through shared components. The Brand Asset Sheet is
the authority for the mark, `#FF5500`, graphite surfaces, Oswald display type,
and Inter body type. Edited surfaces use the real mark or library icons—never
ASCII, emoji, handcrafted SVG, or one-off icon drawings. Player identity,
profile heroes, metrics, selectors, run cards, activity, sticky actions, court
cards, and speed-dial actions each have one shared implementation.

**Why:** The product is close enough to validate. A rewrite would delay user
learning, while continued spot-editing would preserve inconsistency and make
every future iteration expensive.

## 2026-08-09 — Explore cards open a contextual court sheet

**Decision confirmed by Jesse:** Explore court cards show concise identity,
active-now and local counts. They do not contain Check In, View Court, or Set
Local actions. Tapping a card opens a short bottom sheet with Check In and View
Court; pulling the sheet up reveals Who's Here and Locals. Only the actual
local court displays a filled star.

**Why:** The card remains easy to scan, while the contextual sheet provides
reachable actions without turning every discovery result into a large form.

## 2026-08-09 — Court routes are read-only place dashboards

**Decision confirmed by Jesse:** A court route has a fixed branded header,
full-width six-metric panel, and Feed, Locals, Schedule, and Details tabs. Feed
is progressively loaded, Locals shows the full community, Schedule is a clean
read-only heatmap and run view, and Details owns name, shorthand, status,
address, date added, and map preview. Check-in and planning edits do not live
on this route.

**Why:** The route answers what is happening at a place without duplicating
the local player's action workflow. The primary Schedule tab remains the
source of truth for editing the player's local-court availability and runs.

## 2026-08-09 — Sport selectors are compact and reflect real sport data

**Decision confirmed by Jesse:** Explore and Compete reuse one compact
library-icon dropdown pattern. Compete displays `BB` / `PB` only where the
underlying records are actually scoped by sport; it must not relabel one shared
rating as two rankings.

**Why:** A rarely changed setting should not consume a full row, and visual
filters must remain honest about backend data.

## 2026-07-29 — Home is a fixed court hub, not a discovery card

**Working decision confirmed by Jesse:** Home presents the local court as one
full-width matte page section. It uses a quiet sport-ball mark, thin sport
metadata, centered confirmed activity stats, and a restrained local-court
label. `Who's Here` owns its inline `View all` action. The header, court
summary, roster, and Next Run remain fixed; only the Activity Feed scrolls.
Reusable court cards remain on Explore and map selection surfaces.

**Why:** Home is the player's personal court hub, not a discovery result. A
full-width section gives the page one clear structure, removes the detached
count control, avoids conflicting blue/green slabs, and keeps the court truth
visible while the longer activity history moves.

## 2026-07-27 — Explore is local-first, bounded, and sport-identifiable

**Superseded interaction detail:** The bounded/local-first query and restrained
sport identity remain current. The 2026-08-09 decision supersedes the old
instruction to place Check In inside each card.

**Why:** A player's local court is more personally relevant than a generic nearest result, bounded queries respect Supabase and device resources, and sport-specific geometry/color helps courts read quickly without turning the entire app into competing sport themes.

## 2026-07-27 — Map points use native style layers and bounded clustering

**Working decision confirmed by Jesse's marker feedback:** Map court points render through Mapbox GeoJSON sources and style layers on both web and native. Built-in clustering groups dense points at low zoom and expands on interaction. The viewport request remains debounced and bounded, and when a local market exists the database query includes that market rather than downloading every court inside a broad map rectangle.

**Why:** Map-native layers remain attached to geographic coordinates during pan and zoom, avoid the transform conflicts of DOM markers, and are Mapbox's documented scalable path. Market plus viewport scoping keeps the visual result relevant and the Supabase read bounded.

## 2026-07-27 — Do not present fake sport-specific rankings

**Superseded presentation detail:** The honesty requirement remains current.
The 2026-08-09 decision permits a compact BB/PB selector only when the queried
records are genuinely sport-scoped.

**Why:** Basketball and pickleball ranks should not be combined or cosmetically separated. Real sport toggles require real per-sport match/rating data. Privacy presentation must also avoid the contradictory state where the same player is both public and hidden.

## 2026-07-27 — Durable check-ins with viewer-scoped realtime

**Working decision confirmed by Jesse:** A check-in is durable server state, not an online-presence signal. Locking a phone, backgrounding the app, losing a connection, or leaving a court screen must not check the player out. While a signed-in player is actively viewing a relevant court or market, that screen should receive scoped live invalidations and refresh without navigation. When the app becomes inactive, remove those subscriptions; when it becomes active again, run one scoped catch-up query for the visible experience. Users and courts that are not being viewed do not need live client subscriptions.

**Why:** “Realtime” means two people looking at the same court see a check-in/out converge immediately. It does not mean treating a WebSocket as proof that someone is physically at a court, keeping every court globally subscribed, or polling while nobody is looking. Durable database truth plus scoped delivery gives the intended experience without coupling attendance to phone state or wasting Supabase resources.

## 2026-08-26 — Profile Inbox is an action queue

**Decision confirmed by Jesse:** The Profile `INBOX` tab and Me-tab badge contain only items that still require the player to act: pending friend requests, game/score reviews, run invitations, and future game invitations. Informational events such as an accepted friend request or confirmed game remain in the notification feed and do not badge Profile Inbox.

**Why:** Mixing completed updates with pending decisions hides the work that matters. A bounded action queue makes the badge meaningful while preserving notification history separately.

## 2026-08-26 — Profile and Compete use the supplied release references

**Decision confirmed by Jesse:** Profile and Compete follow the approved 402×874 reference layouts. Profile uses the shared large tab header, avatar-as-QR affordance, right-aligned ELO, a three-stat strip, and Activity/Friends/Inbox tabs. Compete uses the same header, Leaderboard/Log Game tabs, equal-height sport and scope controls, a compact court label, quiet rank numbers, compact identity metadata, and right-aligned ELO.

**Why:** These two release-critical screens should read as one intentional product, not independently styled dashboards.

## 2026-08-27 — Log Game uses format-first rosters and native dates

**Decision confirmed by Jesse:** Log Game must support solo and team games,
must not use a free-typed date, and must show a centered five-second score
review with a visible progress trail, Edit, and Confirm. Format is selected
before participants; every player slot reuses the same search and player-QR
identity contract.

**Why:** Match format determines the roster the user must complete. Platform
date controls prevent malformed dates, while one participant selector keeps
solo and team logging predictable instead of layering unrelated controls.

## 2026-07-26 — Unified primary-tab header

**Working decision confirmed by Jesse:** Use the LocalCheck mark and current tab title as one repeated header lockup across Home, Schedule, Compete, Explore, and Profile. The title must share the wordmark's typographic language. Remove the profile avatar from the top-right of primary tab headers; the `Me` tab is the profile entry point.

**Why:** The current Schedule header feels assembled from unrelated parts. A shared lockup creates continuity between tabs, while the extra avatar competes with the title and duplicates navigation.

## 2026-07-26 — Schedule uses a multi-select edit mode

**Working decision confirmed by Jesse:** Keep the weekly grid readable by default. `Edit My Times` enters an edit mode where the player can toggle multiple planned time slots, then select `Done` once to add the batch to the shared heatmap.

**Why:** Selecting one square and confirming it before selecting another makes a naturally repetitive planning task slow and annoying. Batch editing preserves context, makes comparison easy, and maps to how players think about a week.

## 2026-07-26 — Court pages use predictable content tabs

**Updated by 2026-08-09:** Court routes use `Feed`, `Locals`, `Schedule`, and
`Details`. The 2026-08-09 read-only court-route decision is authoritative.

**Why:** The current full court page stacks unrelated sections into a long scroll. A stable three-part information architecture makes every court predictable and lets players move directly between activity, people, and place information.

## 2026-07-26 — Standard sheets, modal forms, and native date/time controls

**Working decision confirmed by Jesse:** Keep the existing proven `@gorhom/bottom-sheet` primitive for the contextual court preview. Present task forms through a standard native/Expo modal shell, and replace the custom Host a Run day/time grids with Expo-supported native date and time pickers. Standardize the shell, safe areas, handle, header, close action, keyboard behavior, and motion across these presentations.

**Why:** Build 9 shows two visually unrelated drawer styles, while the Host a Run time selection feels unfamiliar and unintuitive. The problem is not a lack of custom design; it is failure to consistently apply familiar mobile interaction patterns.

## 2026-07-26 — One accent and one shared component source

**Working decision confirmed by Jesse:** `#FF5500` is the only LocalCheck identity orange. Remove alternate orange values from product UI and route every screen through shared color tokens and approved component variants.

**Why:** Slightly different oranges and screen-local controls make the app feel assembled rather than designed. Semantic win/live and loss/error colors remain limited to their actual meanings and never replace the brand accent.

## 2026-07-26 — Working identity base, not final logo

**Working decision:** Use `references/Brand Asset Sheet.dc.html` as the current visual starting point. The bracketed-check concept is the right category of mark, but its present construction and typography are not approved as final.

**Why:** The current brackets feel awkward, the checkmark is not integrated into the surrounding geometry, and the mark is optically unbalanced. The geometric/code-like typographic character is promising, but the current display face feels too heavy and bulky. Logo and typography changes remain a collaborative design decision before implementation.

## 2026-07-26 — One shared planning contract

**Working decision:** The Expo app uses the production `planned_visits` model
for every platform target. Do not introduce a second representation of the
same user intent.

**Why:** Parallel planning models create split user state, duplicated privacy
rules, and competing Realtime paths for one product job.

## 2026-07-26 — Release evidence before distribution

**Working decision:** No new TestFlight build or App Store submission is triggered until the release commit, environment target, automated checks, and required runtime test evidence are recorded in the pull request. Jesse remains the explicit release authority.

**Why:** The latest mobile source includes a native Mapbox change and new fingerprint, so its OTA cannot reach the existing TestFlight build. A new binary is necessary, but distribution without a verified release candidate would merely move uncertainty onto pilot users.

## 2026-07-23 — One identity accent

**Proposed decision:** Use `#FF5500` as the single LocalCheck identity accent. Sport remains metadata rather than a theme color.

**Why:** The previous basketball-orange/pickleball-green theming fragmented the brand and made component meaning depend on color. Labels, icons, geometry, and imagery distinguish sport more accessibly.

## 2026-07-23 — Court passport information model

**Proposed decision:** Replace name + sport + two counters with a shared court identity ordered as Identity, Live truth, People, Next run, Access, Actions.

**Why:** A court is a place and a community. Players need enough information to decide whether to go now or plan later.

## 2026-07-23 — Remove sport side stripes

**Proposed decision:** Do not use colored left-edge bars to classify court cards or feed items.

**Why:** Side stripes read as generic dashboard decoration and compete with the live/primary-action meaning of orange.

## 2026-07-23 — Honest imagery and activity

**Proposed decision:** Generated court media is atmospheric only. Venue identity uses verified photography or map geometry. Zero activity uses `Quiet now` and a useful action instead of fabricated counts.

## 2026-08-13 — Peer profiles separate comparison, activity, and details

**Working decision confirmed by Jesse:** Other-player profiles use `VS YOU`,
`ACTIVITY`, and `DETAILS` tabs. The hero shows the player name, local court, and
ELO without a long username or member-since line. Member date, global sport
rank, local court, real recent activity, report, and block live in Details.

**Why:** Comparison, timeline, and account metadata are different jobs. A
segmented peer profile keeps each one scannable, prevents safety controls from
competing with Log Game, and lets the head-to-head treatment feel distinct from
the primary player identity row.
