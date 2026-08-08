#!/usr/bin/env bash
set -euo pipefail

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ERRORS=0

pass() { printf 'ok    %s\n' "$1"; }
warn() { printf 'warn  %s\n' "$1"; }
fail() { printf 'fail  %s\n' "$1"; ERRORS=$((ERRORS + 1)); }

cd "$PROJECT_ROOT"

if command -v node >/dev/null 2>&1; then
  NODE_MAJOR="$(node -p 'process.versions.node.split(".")[0]')"
  if (( NODE_MAJOR >= 22 )); then pass "Node $(node --version)"; else fail "Node 22+ required; found $(node --version)"; fi
else
  fail 'Node is not installed'
fi

if command -v pnpm >/dev/null 2>&1; then
  pass "pnpm $(pnpm --version)"
else
  fail 'pnpm is not installed; run: corepack enable && corepack prepare pnpm@10.13.1 --activate'
fi

[[ -d node_modules ]] && pass 'dependencies installed' || fail 'dependencies missing; run: pnpm install --frozen-lockfile'
[[ -f .env ]] && pass '.env present' || fail '.env missing; run: cp .env.example .env'

if command -v watchman >/dev/null 2>&1; then
  pass "Watchman $(watchman --version)"
else
  warn 'Watchman not installed; web preview will use export-and-serve mode'
fi

command -v eas >/dev/null 2>&1 && pass "EAS CLI $(eas --version | head -1)" || warn 'EAS CLI not installed; use npx eas-cli for releases'
command -v supabase >/dev/null 2>&1 && pass "Supabase CLI $(supabase --version)" || warn 'Supabase CLI not installed; use npx supabase for local backend work'

BRANCH="$(git branch --show-current)"
[[ -n "$BRANCH" ]] && pass "Git branch $BRANCH" || warn 'detached Git HEAD'
[[ -z "$(git status --short)" ]] && pass 'working tree clean' || warn 'working tree has uncommitted changes'

if (( ERRORS > 0 )); then
  printf '\n%d required setup problem(s) found.\n' "$ERRORS" >&2
  exit 1
fi

printf '\nLocalCheck development environment is ready.\n'
