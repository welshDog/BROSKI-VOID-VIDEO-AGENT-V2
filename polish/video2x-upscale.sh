#!/usr/bin/env bash
# ✨ Free 2x upscale — prefers Video2X, falls back to ffmpeg lanczos.
# Usage: video2x-upscale.sh <input.mp4> [output.mp4]
set -euo pipefail

INPUT="${1:?Usage: video2x-upscale.sh <input.mp4> [output.mp4]}"
OUTPUT="${2:-${INPUT%.mp4}-upscaled.mp4}"

if docker image inspect video2x:latest >/dev/null 2>&1; then
  echo "✨ Using Video2X (better) …"
  docker run --rm -v "$(pwd)":/data video2x:latest -i "/data/$INPUT" -o "/data/$OUTPUT" -p realesrgan
else
  echo "⚡ Video2X image not found — ffmpeg lanczos fallback (still free) …"
  ffmpeg -hide_banner -loglevel error -y -i "$INPUT" -vf "scale=iw*2:ih*2:flags=lanczos" \
    -c:v libx264 -crf 17 -preset medium -c:a copy "$OUTPUT"
fi

echo "✅ $OUTPUT"
