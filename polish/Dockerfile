# ✨ Video2X upscaler container (optional — build with: docker build -t video2x:latest -f polish/Dockerfile .)
# NOTE: Real-ESRGAN engine weights download on first run — see Video2X docs.
FROM python:3.11-slim

RUN apt-get update \
    && apt-get install -y --no-install-recommends ffmpeg \
    && rm -rf /var/lib/apt/lists/*

RUN pip install --no-cache-dir video2x

WORKDIR /data
ENTRYPOINT ["video2x"]
