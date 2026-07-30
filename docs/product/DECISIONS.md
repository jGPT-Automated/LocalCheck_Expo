# LocalCheck Design Decisions

Status: Proposed. Nothing in this file is locked until the corresponding roadmap gate is confirmed by the user.

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

**Working decision confirmed by Jesse:** Explore uses a full-width `List` / `Map` switch. The list features `My Local Court`, then a small market/city-scoped set of relevant courts with `View All`; it does not download or foreground an unbounded global catalog. Court cards show active and local counts and carry their Check In action inside the card. Basketball blue and pickleball green may appear only as restrained metadata in a monochrome-style sport emblem, faint court geometry, and a smoked background hue. Court cards do not use a colored side stripe or a separate action row. LocalCheck orange remains reserved for live state and primary actions.

**Why:** A player's local court is more personally relevant than a generic nearest result, bounded queries respect Supabase and device resources, and sport-specific geometry/color helps courts read quickly without turning the entire app into competing sport themes.

## 2026-07-27 — Map points use native style layers and bounded clustering

**Working decision confirmed by Jesse's marker feedback:** Map court points render through Mapbox GeoJSON sources and style layers on both web and native. Built-in clustering groups dense points at low zoom and expands on interaction. The viewport request remains debounced and bounded, and when a local market exists the database query includes that market rather than downloading every court inside a broad map rectangle.

**Why:** Map-native layers remain attached to geographic coordinates during pan and zoom, avoid the transform conflicts of DOM markers, and are Mapbox's documented scalable path. Market plus viewport scoping keeps the visual result relevant and the Supabase read bounded.

## 2026-07-27 — Do not present fake sport-specific rankings

**Working decision confirmed by Jesse's concern:** Remove `All / BB / PB` from Compete while the backend stores only one overall Elo. Local scope may identify the local court's sport, but the UI must not relabel the same underlying standings as separate rankings. A hidden current user appears once, inline at the would-be position in the owner's view, without changing public row numbering.

**Why:** Basketball and pickleball ranks should not be combined or cosmetically separated. Real sport toggles require real per-sport match/rating data. Privacy presentation must also avoid the contradictory state where the same player is both public and hidden.

## 2026-07-27 — Durable check-ins with viewer-scoped realtime

**Working decision confirmed by Jesse:** A check-in is durable server state, not an online-presence signal. Locking a phone, backgrounding the app, losing a connection, or leaving a court screen must not check the player out. While a signed-in player is actively viewing a relevant court or market, that screen should receive scoped live invalidations and refresh without navigation. When the app becomes inactive, remove those subscriptions; when it becomes active again, run one scoped catch-up query for the visible experience. Users and courts that are not being viewed do not need live client subscriptions.

**Why:** “Realtime” means two people looking at the same court see a check-in/out converge immediately. It does not mean treating a WebSocket as proof that someone is physically at a court, keeping every court globally subscribed, or polling while nobody is looking. Durable database truth plus scoped delivery gives the intended experience without coupling attendance to phone state or wasting Supabase resources.

## 2026-07-26 — Unified primary-tab header

**Working decision confirmed by Jesse:** Use the LocalCheck mark and current tab title as one repeated header lockup across Home, Schedule, Compete, Explore, and Profile. The title must share the wordmark's typographic language. Remove the profile avatar from the top-right of primary tab headers; the `Me` tab is the profile entry point.

**Why:** The current Schedule header feels assembled from unrelated parts. A shared lockup creates continuity between tabs, while the extra avatar competes with the title and duplicates navigation.

## 2026-07-26 — Schedule uses a multi-select edit mode

**Working decision confirmed by Jesse:** Keep the weekly grid readable by default. `Edit My Times` enters an edit mode where the player can toggle multiple planned time slots, then select `Done` once to add the batch to the shared heatmap.

**Why:** Selecting one square and confirming it before selecting another makes a naturally repetitive planning task slow and annoying. Batch editing preserves context, makes comparison easy, and maps to how players think about a week.

## 2026-07-26 — Court pages use Feed, Locals, and Details tabs

**Working decision confirmed by Jesse:** Keep the court's identity, live summary, and primary action above a court-local tab view. Use three tabs in this order: `Feed`, `Locals`, `Details`. Feed includes live/chronological activity and upcoming runs; Locals owns the community view; Details owns venue facts and access information.

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

## 2026-07-26 — Working cross-project authority map

**Working decision confirmed by workspace consolidation:** `LocalCheck_Expo` is the one active product workspace. Product/brand/launch truth lives under `docs/product`, mobile ships from `artifacts/mobile`, and a clean web main is planned for `artifacts/web`. The old web PR and JAWS workspaces are archived. `agents` supplies reusable methods, not product requirements.

**Why:** The previous map named a nonexistent `/Users/JesseH/Projects/LocalCheck_Web` folder and promoted a JAWS specimen whose sport-color and identity rules conflict with the current design contract.

## 2026-07-26 — One shared planning contract

**Proposed decision:** Web planning should converge on the production `planned_visits` model instead of introducing `court_time_intents` as a second representation of the same user intent.

**Why:** Mobile and web share LocalCheckProd. Parallel planning tables create split user state, duplicated privacy/security rules, and two realtime paths for one product job.

## 2026-07-26 — Release evidence before distribution

**Working decision:** No new TestFlight build or App Store submission is triggered until the release commit, environment target, automated checks, and required runtime test plan are recorded in `LAUNCH_CONTROL.md`. Jesse remains the explicit release authority.

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

## 2026-07-23 — Coordinated, not identical, platform expression

**Proposed decision:** Web may use a warm-paper editorial section; mobile remains predominantly graphite. Shared tokens, hierarchy, court identity, voice, and motion make the family coherent.

**Why:** Platform context differs. Consistency is a shared grammar, not a single screen skin.

## 2026-07-23 — Honest imagery and activity

**Proposed decision:** Generated court media is atmospheric only. Venue identity uses verified photography or map geometry. Zero activity uses `Quiet now` and a useful action instead of fabricated counts.
