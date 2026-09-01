#!/usr/bin/env bash
# 🧪 Layer-by-layer health check — run this FIRST after cloning.
set -uo pipefail
cd "$(dirname "$0")/.."
PASS=0; FAIL=0
ok()  { echo "   ✅ $1"; PASS=$((PASS+1)); }
bad() { echo "   ❌ $1"; FAIL=$((FAIL+1)); }

echo "🧪 BROski Void Video Agent V2 — pipeline check"
echo ""

echo "1️⃣  Local tooling"
command -v docker >/dev/null 2>&1 && ok "docker found" || bad "docker not found"
command -v ffmpeg >/dev/null 2>&1 && ok "ffmpeg found" || bad "ffmpeg not found (brew install ffmpeg / apt install ffmpeg)"
command -v node  >/dev/null 2>&1 && ok "node found" || bad "node not found (need v20+)"

echo "2️⃣  Config"
if [[ -f .env ]]; then
  ok ".env exists"
  set -a; source .env; set +a
  [[ -n "${MUAPI_KEY:-}" ]] && ok "MUAPI_KEY set (cloud models armed 🔑)" || bad "MUAPI_KEY empty — get one at muapi.ai"
  [[ -n "${HEYGEN_API_KEY:-}" ]] && ok "HEYGEN_API_KEY set (avatar layer armed 🗣️)" || bad "HEYGEN_API_KEY empty"
  [[ -n "${HEYGEN_AVATAR_ID:-}" ]] && ok "HEYGEN_AVATAR_ID set" || echo "   ⚠️  HEYGEN_AVATAR_ID empty (talking heads will fail)"
  [[ -n "${HEYGEN_VOICE_ID:-}" ]] && ok "HEYGEN_VOICE_ID set" || echo "   ⚠️  HEYGEN_VOICE_ID empty"
else
  bad ".env missing — run: cp .env.example .env"
fi

echo "3️⃣  Cloud reachability"
if [[ -n "${MUAPI_KEY:-}" ]]; then
  code=$(curl -s -o /dev/null -w "%{http_code}" --max-time 8 "${MUAPI_BASE_URL:-https://api.muapi.ai/v1}/models" -H "Authorization: Bearer $MUAPI_KEY" || echo 000)
  [[ "$code" != "000" ]] && ok "MuAPI reachable (HTTP $code)" || bad "MuAPI unreachable — check network"
fi

echo "4️⃣  Local GPU lane (optional)"
if curl -s --max-time 3 "http://localhost:8188/system_stats" >/dev/null 2>&1; then
  ok "ComfyUI running on :8188 (FREE mode armed 🦙)"
else
  echo "   ⚠️  ComfyUI not running — FREE mode unavailable (fine for cloud modes)"
fi

echo "5️⃣  Docker stack"
docker compose config >/dev/null 2>&1 && ok "docker-compose valid" || bad "docker-compose invalid"

echo ""
echo "📊 $PASS passed, $FAIL failed"
if [[ $FAIL -eq 0 ]]; then
  echo "🎉 ALL GREEN — first video: ./scripts/make-video.sh \"test prompt\""
else
  echo "🔧 Fix the ❌s above and re-run"
fi
