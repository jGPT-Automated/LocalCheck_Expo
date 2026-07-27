# LocalCheck Reference Evaluations

Status: Reference notes only. A listed reference is not approved for production until its decision point is confirmed.

## 2026-07-26 — Saved browser resources

Saved from the working browser before tab cleanup. These are reference bookmarks, not approved dependencies or design direction.

### Design and mobile UI

- [Material Design 3 — Layout](https://m3.material.io/foundations/layout/layout-overview/overview)
- [App Store Tracker — App Design Library](https://www.appstoretracker.com/designs)
- [Jesse's GitHub Design list](https://github.com/stars/jGPT-Automated/lists/design)
- [UI Vault — Bold, Premium UI Resources](https://en970.github.io/ui-vault/)
- [Asoinspo — App Store screenshot inspiration](https://www.asoinspo.com/)
- [Logosystem — Logo and animated-logo inspiration](https://logosystem.co/)
- [Tubik — 15 basic mobile screen types](https://tubikstudio.com/blog/mobile-ui-design-15-basic-types-of-screens/)
- [Jesse's liked shots on Dribbble](https://dribbble.com/agent-jess/likes)

### Reference signals for the collaborative design pass

- App Store presentation: one clear benefit per frame, decisive hierarchy, and real product UI rather than decorative mock screens.
- Jesse's liked mobile work: high contrast, confident device composition, map-led product moments, strong type, and restrained bright accents.
- Logo systems: integrated construction and useful negative space; the symbol must remain balanced and recognizable at app-icon scale.
- Mobile structure: familiar navigation and interaction behavior beneath a distinctive visual layer.
- These signals set a quality bar. They are not permission to copy a reference or alter LocalCheck without review.

### LocalCheck project administration

- [Supabase — LocalCheckProd authentication providers](https://supabase.com/dashboard/project/qkrnmyexzvaxiqfxwwfb/auth/providers)
- [Expo — LocalCheck workflows](https://expo.dev/accounts/agenticjess-os/projects/localcheck/workflows)
- [Mapbox — Access tokens](https://console.mapbox.com/account/access-tokens)

### Current visual base

- `references/Brand Asset Sheet.dc.html` — current working identity and interface base, explicitly provisional. The bracketed-check idea is directionally right; its construction, balance, and display typography still require collaborative exploration.

## 2026-07-24 — Canvas UI

Source: [canvasui.dev](https://canvasui.dev/)

### What it is

Canvas UI is an open-source collection of HTML-in-canvas and WebGL effects distributed as source through a shadcn-compatible registry. It offers React and framework-agnostic implementations. Its components are creative effects layered over or derived from live HTML, not a replacement for LocalCheck's tokens, components, content hierarchy, or accessibility contract.

### Potential LocalCheck fit

- A single, restrained website marketing transition after the court identity has been approved.
- `Particle Scroll` is the closest conceptual match to a card or device composition dissolving and reassembling during a scroll chapter.
- `Dithered Object` could support a deliberately editorial 3D object treatment if a real device model and performance budget are approved.
- Effects must preserve ordinary HTML as the functional layer, respect reduced motion, pause off-screen, and degrade without blocking navigation or content.

### Poor fits for the current direction

- Cursor toys across the whole site.
- Glass, liquid, glitch, VHS, fire, or sci-fi scanner effects on core product UI.
- Replacing the map hero, court identity, mobile interface, or native scroll behavior with a WebGL effect.
- Depending on an experimental browser-only capability for essential content.

### Recommendation

Do not add Canvas UI during the brand-foundation or court-card phases. Revisit one isolated effect only after the website composition is approved. The default recommendation is `Particle Scroll` as an optional prototype, compared against a lighter native CSS/scroll implementation before adoption.

### Pending decision

Clarify whether Canvas UI was supplied as inspiration to evaluate or as a requested implementation dependency/effect library.

### Installation and MCP scope

- If this is ever approved, run it from the future canonical web app root under `artifacts/web`, not the user home directory, the `/Users/JesseH/Projects` umbrella, or the Expo mobile app.
- The component source, dependencies, aliases, and optional registry pin are project-local through that application's `components.json` and package manifest.
- MCP configuration only gives an AI client access to browse and invoke the shadcn registry tools. It does not install Canvas UI components globally and does not replace each project's `components.json`.
- Codex and Claude Code do not share one MCP configuration file. Codex reads its own user configuration; Claude Code supports local, project, and user scopes in its own configuration.
- Current-machine observation on 2026-07-24: Codex already has a user-level `shadcn` MCP entry in `~/.codex/config.toml`, but its `cwd` is pinned to `/Users/JesseH/Documents/Agents/Skills`. That path should be reviewed before relying on the server for LocalCheck. No user-level configuration was changed during this review.
