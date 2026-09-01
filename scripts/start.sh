#!/usr/bin/env bash
# 🚀 Boot the stack — plain (cloud only) or with the FREE local GPU lane
set -euo pipefail
cd "$(dirname "$0")/.."

if [[ ! -f .env ]]; then
  echo "⚠️  No .env found — copying .env.example (FILL IN YOUR KEYS!)"
  cp .env.example .env
fi

echo "🐳 Building orchestrator …"
docker compose build orchestrator

if [[ "${1:-}" == "--local" ]]; then
  echo "🦙 Starting with local GPU lane (ComfyUI + Wan 2.2) …"
  docker compose --profile local up -d
else
  echo "☁️  Starting cloud-only stack …"
  docker compose up -d orchestrator
fi

docker compose ps
echo ""
echo "✅ Stack up! Try: ./scripts/make-video.sh \"neon city flyover at night\""
