#!/usr/bin/env bash
# 📤 BROski Multi-Format Publisher — one clip in, TikTok + YouTube + square out.
# Usage: ffmpeg-crop.sh <input.mp4> <output_dir> [9:16|16:9|1:1|all]
set -euo pipefail

INPUT="${1:?Usage: ffmpeg-crop.sh <input.mp4> <output_dir> [9:16|16:9|1:1|all]}"
OUTDIR="${2:?Missing output dir}"
TARGET="${3:-all}"
BASE="$(basename "$INPUT" .mp4)"
mkdir -p "$OUTDIR"

ENC=(-c:v libx264 -crf 18 -preset medium -c:a aac -b:a 192k -movflags +faststart)

# 9:16 — blurred background fill (keeps the FULL frame, TikTok-safe)
vertical() {
  ffmpeg -hide_banner -loglevel error -y -i "$INPUT" -filter_complex \
    "[0:v]scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,boxblur=24:5[bg];[0:v]scale=1080:-2[fg];[bg][fg]overlay=(W-w)/2:(H-h)/2" \
    "${ENC[@]}" "$OUTDIR/${BASE}-9x16.mp4"
  echo "✅ $OUTDIR/${BASE}-9x16.mp4"
}

# 16:9 — pad to widescreen
wide() {
  ffmpeg -hide_banner -loglevel error -y -i "$INPUT" -vf \
    "scale=1920:1080:force_original_aspect_ratio=decrease,pad=1920:1080:(ow-iw)/2:(oh-ih)/2:black" \
    "${ENC[@]}" "$OUTDIR/${BASE}-16x9.mp4"
  echo "✅ $OUTDIR/${BASE}-16x9.mp4"
}

# 1:1 — centre square
square() {
  ffmpeg -hide_banner -loglevel error -y -i "$INPUT" -vf \
    "crop='min(iw,ih)':'min(iw,ih)'" -s 1080x1080 \
    "${ENC[@]}" "$OUTDIR/${BASE}-1x1.mp4"
  echo "✅ $OUTDIR/${BASE}-1x1.mp4"
}

case "$TARGET" in
  9:16) vertical ;;
  16:9) wide ;;
  1:1)  square ;;
  all)  vertical && wide && square ;;
  *)    echo "❌ Unknown target: $TARGET (use 9:16 | 16:9 | 1:1 | all)"; exit 1 ;;
esac
