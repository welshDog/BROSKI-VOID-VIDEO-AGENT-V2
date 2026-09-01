# 🧠 V3 Crew — The Autonomous Video Crew

> The leap from V2: **a pipeline → a production crew.**
> Hand the crew a script. Walk away. Come back to a finished video.

Wired against the [V3 Master Plan](https://github.com/welshDog/BROSKI-VOID-VIDEO-AGENT-V2/issues/2):

| Module | Thread | Status |
|---|---|---|
| `orchestrator.ts` | 1 🧠 FSM loop + £ cap + retries | ✅ |
| `director.ts` | 2 🎬 LLM shot list (regex fallback) | ✅ |
| `critic.ts` | 3 👁️ VLM image-grid critic | ✅ |
| `character-bible.ts` | 4 🧬 4-layer identity | ✅ |
| `continuity.ts` | 5 🔗 last-frame → first-frame | ✅ |
| sound designer | 6 🔊 | 🔧 |
| eval harness | 7 📊 | 🔧 |
| `state.ts` | 8 💾 folder-first job.json | ✅ foundation |
| MCP / UI | 9–10 | 🔧 |

## 🔄 The crew loop

```
DIRECTOR (LLM or regex)
   │  shot list + continuity links
   ▼
for each shot:
  GENERATE  (V2 router + char refs + chained last-frame)
      ▼
  CRITIQUE  (VLM scores image-grid of 6 frames)
      ▼
  accept? ─yes─▶ extract last frame ─▶ next shot
      │ no + notes (max N retries, £ cap)
      └─────▶ GENERATE again
```

## 📂 Production state

```
runs/<jobId>/
├── job.json
├── shots/          # attempts + last-frame PNGs
├── refs/
└── final/
```

## 🎬 Run the North Star script

```bash
git checkout v3/crew
npx tsx crew/cli.ts --script workspace/ep1.md --character broski
# dry-run prints the Director's shot list. Add --yes to spend.
```

Offline / £0: `CRITIC_MOCK=1` (default) + no Director key → regex plan + mock critic.

## Env

See `.env.example` — `CRITIC_*`, `DIRECTOR_*`, `MAX_COST_GBP`, `MAX_RETRIES_PER_SHOT`, `ACCEPT_SCORE`.
