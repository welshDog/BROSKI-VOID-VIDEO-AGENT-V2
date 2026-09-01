# 🧠 BROski Orchestrator — Node 20 + ffmpeg + python3 (for the HeyGen avatar layer)
FROM node:20-bookworm-slim

RUN apt-get update \
    && apt-get install -y --no-install-recommends ffmpeg python3 ca-certificates \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package.json tsconfig.json ./
RUN npm install

COPY agent-router ./agent-router
COPY generators ./generators
COPY storyboard ./storyboard
COPY avatar ./avatar
COPY publisher ./publisher
COPY polish ./polish
COPY config ./config

CMD ["npx", "tsx", "agent-router/index.ts", "--help"]
