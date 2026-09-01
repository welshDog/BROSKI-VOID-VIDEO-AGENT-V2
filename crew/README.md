# 🧠 V3 Crew — The Autonomous Video Crew

> The leap from V2: **a pipeline → a production crew.**
> Hand the crew a script. Walk away. Come back to a finished video.

This package is **Threads 1, 3, 4 + 8-foundation** of the [V3 Master Plan](../..../issues/2):

| Agent / Module | Thread | What it does |
|---|---|---|
| `orchestrator.ts` | 1 🧠 | The crew loop — an explicit **finite-state machine** that runs every shot through DIRECT → GENERATE → CRITIQUE → ACCEPT/REJECT, with retry budgets + a hard £ cap |
| `state.ts` | 8 💾 | **Production state** — one folder + one `job.json` per run, git-friendly, resumable, replayable |
| `critic.ts` | 3 👁️ | The **VLM critic** — samples frames into ONE image grid, scores prompt-adherence / artifacts / character-match / continuity, auto-retries with notes |
| `character-bible.ts` | 4 🧬 | The **4-layer character system** — DNA → reference Pack → shot Keyframes → Animation. Prompts stay scene-led, identity rides in via references |

## 🔄 The crew loop

```
PLAN ──▶ for each shot:
  ┌──────────────┐
  │   DIRECT     │  shot plan (from V2 parser — Director LLM is Thread 2)
  │      ▼       │
  │  GENERATE    │  V2 model router, richer prompts + char refs
  │      ▼       │
  │  CRITIQUE    │  VLM scores the clip (image-grid trick)
  │      ▼       │
  │ accept? ──yes──▶ EDIT ──▶ PUBLISH ──▶ DONE
  └──────┬───────┘
      no │ reject + notes (max N retries, £ cap enforced)
         └────────▶ back to GENERATE
```

## 🗂️ Production state (folder-first, on purpose)

```
runs/<jobId>/
├── job.json          # the whole run — resumable, replayable
├── script.md
├── shots/            # per-shot clip attempts + critic scores
├── refs/             # character reference images
└── final/            # accepted clips + exports
```

**Why a folder and not Supabase first?** Zero infra, git-versioned, you can `cat`/`diff`/`git log` a render. Graduate to Supabase once the schema stops moving (that's Thread 8 proper).

## 🎬 Run it

```bash
# from the repo root
npx tsx crew/cli.ts --script workspace/ep1.md --mode CHEAP \
  --character config/characters/broski.character.json --yes
```

Dry-run (plan only, no spend):
```bash
npx tsx crew/cli.ts --script workspace/ep1.md --mode FREE
```

## ⚙️ Env additions (on top of V2)

```bash
# The Critic — any OpenAI-compatible VLM endpoint
CRITIC_BASE_URL=        # e.g. https://openrouter.ai/api/v1  or  http://localhost:11434/v1 (Ollama)
CRITIC_API_KEY=
CRITIC_MODEL=           # e.g. google/gemini-2.0-flash-001  or  llava / qwen2-vl local

# Budget guardrail (the cross-cutting rule — enforced in the loop, not just the edge)
MAX_COST_GBP=2.00       # hard stop per run
MAX_RETRIES_PER_SHOT=3
ACCEPT_SCORE=7.0        # critic score (0–10) that marks a shot accepted
```

## 🧪 What's wired vs TODO

✅ FSM orchestrator · folder-first job state · retry+budget guardrails · critic prompt + image-grid sampling + scoring schema · character bible loader + prompt injector · CLI

🔧 TODO (call out in the issue):
- Thread 2 Director LLM (parser is still V2's regex — swap point marked in `orchestrator.ts`)
- Thread 6 sound designer
- Real VLM endpoint tested end-to-end (`critic.ts` has a `MOCK` mode so you can run the loop offline)
- Threads 9 (MCP) / 10 (UI) build on top of this state
