#!/usr/bin/env bash
set -euo pipefail

MODE="${1:-start}"
PORT="${PORT:-8081}"
PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
EXPO_BIN="$PROJECT_ROOT/node_modules/.bin/expo"
STATE_DIR="$PROJECT_ROOT/.expo"
PID_FILE="$STATE_DIR/localcheck-preview-${PORT}.pid"

usage() {
  printf '%s\n' \
    'usage: ./scripts/start-web-preview.sh [start|--export-only|--help]' \
    '' \
    'start          Export and serve a fresh connected interactive build.' \
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

# The local file is authoritative for an interactive preview. Export these
# values explicitly so a placeholder inherited from CI or another shell can
# never override the connected development environment.
SUPABASE_URL="$(sed -n 's/^EXPO_PUBLIC_SUPABASE_URL=//p' "$ENV_FILE" | tail -1)"
SUPABASE_KEY="$(sed -n 's/^EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY=//p' "$ENV_FILE" | tail -1)"
MAPBOX_TOKEN="$(sed -n 's/^EXPO_PUBLIC_MAPBOX_TOKEN=//p' "$ENV_FILE" | tail -1)"
if [[ -z "$SUPABASE_URL" ]] || [[ "$SUPABASE_URL" == *.invalid* ]] || [[ "$SUPABASE_URL" == *example.supabase.co* ]] || [[ "$SUPABASE_URL" == *your-project.supabase.co* ]]; then
  printf 'Invalid Supabase URL in %s; refusing to serve a disconnected preview.\n' "$ENV_FILE" >&2
  exit 1
fi
if [[ -z "$SUPABASE_KEY" ]] || [[ "$SUPABASE_KEY" == *placeholder* ]] || [[ "$SUPABASE_KEY" == *your-key-here* ]]; then
  printf 'Missing Supabase publishable key in %s; refusing to serve a disconnected preview.\n' "$ENV_FILE" >&2
  exit 1
fi
export EXPO_PUBLIC_SUPABASE_URL="$SUPABASE_URL"
export EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY="$SUPABASE_KEY"
if [[ -n "$MAPBOX_TOKEN" ]] && [[ "$MAPBOX_TOKEN" != *placeholder* ]] && [[ "$MAPBOX_TOKEN" != *your-mapbox-token-here* ]]; then
  export EXPO_PUBLIC_MAPBOX_TOKEN="$MAPBOX_TOKEN"
else
  unset EXPO_PUBLIC_MAPBOX_TOKEN
  printf 'Warning: no local Mapbox public token; list/auth QA will work, but browser map QA is unavailable.\n' >&2
fi

if [[ ! -x "$EXPO_BIN" ]]; then
  printf 'Dependencies are not installed. Run: pnpm install --frozen-lockfile\n' >&2
  exit 1
fi

if [[ "$MODE" == "start" ]]; then
  mkdir -p "$STATE_DIR"

  # A preview is disposable: every invocation must serve the current source and
  # environment. Reusing a page merely because its title says "LocalCheck"
  # previously kept a disconnected bundle (example.supabase.co) alive across
  # iterations. Only stop a process that this script recorded itself.
  if [[ -f "$PID_FILE" ]]; then
    PREVIOUS_PID="$(tr -dc '0-9' < "$PID_FILE")"
    if [[ -n "$PREVIOUS_PID" ]] && kill -0 "$PREVIOUS_PID" 2>/dev/null; then
      if command -v lsof >/dev/null 2>&1 && lsof -a -p "$PREVIOUS_PID" -iTCP:"$PORT" -sTCP:LISTEN -t >/dev/null 2>&1; then
        printf 'Stopping previous LocalCheck preview (PID %s).\n' "$PREVIOUS_PID"
        kill "$PREVIOUS_PID"
        for _ in 1 2 3 4 5 6 7 8 9 10; do
          kill -0 "$PREVIOUS_PID" 2>/dev/null || break
          sleep 0.1
        done
      fi
    fi
    rm -f "$PID_FILE"
  fi

  if command -v lsof >/dev/null 2>&1 && lsof -tiTCP:"$PORT" -sTCP:LISTEN >/dev/null 2>&1; then
    printf 'Port %s is in use by a process this project did not start. Stop it or set PORT to another value.\n' "$PORT" >&2
    exit 1
  fi
fi

PREVIEW_DIR="$(mktemp -d "${TMPDIR:-/private/tmp}/localcheck-preview.XXXXXX")"

printf '%s\n' \
  'Exporting and serving a fresh connected web build.' \
  'Supabase reads, writes, and Realtime remain live. Restart after source edits.'

cd "$PROJECT_ROOT"
EXPO_NO_CACHE=1 "$EXPO_BIN" export \
  --clear \
  --platform web \
  --dev \
  --no-minify \
  --output-dir "$PREVIEW_DIR"

if ! rg --fixed-strings --quiet "${SUPABASE_URL%/}" "$PREVIEW_DIR/_expo/static/js/web"; then
  printf 'Export verification failed: the served JavaScript does not contain the configured Supabase project URL.\n' >&2
  exit 1
fi

GIT_HEAD="$(git -C "$PROJECT_ROOT" rev-parse --short HEAD 2>/dev/null || printf 'uncommitted')"
printf '{"supabaseProject":"%s","gitHead":"%s","generatedAt":"%s"}\n' \
  "$(printf '%s' "$SUPABASE_URL" | sed -E 's#https?://([^.]+).*#\1#')" \
  "$GIT_HEAD" \
  "$(date -u +%Y-%m-%dT%H:%M:%SZ)" \
  > "$PREVIEW_DIR/preview-meta.json"

printf 'LocalCheck preview exported to %s\n' "$PREVIEW_DIR"

if [[ "$MODE" == "--export-only" ]] || [[ "$MODE" == "export-only" ]]; then
  exit 0
fi

printf 'Serving LocalCheck at http://127.0.0.1:%s/\n' "$PORT"
printf '%s\n' "$$" > "$PID_FILE"
exec python3 "$PROJECT_ROOT/scripts/serve_preview.py" \
  --port "$PORT" \
  --bind 127.0.0.1 \
  --directory "$PREVIEW_DIR"
