#!/bin/bash
# Installs dependencies so `pnpm typecheck` and `pnpm test` work in Claude Code cloud sessions.
set -euo pipefail

if [ "${CLAUDE_CODE_REMOTE:-}" != "true" ]; then
  exit 0
fi

cd "${CLAUDE_PROJECT_DIR:-$(pwd)}"

# package.json pins pnpm via "packageManager"; corepack provides that exact version.
if ! command -v pnpm >/dev/null 2>&1; then
  corepack enable
fi

pnpm install --frozen-lockfile
