# 🎬 BROski Void Video Agent V2

> **One repo. Every model. Every format.** 🏴
> The Ultimate AI Video Generation Stack — cherry-picked from the best AI video tools of 2026
> and the best open-source GitHub builds, wired into ONE agent-driven pipeline.

🧠 Agent router → 🎬 Storyboard → 🎥 Smart model routing → 🗣️ HeyGen avatars → ✨ Free polish → 📤 Auto-publisher

---

## 🏗️ Architecture

```
📝 SCRIPT IN (markdown / plain text)
      ↓
🎬 STORYBOARD    scene-parser + shot-planner (style presets per project)
      ↓
🧠 MODEL ROUTER  picks the best model per scene type + budget mode
      ↓
🎥 GENERATE      MuAPI (Seedance / Veo / Kling / PixVerse / Vidu) OR Wan 2.2 local (FREE)
      ↓
🗣️ AVATAR        HeyGen talking heads (your existing keys!)
      ↓
✨ POLISH        Video2X upscale + ComfyUI workflows (optional)
      ↓
📤 PUBLISH       ffmpeg → 9:16 TikTok + 16:9 YouTube + 1:1 square
      ↓
📊 output/manifest.json — every clip, cost and file path
```

---

## 🚀 Quick Start

```bash
git clone https://github.com/welshDog/BROSKI-VOID-VIDEO-AGENT-V2.git
cd BROSKI-VOID-VIDEO-AGENT-V2
cp .env.example .env          # ← fill in MUAPI_KEY + your HeyGen keys
chmod +x scripts/*.sh publisher/*.sh polish/*.sh avatar/*.py

./scripts/test-pipeline.sh    # health-check every layer
./scripts/start.sh            # boot the Docker stack

# First video 🎬
./scripts/make-video.sh "neon dragon flying over Nexus City at night" --mode CHEAP
```

Generated files land in `output/` — the master clip plus `-9x16`, `-16x9` and `-1x1` variants.

---

## ✍️ Script Format

Feed `make-video.sh` a file or a one-line prompt:

```markdown
SCENE 1 (4s) TITLE CARD: glitch logo reveal, HYPERFOCUS ZONE, neon purple scanlines
SCENE 2 (8s) CINEMATIC: aerial drone shot over Nexus City at night, rain, neon signs reflecting in puddles
SCENE 3 (12s) TALKING HEAD: "Yo BROskis, welcome back to the Zone — today we build agents!"
SCENE 4 (8s) ANIME: the protagonist powers up, electric blue aura, city skyline behind
```

- Scene types: `CINEMATIC` (default) · `ANIME` · `TALKING HEAD` · `B-ROLL` · `TITLE CARD`
- Duration: `(Ns)` after the scene number, e.g. `(8s)` — capped at 30s
- No scene headings? Each paragraph becomes one scene automatically

---

## 💰 Budget Modes

Per-second API pricing verified July 2026 — see [Sources](#-sources--inspiration).

| Mode | What it uses | Est. cost / 30s video |
|---|---|---|
| 🆓 FREE | Wan 2.2 local (ComfyUI + GPU) | **£0** |
| 💚 CHEAP | Seedance 2.0 Mini ($0.025/s) + PixVerse V6 (from $0.033/s) | **~£0.60** |
| 🔵 QUALITY | Veo 3.1 Fast ($0.15/s) + Kling 3.0 (~$0.10/s) | **~£3–5** |
| 🟣 PRO | Seedance 2.5 ($0.05–0.25/s, up to 4K / 30s / 50 refs) | **~£8–12** |

Talking heads always use HeyGen (credit-based) except FREE mode, which falls back to it until MuseTalk is wired.

---

## 🧠 Model Routing

| Scene type | FREE | CHEAP | QUALITY | PRO |
|---|---|---|---|---|
| cinematic | Wan 2.2 local | Seedance 2.0 Mini | Veo 3.1 Fast | Seedance 2.5 |
| anime | Wan 2.2 local | Vidu Q3 | Seedance 2.5 | Seedance 2.5 |
| talking head | MuseTalk* | HeyGen | HeyGen | HeyGen |
| b-roll | Wan 2.2 local | PixVerse V6 | Kling 3.0 | Kling 3.0 |
| title card | Wan 2.2 local | PixVerse V6 | Veo 3.1 Lite | Veo 3.1 Fast |

\* falls back to HeyGen for now. The whole table is plain data in `agent-router/model-selector.ts` — edit it freely.

---

## 📁 Project Structure

```
BROSKI-VOID-VIDEO-AGENT-V2/
├── docker-compose.yml        # the whole stack (cloud + optional GPU lane)
├── .env.example              # all API keys template
├── config/style-presets.json # per-project look (Hyperfocus / HyperCode / anime)
│
├── agent-router/             # 🧠 THE BRAIN
│   ├── index.ts              # pipeline orchestrator (CLI)
│   ├── model-selector.ts     # budget → model routing + cost estimator
│   ├── job-queue.ts          # concurrency + retries, zero deps
│   └── Dockerfile
│
├── storyboard/               # 🎬 SCRIPT → SCENES
│   ├── scene-parser.ts       # splits script into typed scenes
│   └── shot-planner.ts       # applies style presets, builds prompts
│
├── generators/               # 🎥 MODEL WRAPPERS
│   ├── muapi-client.ts       # ONE key for ALL cloud models
│   ├── seedance.ts / kling.ts / veo.ts
│   └── wan-local.ts          # FREE lane via local ComfyUI
│
├── avatar/                   # 🗣️ HEYGEN LAYER
│   ├── heygen-client.py      # your existing setup, ported
│   └── hedra-fallback.py     # free-tier backup (stub)
│
├── polish/                   # ✨ POST-PRODUCTION
│   ├── video2x-upscale.sh    # free 2x upscale
│   ├── Dockerfile            # Video2X container
│   └── comfyui-workflows/    # drop your Wan 2.2 workflows here
│
├── publisher/                # 📤 AUTO-EXPORT
│   ├── ffmpeg-crop.sh        # 9:16 / 16:9 / 1:1 (blur-fill vertical)
│   └── tiktok-export.sh / youtube-export.sh
│
└── scripts/
    ├── start.sh              # boot stack
    ├── make-video.sh         # script in → videos out
    └── test-pipeline.sh      # layer-by-layer health check
```

---

## ⚙️ Environment Variables

| Var | What | Where |
|---|---|---|
| `MUAPI_KEY` | ONE key for Seedance / Veo / Kling / PixVerse / Vidu | [muapi.ai](https://muapi.ai) |
| `HEYGEN_API_KEY` | Your existing HeyGen key | [heygen.com](https://heygen.com) |
| `HEYGEN_AVATAR_ID` / `HEYGEN_VOICE_ID` | Your avatar + voice | HeyGen dashboard |
| `DEFAULT_MODE` | `FREE` / `CHEAP` / `QUALITY` / `PRO` | `.env` |
| `COMFYUI_URL` | Local ComfyUI (default `http://comfyui:8188`) | `.env` |

---

## 🛠️ Status — Wired vs TODO

✅ **Wired:** pipeline orchestration · scene parsing · model routing + cost estimation · MuAPI client · Wan-local ComfyUI client · HeyGen client (real v2 API) · ffmpeg multi-format publisher · Docker stack · health checks

🔧 **TODO (honest list):**

- MuAPI endpoint paths per model — verify each in the [docs playground](https://muapi.ai/docs/video-generation) before your first cloud run (`generators/muapi-client.ts` → `MODEL_ENDPOINTS`)
- ComfyUI Wan 2.2 workflow — export yours in **API format** to `polish/comfyui-workflows/wan22-t2v.json` (see that folder's README)
- MuseTalk local talking heads (FREE mode falls back to HeyGen for now)
- Hedra fallback client (stub in `avatar/hedra-fallback.py`)

---

## 🙏 Sources & Inspiration

Deep-dive research, September 2026 — best bit taken from each:

- [awesome-ai-video-models](https://github.com/Anil-matcha/awesome-ai-video-models) — model + pricing data
- [Toonflow](https://github.com/HBAI-Ltd/Toonflow-app) — script → storyboard → episode flow
- [Open-Generative-AI](https://github.com/Anil-matcha/Open-Generative-AI) — self-hosted multi-model studio
- [Nomi](https://github.com/aqm857886159/Nomi) — local-first, agent-directed storyboarding
- [Generative-Media-Skills](https://github.com/SamurAIGPT/Generative-Media-Skills) — media generation as agent tools
- [DJZ-Workflows](https://github.com/MushroomFleet/DJZ-Workflows) — ComfyUI workflow library
- [Video2X](https://github.com/k4yt3x/video2x) — free upscaling
- [vargHQ/sdk](https://github.com/vargHQ/sdk) — clean multi-provider SDK pattern

---

## 🗺️ Roadmap

- [ ] MCP server — let BROski agents call `make-video` as a tool
- [ ] Supabase job history + BROski$ coin rewards per render 🪙
- [ ] Web UI storyboard timeline (Nomi-style)
- [ ] LLM scene splitter — smarter script parsing
- [ ] Auto-post to TikTok / YouTube Shorts APIs

---

MIT © WelshDog 🏴 — Hyperfocus Zone Ltd — built with a Perplexity deep-dive (Sept 2026)
