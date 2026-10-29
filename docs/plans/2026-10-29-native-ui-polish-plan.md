# Native UI polish implementation plan

Superseded in part by Jesse's correction (D64): removing CourtArt and adding
an inert card chevron were rejected. Keep court-line art, remove the corner
arc across the court flow, and use the shared functional plus/check. The
historical proposal below records the agent's rejected direction, not the
current design contract. See DESIGN.md and PR #84 for the correction.

> Execute inline with superpowers:executing-plans; one fresh whole-branch
> review at the end. User requested implementation and an unmerged preview PR.

Goal: refine Explore cards and Home header using the supplied references.
Spec: `2026-10-29-native-ui-polish-design.md`.
Architecture: reuse CourtListItem, HomeCourtHero, SportLabel and MetricStrip.
Stack: existing Expo SDK 54, React Native, Feather and semantic Colors tokens.

Constraints: no new copy/dependency/backend/native build; preserve scrolling,
sticky controls, tab floor, set-local action on detail/drawer and real data.
Review focus: long names, four-digit stats, 375px caption width, live counts,
and shared captions on court/drawer. Browser captures are not native evidence.

- [x] Explore: remove decorative art/quarter-circle from CourtListItem,
  replace with a noninteractive Feather chevron, surface/panel tokens,
  26/30 title with two-line recovery, 12pt place; preserve card navigation.
- [x] Home: remove redundant art/local marker from HomeCourtHero,
  left-align 32/36 title and 12pt place; preserve sticky name/stat ownership.
- [x] Shared labels: SportLabel 11pt; MetricStrip caption 11pt Inter medium,
  zero tracking; existing stat sizes and units retained. Inspect all consumers.
- [x] Add visual fixtures for a long court name and four-digit counts;
  capture top/scrolled Home, Explore and drawer navigation at three sizes.
- [x] Run check:release, diff checks, full visual QA and compare with base.
  Record preexisting debt without raising limits. Review all changed surfaces.
- [ ] Update current state, feedback, product/design and user decision docs;
  commit/push and open PR against main. Check actual preview jobs/links;
  provide inline screenshots. No merge or production release.

Ruling: user explicitly delegated polish using their taste and asked for the
PR as preview/review; proceed on that authorization. The proposed appearance
is the agent's design call, not a claim Jesse separately approved each detail.

Verification so far: check:release passes with TMPDIR=/tmp (263 tests,
TypeScript, design/docs checks and connected export). Initial command failed
because inherited TMPDIR pointed at absent /private/tmp; rerun succeeded.
Connected runtime assertions passed at 375/393/430: Home title reaches sticky
position, Explore opens court drawer, footer stays reachable through expand
and scroll, Players navigates to court, zero page errors. Fresh review found
no functional/layout issue; one stale Home documentation sentence corrected.
Native runtime not executed on this Linux host; no native build triggered.

Final visual run: 46 states × 3 phone sizes = 138 captures, zero hard layout
failures. Existing accessibility overages decreased from 23 to 19. No new
over-baseline entries; limits only decreased, with new cases bounded by their
observed existing debt. Raw runs: /tmp/localcheck-polish/qa-{375,393,430}.
The first serial run was interrupted by a new user turn after 134 captures;
reran all states independently per size and added per-state progress evidence
so interrupted runs no longer lose completed audit output. Single-size report
counts now reflect the requested viewport count. Visual QA remains nonzero
for existing small targets/labels on Home charts, Court Week and Schedule.

Ruling: do not expand this focused polish into a planner redesign merely to
clear preexisting accessibility debt; expose it in the draft PR. Cost: those
older small targets/labels remain until their dedicated layout pass.
