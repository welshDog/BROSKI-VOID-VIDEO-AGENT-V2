#!/usr/bin/env bash
# ▶️ YouTube preset — 16:9 1080p, higher quality
# Usage: youtube-export.sh <input.mp4> [output_dir]
set -euo pipefail

INPUT="${1:?Usage: youtube-export.sh <input.mp4> [output_dir]}"
OUTDIR="${2:-./output}"
mkdir -p "$OUTDIR"
BASE="$(basename "$INPUT" .mp4)"

ffmpeg -hide_banner -loglevel error -y -i "$INPUT" -vf \
  "scale=1920:1080:force_original_aspect_ratio=decrease,pad=1920:1080:(ow-iw)/2:(oh-ih)/2:black" \
  -c:v libx264 -crf 17 -preset slow -c:a aac -b:a 192k -movflags +faststart \
  "$OUTDIR/${BASE}-youtube.mp4"

echo "▶️  $OUTDIR/${BASE}-youtube.mp4"
