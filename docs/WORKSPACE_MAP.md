# LocalCheck workspace map

Last verified: 2026-07-26

## One active project

`/Users/JesseH/Projects/LocalCheck_Expo` is the only active top-level LocalCheck
workspace. It exactly matched GitHub `main` at `249c926ae3ac` before the current
documentation consolidation began.

The folder name is historical. Functionally, this is already a pnpm monorepo:
the root workspace includes `artifacts/*`, `lib/*`, and scripts. The shipping
Expo app is `artifacts/mobile`.

## Target structure

```text
LocalCheck_Expo/
  artifacts/
    mobile/       current shipping Expo app; keep this path stable
    web/          clean import from LocalCheck_WEB main; integration validation pending
  packages/       add only when real cross-platform code is ready to share
  docs/
    product/      product, design, launch, activity, and screen evidence
```

Expo's official monorepo guidance uses an apps directory plus shared packages,
but the workspace glob name is not important. Keeping `artifacts/mobile`
avoids disrupting the EAS GitHub base directory that just produced build 9.
EAS commands, `eas.json`, and `.eas/workflows` remain rooted in that app folder.

## Web consolidation plan

1. **Complete:** web `main` (`7a5b74d03aaa`) is under `artifacts/web` without dependencies or nested Git metadata; `UPSTREAM.md` records provenance.
2. Run its package-manager integration, checks, and preview from the monorepo when sufficient disk is available.
3. Compare the archived PR branch intentionally; promote only reviewed changes.
4. Extract shared brand/tokens/components into packages only after both apps build from their current locations.
5. Rename the GitHub repository/folder from `LocalCheck_Expo` to `LocalCheck` only as a later administrative migration, with Expo GitHub integration and every saved path updated together.

The imported web main still carries its upstream npm lockfile, while the parent
workspace uses pnpm. Preserve that snapshot until conversion is verified; do
not run a large root install with only about 300 MB free.

Do not move `artifacts/mobile` or rename the GitHub repository during active
release work merely for tidiness.

## Archived local material

All paths below are noncanonical and recoverable under
`/Users/JesseH/Projects/archive/`:

| Folder | Classification | Notes |
| --- | --- | --- |
| `LocalCheck_WEB_PR2-branch-2026-07-26` | Archived feature checkout | Not web main; preserves branch `cb60ad4` and uncommitted package changes. |
| `LocalCheck_JAWS-reference-2026-07-26` | Archived visual experiments | Current provisional Brand Asset Sheet was copied into `docs/product/references/`. |
| `LocalCheck_Expo-local-before-main-2026-07-26` | Archived old Expo checkout | About 2 GB; old branch/local dependencies; never build from it. |
| `LocalCheck_Expo-generated-files-2026-07-26` | Archived generated residue | Small, retained for provenance. |
| `LocalCheck_Expo-logo-before-monogram-2026-07-26` | Archived asset backup | Pre-experiment assets. |
| `LocalCheck-rejected-monogram-2026-07-26` | Rejected design exploration | Explicitly not approved identity. |
| `LocalCheck_Expo-preview-links-2026-07-26` | Empty preview placeholder | No product source. |

## Storage warning

At this checkpoint the data volume had roughly 259 MB free. Moving folders
into archive cleans the workspace but does not reclaim disk space. The largest
recoverable candidates are the roughly 2 GB old Expo checkout and roughly 1.1
GB archived web PR checkout. Deleting them requires a separate explicit
approval; until then they remain intact.
