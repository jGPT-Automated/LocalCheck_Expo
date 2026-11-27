# Compact court headers — branch evidence

**Superseded screenshots:** [November 18 Explore correction and all four hero surfaces](../2026-11-18-explore-complete/README.md). The initial measurements below describe the first #93 pass, not its final section/marker/circle layout.

Status: on branch, awaiting Jesse's review and native phone verification. No merge, production OTA, native build or backend mutation.

# Correction

PR #92 removed title fitting and allowed wrapping, producing unequal Explore cards. Restore a bounded single line using the existing shortName/full-name fallback. The fixed count column remains; CourtTitleRow now owns CourtArt's placement so count/label and artwork cannot drift through independent page offsets. Home, Explore, drawer, court detail and Settings court cards use that owner. This does not redesign Settings or edit the notification switch.

| Need | Existing candidate | Decision / reason | Files |
| --- | --- | --- | --- |
| Court identity across surfaces | CourtTitleRow | Reuse; one width/centering rule across callers | components/court/CourtParts.tsx |
| Compact Explore row | CourtListItem | Preserve gutters, palette, type and press behavior | components/CourtListItem.tsx |
| Decorative court trace | CourtArt | Reuse supplied SVG; anchor to live group; preserve detail-page faint variant | existing CourtArt, CourtTitleRow |
| Single-line fitting | React Native Text | Restore native adjustsFontSizeToFit with 11pt floor | CourtName.tsx |
| Browser parity | Installed RN Web Text | It ignores native fitting props; small platform adapter measures loaded font + available width | CourtName.web.tsx |

# References actually consulted

- User's TestFlight captures and compact court identity before #92; current production component is the visual reference. This is a correction, not a new visual design.
- React Native Text API: https://reactnative.dev/docs/text#adjustsfontsizetofit and https://reactnative.dev/docs/text#minimumfontscale . Cross-checked installed SDK54/RN Text types.
- React Native Web Text API: https://necolas.github.io/react-native-web/docs/text/ . Its documented props and installed Text implementation omit native fitting. Browser fitting must be tested separately.
- Local design rules: docs/product/DESIGN.md and .claude/skills/ui-done/SKILL.md.

# Evidence and limits

PNG files are screenshots of actual Expo web routes, with HTTP fixtures and WebSockets isolated from production. They are not generated mockups or live-player state. Paired captures use the same data/state/viewport on base 9cb2be0 and the correction.

The focused journey checks 320/375/393/430 widths, short-name preference, full-name fallback (Rancho Cienega Sports Complex), one-line fit, equal Explore row heights, title/count separation, count containment and horizontal/vertical artwork centers. The four-digit case populates the roster as well as count summaries and asserts the displayed value is actually 1000. Settings drawer is separately exercised with an unlocked fixture. The check-in journey exercises zero-to-one updates for both sports at 375x667, HTTP-isolated.

The shared screenshot runner now waits for the loaded court header/fonts on these routes, preventing the splash logo from being scored as a clean layout.

Native iOS/Android rendering, Dynamic Type, real-device safe areas and native fitting are NOT RUN. No claim of native acceptance. The 11pt floor protects readability; arbitrary unaliased names beyond tested content can still exceed a one-line allocation. The backend short-name field remains the normal display alias.

# Commands

- `pnpm check` — PASS (local pnpm wrapper disables automatic dependency replacement; dependencies/lockfile unchanged).
- `tsc --noEmit` and `git diff --check` — PASS.
- `EXPECT_COMPACT=1 node scripts/visual-qa/compact-court-journey.mjs URL OUTPUT` — focused rendered measurements; see measurements JSON.
- `SIZES=375 HOME_PAIR_ONLY=1 EXPECT_CENTERED_TITLE=1 node scripts/visual-qa/court-header-journey.mjs URL OUTPUT` — basketball/pickleball zero-to-one interaction PASS.
- `CHROMIUM_PATH=/usr/bin/chromium QA_ONLY=home-feed,court-live,explore QA_SIZES=375x667,393x852,430x932 pnpm qa:visual EXPORT --out OUTPUT` — no clipping/overlap/off-screen failures; existing Home debt exceeds the stored baseline. Baseline was not increased. Compare before audit receipts.

The PR remains a draft: this is reviewable branch work, not release approval or a declaration that every screen is fixed. Settings system, LocalList actions and Schedule remain separate approved-screen work.

# Measured result

| Width | Kasmiersky card before | Both Explore cards after | Art/circle center error (x/y) |
| --- | --- | --- | --- |
| 320 | not captured | 104pt | 0 / 0pt |
| 375 | 137pt | 104pt | 0 / 0pt |
| 393 | 137pt | 104pt | 0 / 0pt |
| 430 | 104pt | 104pt | 0 / 0pt |

40 focused states PASS, including displayed 1000 in Explore/Home/court detail; 3 premium Settings drawers PASS. Normal compact titles fit one line, full-name fallback fits down to 11.27pt in the narrowest tested state. Count columns remain 88/96pt. The no-wrap 375 title box changes 66→33pt on Explore and 74→37pt on Home/detail.

The ready-state audit captures 15 states with **0 clipping/overlap/off-screen failures**. It exits nonzero on four existing baseline exceedances: Home 393/430 each has 18 small-text nodes and one small GOING target; unchanged base has identical counts. No baseline increase and no unrelated style fix. See audit/report.md and before-audit-{393,430}/report.md.

# Before / after screenshots

## Explore

| Width | Before | After |
| --- | --- | --- |
| 375 | [Before](before/explore-375-short.png) | [After](after/explore-375-short.png) |
| 393 | [Before](before/explore-393-short.png) | [After](after/explore-393-short.png) |
| 430 | [Before](before/explore-430-short.png) | [After](after/explore-430-short.png) |

## Home

| Width | Before | After |
| --- | --- | --- |
| 375 | [Before](before/home-375-short.png) | [After](after/home-375-short.png) |
| 393 | [Before](before/home-393-short.png) | [After](after/home-393-short.png) |
| 430 | [Before](before/home-430-short.png) | [After](after/home-430-short.png) |

## Drawer

| Width | Before | After |
| --- | --- | --- |
| 375 | [Before](before/drawer-375-short.png) | [After](after/drawer-375-short.png) |
| 393 | [Before](before/drawer-393-short.png) | [After](after/drawer-393-short.png) |
| 430 | [Before](before/drawer-430-short.png) | [After](after/drawer-430-short.png) |

## Court

| Width | Before | After |
| --- | --- | --- |
| 375 | [Before](before/court-375-short.png) | [After](after/court-375-short.png) |
| 393 | [Before](before/court-393-short.png) | [After](after/court-393-short.png) |
| 430 | [Before](before/court-430-short.png) | [After](after/court-430-short.png) |

## Settings reused court card

- [Settings drawer 375](settings/settings-drawer-375-short.png)
- [Settings drawer 393](settings/settings-drawer-393-short.png)
- [Settings drawer 430](settings/settings-drawer-430-short.png)

[Full-name fallback at 320](after/explore-320-fallback.png) · [Actual 1000 on Home at 320](after/home-320-four-digit.png) · [All measurements](after/measurements.json)
