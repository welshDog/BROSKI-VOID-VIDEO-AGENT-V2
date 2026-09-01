#!/usr/bin/env bash
# 🎬 THE MONEY SCRIPT — script in, finished videos out.
#
# Usage:
#   ./scripts/make-video.sh <script.md | "a prompt"> [--mode FREE|CHEAP|QUALITY|PRO] [--preset NAME] [--aspect 9:16|16:9|1:1]
set -euo pipefail
cd "$(dirname "$0")/.."

INPUT="${1:?Usage: make-video.sh <script.md|prompt> [--mode MODE] [--preset NAME] [--aspect RATIO]}"
shift || true

MODE="${DEFAULT_MODE:-CHEAP}"
PRESET="hyperfocus-zone"
ASPECT="9:16"
while [[ $# -gt 0 ]]; do
  case "$1" in
    --mode)   MODE="$2"; shift 2 ;;
    --preset) PRESET="$2"; shift 2 ;;
    --aspect) ASPECT="$2"; shift 2 ;;
    *) echo "❌ Unknown option: $1"; exit 1 ;;
  esac
done

mkdir -p workspace output

# File or one-line prompt?
if [[ -f "$INPUT" ]]; then
  SCRIPT_FILE="workspace/$(basename "$INPUT")"
  cp "$INPUT" "$SCRIPT_FILE"
else
  SCRIPT_FILE="workspace/prompt-$(date +%s).md"
  printf 'SCENE 1 (8s) CINEMATIC: %s\n' "$INPUT" > "$SCRIPT_FILE"
fi

echo "🎬 BROski Void Video Agent V2"
echo "   script : $SCRIPT_FILE"
echo "   mode   : $MODE | preset: $PRESET | aspect: $ASPECT"
echo ""

if command -v docker >/dev/null 2>&1 && docker compose config >/dev/null 2>&1; then
  docker compose run --rm orchestrator \
    npx tsx agent-router/index.ts --script "/app/$SCRIPT_FILE" --mode "$MODE" --preset "$PRESET" --aspect "$ASPECT" --yes
else
  npx tsx agent-router/index.ts --script "$SCRIPT_FILE" --mode "$MODE" --preset "$PRESET" --aspect "$ASPECT" --yes
fi
