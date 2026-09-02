# 🐱 LongCat Avatar — Tier-3 Avatar Generator

**Why:** LongCat-Video-Avatar (Meituan, [MIT licence](https://huggingface.co/meituan-longcat/LongCat-Video-Avatar)) turns image + audio into a lip-synced talking-head video. Open weights = **$0 per render**, no API keys, no credits. It becomes tier 3 in the avatar chain:

```
HeyGen (tier 1) -> Hedra (tier 2) -> LongCat (tier 3, $0)
```

## Files

| File | Job |
|---|---|
| `avatar/longcat-client.py` | What the router calls. Space mode (no GPU) or local mode |
| `avatar/longcat-server.py` | FastAPI wrapper — runs the model inside the container |
| `Dockerfile.longcat` | GPU container (pinned: py3.10 / torch 2.6.0+cu124 / flash-attn 2.7.4.post1) |
| `docker-compose.longcat.yml` | Compose overlay for the `longcat-inference` service |

## ⚡ Quick win — Space mode (no GPU, ~2 min)

```bash
pip install gradio_client requests
python avatar/longcat-client.py --image mascot.png --audio voice.wav \
  --prompt "a friendly avatar talking directly to camera"
```

Video lands in `output/avatar/`. Zero hardware needed.

> Verify the `api_name="/infer"` line in `longcat-client.py` against the Space's **API** tab (link in its README) — endpoint names can differ per Space. Override the Space with `LONGCAT_SPACE_ID`.

## 🖥️ Local mode — GPU

**Step 1 — weights** (both sets needed, base + avatar layer):

```bash
pip install "huggingface_hub[cli]"
huggingface-cli download meituan-longcat/LongCat-Video --local-dir ./weights/LongCat-Video
huggingface-cli download meituan-longcat/LongCat-Video-Avatar --local-dir ./weights/LongCat-Video-Avatar
```

**Step 2 — build + run:**

```bash
docker compose -f docker-compose.yml -f docker-compose.longcat.yml up -d --build longcat-inference
```

**Step 3 — flip the client:**

```bash
export LONGCAT_MODE=local   # or set in .env (NEVER commit .env)
```

Health check: `curl http://localhost:8000/health`

## Env vars

| Var | Default | Meaning |
|---|---|---|
| `LONGCAT_MODE` | `space` | `space` (zero-GPU) or `local` (GPU service) |
| `LONGCAT_SPACE_ID` | `victor/LongCat-Video-Avatar-1.5` | HF Space to call in space mode |
| `LONGCAT_LOCAL_URL` | `http://longcat-inference:8000` | FastAPI service URL |
| `LONGCAT_TIMEOUT` | `900` | seconds before giving up |
| `HF_TOKEN` | — | optional HF token for Space queue priority |

## Wire into the router

```python
# pseudo — avatar chain in agent-router
try:
    video = heygen_generate(image, audio)
except HeyGenError:
    try:
        video = hedra_generate(image, audio)
    except HedraError:
        video = generate_avatar(image, audio)   # longcat-client, import from avatar/
```

## ⚠️ Gotchas

- **VRAM:** full model wants 24GB+. FP8/GGUF via ComfyUI gets toward ~12GB; there's a 4-bit MLX build for 32–48GB Macs. Start with space mode.
- **Job JSON schema:** `longcat-server.py` builds the input JSON from the demo format — verify field names against `assets/avatar/single_example_1.json` in the LongCat-Video repo after cloning.
- **No TTS built in** — keep the existing voice step, LongCat just animates it.
- **Build context:** add a `.dockerignore` with `node_modules`, `.git`, `output`, `weights` so the image build stays fast.
- **Space queues** can be slow at peak times — that's what the fallback chain is for.
- **Tuning:** audio_cfg 3–5 for lip sync, `ref_img_index` 0–24 for identity consistency, 480p first then 720p.
