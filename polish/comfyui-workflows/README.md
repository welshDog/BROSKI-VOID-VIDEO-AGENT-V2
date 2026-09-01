# 🎛️ ComfyUI Workflows

Drop your Wan 2.2 + polish workflows here in **API format JSON**.

## Where to steal great workflows 🔥

- [DJZ-Workflows](https://github.com/MushroomFleet/DJZ-Workflows) — 1000+ image & video workflows (Hunyuan, CogVideo, upscaling, ControlNet)
- [ComfyUI official examples](https://github.com/comfyanonymous/ComfyUI_examples) — Wan 2.2 text-to-video / image-to-video
- [wan-3.0-comfyui nodes](https://github.com/Anil-matcha/wan-3.0-comfyui) — Wan 3.0 via MuAPI (no GPU needed)

## Wiring into the pipeline

`generators/wan-local.ts` loads `wan22-t2v.json` from this folder and patches
the prompt node (env `WAN_PROMPT_NODE`, default `6`) with each shot's prompt.

1. Build your Wan 2.2 workflow in ComfyUI
2. Export via **Developer → Save (API Format)** → save as `wan22-t2v.json` here
3. Find your positive-prompt node id and set `WAN_PROMPT_NODE` in `.env`
