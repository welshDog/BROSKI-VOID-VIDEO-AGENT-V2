#!/usr/bin/env bash
# 📱 TikTok preset — 9:16, H.264 high profile, tight bitrate for fast uploads
# Usage: tiktok-export.sh <input.mp4> [output_dir]
set -euo pipefail

INPUT="${1:?Usage: tiktok-export.sh <input.mp4> [output_dir]}"
OUTDIR="${2:-./output}"
mkdir -p "$OUTDIR"
BASE="$(basename "$INPUT" .mp4)"

ffmpeg -hide_banner -loglevel error -y -i "$INPUT" -vf \
  "scale=1080:1920:force_original_aspect_ratio=decrease,pad=1080:1920:(ow-iw)/2:(oh-ih)/2:black" \
  -c:v libx264 -profile:v high -level 4.1 -crf 19 -preset medium -c:a aac -b:a 128k \
  -movflags +faststart "$OUTDIR/${BASE}-tiktok.mp4"

echo "📱 $OUTDIR/${BASE}-tiktok.mp4"
