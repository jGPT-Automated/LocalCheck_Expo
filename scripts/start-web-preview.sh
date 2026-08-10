#!/usr/bin/env bash
set -euo pipefail

MODE="${1:-start}"
PORT="${PORT:-8081}"
PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
EXPO_BIN="$PROJECT_ROOT/node_modules/.bin/expo"

usage() {
  printf '%s\n' \
    'usage: ./scripts/start-web-preview.sh [start|--export-only|--help]' \
    '' \
    'start          Run the Expo web dev server when Watchman is available,' \
    '               otherwise export and serve a fresh interactive build.' \
    '--export-only  Export the web build and print its temporary path.' \
    '--help         Show this help.' \
    '' \
    'Set PORT to override port 8081.'
}

case "$MODE" in
  start) ;;
  --export-only|export-only) ;;
  --help|help)
    usage
    exit 0
    ;;
  *)
    usage >&2
    exit 2
    ;;
esac

if [[ ! -f "$PROJECT_ROOT/package.json" ]] || [[ ! -f "$PROJECT_ROOT/app.json" ]]; then
  printf 'LocalCheck app not found at %s\n' "$PROJECT_ROOT" >&2
  exit 1
fi

ENV_FILE=""
if [[ -f "$PROJECT_ROOT/.env.local" ]]; then
  ENV_FILE="$PROJECT_ROOT/.env.local"
elif [[ -f "$PROJECT_ROOT/.env" ]]; then
  ENV_FILE="$PROJECT_ROOT/.env"
fi

if [[ -z "$ENV_FILE" ]]; then
  printf 'Missing %s/.env.local. Copy .env.example and add the public development values.\n' "$PROJECT_ROOT" >&2
  exit 1
fi

SUPABASE_URL="$(sed -n 's/^EXPO_PUBLIC_SUPABASE_URL=//p' "$ENV_FILE" | tail -1)"
SUPABASE_KEY="$(sed -n 's/^EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY=//p' "$ENV_FILE" | tail -1)"
if [[ -z "$SUPABASE_URL" ]] || [[ "$SUPABASE_URL" == *example.supabase.co* ]] || [[ "$SUPABASE_URL" == *your-project.supabase.co* ]]; then
  printf 'Invalid Supabase URL in %s; refusing to serve a disconnected preview.\n' "$ENV_FILE" >&2
  exit 1
fi
if [[ -z "$SUPABASE_KEY" ]] || [[ "$SUPABASE_KEY" == *your-key-here* ]]; then
  printf 'Missing Supabase publishable key in %s; refusing to serve a disconnected preview.\n' "$ENV_FILE" >&2
  exit 1
fi

if [[ ! -x "$EXPO_BIN" ]]; then
  printf 'Dependencies are not installed. Run: pnpm install --frozen-lockfile\n' >&2
  exit 1
fi

if [[ "$MODE" == "start" ]] && command -v curl >/dev/null 2>&1; then
  if curl --fail --silent "http://127.0.0.1:$PORT/" | rg --quiet '<title>LocalCheck</title>'; then
    printf 'LocalCheck is already available at http://127.0.0.1:%s/\n' "$PORT"
    exit 0
  fi
fi

if command -v watchman >/dev/null 2>&1; then
  cd "$PROJECT_ROOT"
  if [[ "$MODE" == "--export-only" ]] || [[ "$MODE" == "export-only" ]]; then
    EXPO_NO_CACHE=1 exec "$EXPO_BIN" export --platform web --dev --no-minify
  fi
  EXPO_NO_CACHE=1 exec "$EXPO_BIN" start --web --localhost --port "$PORT"
fi

PREVIEW_DIR="$(mktemp -d "${TMPDIR:-/private/tmp}/localcheck-preview.XXXXXX")"

printf '%s\n' \
  'Watchman is not installed; exporting and serving a fresh web build.' \
  'Supabase reads, writes, and Realtime remain live. Restart after source edits.'

cd "$PROJECT_ROOT"
EXPO_NO_CACHE=1 "$EXPO_BIN" export \
  --platform web \
  --dev \
  --no-minify \
  --output-dir "$PREVIEW_DIR"

printf 'LocalCheck preview exported to %s\n' "$PREVIEW_DIR"

if [[ "$MODE" == "--export-only" ]] || [[ "$MODE" == "export-only" ]]; then
  exit 0
fi

printf 'Serving LocalCheck at http://127.0.0.1:%s/\n' "$PORT"
exec python3 "$PROJECT_ROOT/scripts/serve_preview.py" \
  --port "$PORT" \
  --bind 127.0.0.1 \
  --directory "$PREVIEW_DIR"
