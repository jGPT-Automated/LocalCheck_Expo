---
name: localcheck-design
description: Use this skill to generate well-branded interfaces and assets for LocalCheck — the dark, map-first basketball and pickleball court explorer — for production code or throwaway prototypes, mocks, and decks. Contains the brand's colors, type, shape, motion, iconography, voice rules, and a UI kit.
user-invocable: true
---

Read the README.md file within this skill, then `styles.css` for tokens and `.lc-*` primitives, and explore `preview/` and `ui_kits/` for built examples.

Non-negotiables when designing as LocalCheck:
- **Orange (`#fc4c02`) means live.** Never use it decoratively.
- **Two fonts:** Oswald (condensed display + all numerals) and Inter (everything else, including the 820-weight hero H1). Reproduce the odd variable weights literally.
- **Dark by default**, at most one `#f0efeb` paper band per page.
- **Sport is encoded by tint and court geometry** — tan `#d8b58d` for basketball, sea green `#9ccfbe` for pickleball.
- **Never fabricate activity.** Zero counts and empty states are designed, honest states.
- No emoji, no exclamation marks, no photography of people, no illustration.

If creating visual artifacts (slides, mocks, throwaway prototypes), copy the assets you need out of `assets/` and write static HTML that links a copy of `styles.css`. If working on production code, copy assets and read the rules here to become an expert in this brand.

If the user invokes this skill without other guidance, ask what they want to build, ask a few sharp questions, and act as an expert designer who outputs HTML artifacts *or* production code depending on the need.
