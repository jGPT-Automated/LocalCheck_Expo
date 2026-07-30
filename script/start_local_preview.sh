#!/usr/bin/env bash
set -euo pipefail

MODE="${1:-start}"
PORT="${PORT:-8081}"
WORKSPACE_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
MOBILE_ROOT="$WORKSPACE_ROOT/artifacts/mobile"
PREVIEW_CONFIG="$WORKSPACE_ROOT/script/metro.preview.config.cjs"
EXPO_BIN="$MOBILE_ROOT/node_modules/.bin/expo"

show_usage() {
  printf '%s\n' \
    'usage: ./script/start_local_preview.sh [start|--export-only|--help]' \
    '' \
    'start          Start the repeatable LocalCheck web preview on port 8081.' \
    '--export-only  Build the fallback preview and print its output path.' \
    '--help         Show this help.' \
    '' \
    'Set PORT to use another port, for example PORT=8082.'
}

case "$MODE" in
  start) ;;
  --export-only|export-only) ;;
  --help|help)
    show_usage
    exit 0
    ;;
  *)
    show_usage >&2
    exit 2
    ;;
esac

if [[ ! -f "$MOBILE_ROOT/package.json" ]] || [[ ! -f "$MOBILE_ROOT/app.json" ]]; then
  printf 'LocalCheck mobile app not found at %s\n' "$MOBILE_ROOT" >&2
  exit 1
fi

if [[ ! -e "$MOBILE_ROOT/.env" ]]; then
  printf 'Missing ignored mobile environment file: %s/.env\n' "$MOBILE_ROOT" >&2
  exit 1
fi

if [[ ! -x "$EXPO_BIN" ]]; then
  printf 'Missing installed Expo command: %s\n' "$EXPO_BIN" >&2
  printf 'Restore the canonical lockfile install before starting the preview.\n' >&2
  exit 1
fi

if [[ "$MODE" == "start" ]] && command -v curl >/dev/null 2>&1; then
  if curl --fail --silent "http://127.0.0.1:$PORT/" | rg --quiet '<title>LocalCheck</title>'; then
    printf 'LocalCheck preview is already running at http://127.0.0.1:%s/\n' "$PORT"
    exit 0
  fi
fi

if [[ ! -L "$WORKSPACE_ROOT/node_modules" ]] && \
  [[ ! -L "$MOBILE_ROOT/node_modules" ]] && \
  command -v watchman >/dev/null 2>&1; then
  if [[ "$MODE" == "--export-only" ]] || [[ "$MODE" == "export-only" ]]; then
    cd "$MOBILE_ROOT"
    EXPO_NO_CACHE=1 exec "$EXPO_BIN" export --platform web --dev --no-minify
  fi

  cd "$MOBILE_ROOT"
  EXPO_NO_CACHE=1 exec "$EXPO_BIN" start --web --localhost --port "$PORT"
fi

if [[ ! -e "$WORKSPACE_ROOT/node_modules" ]] || [[ ! -e "$MOBILE_ROOT/node_modules" ]]; then
  printf 'The archived dependency links are missing or broken.\n' >&2
  printf 'Read AGENTS.md -> Local preview before installing or relinking dependencies.\n' >&2
  exit 1
fi

PREVIEW_DIR="$(mktemp -d "${TMPDIR:-/private/tmp}/localcheck-mobile-preview.XXXXXX")"

if ! command -v watchman >/dev/null 2>&1; then
  printf '%s\n' \
    'Watchman is not installed; using the repeatable export-and-serve preview.' \
    'Runtime data and realtime subscriptions remain interactive; code edits require a restart.'
fi

cd "$MOBILE_ROOT"
EXPO_NO_CACHE=1 EXPO_OVERRIDE_METRO_CONFIG="$PREVIEW_CONFIG" \
  "$EXPO_BIN" export \
    --platform web \
    --dev \
    --no-minify \
    --output-dir "$PREVIEW_DIR"

printf 'LocalCheck preview exported to %s\n' "$PREVIEW_DIR"

if [[ "$MODE" == "--export-only" ]] || [[ "$MODE" == "export-only" ]]; then
  exit 0
fi

printf 'Serving LocalCheck at http://127.0.0.1:%s/\n' "$PORT"
exec python3 "$WORKSPACE_ROOT/script/serve_preview.py" \
  --port "$PORT" \
  --bind 127.0.0.1 \
  --directory "$PREVIEW_DIR"
