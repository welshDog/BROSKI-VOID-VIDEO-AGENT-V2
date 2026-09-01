# 🧠 BROski Void Video Agent V2 — Full History Report

**Repo:** `welshDog/BROSKI-VOID-VIDEO-AGENT-V2`  
**Owner:** Mr Lyndon Williams (welshDog)  
**Location:** S.Wales, UK  
**Company:** Hyperfocus Zone Ltd  
**Mission:** AI Agent Architect building tools for neurodivergents 🤓

---

## 📜 Timeline of Events

### 1️⃣ **Initial Commit** — `ed0ebdd` (01:10 AM BST, Sept 1, 2026)
- **Message:** "Initial commit"
- **What:** Empty repo scaffold created via GitHub UI
- **Committer:** GitHub web-flow (standard repo creation)

---

### 2️⃣ **V2 Full Stack Scaffold** — `c29f41c` (01:23 AM BST, Sept 1, 2026)
- **Message:** "🚀 BROski Void Video Agent V2 — full stack scaffold: agent router, storyboard, generators, avatar, polish, publisher"
- **What:** The entire V2 pipeline landed in one commit:
  - **Agent Router** — model selection by budget mode (FREE/CHEAP/QUALITY/PRO)
  - **Storyboard** — scene parser + shot planner
  - **Generators** — Seedance, Kling, Veo, PixVerse, Vidu, Wan via MuAPI
  - **Avatar** — HeyGen integration for talking heads
  - **Polish** — Video2X upscaling
  - **Publisher** — export + manifest generation
- **Why:** V2 was a **linear pipeline** — script in, video out, no retries, no memory, no eyes

---

### 3️⃣ **V3 Master Plan Issue #2** — (02:14 AM BST, Sept 1, 2026)
- **Title:** "🧠 V3 MASTER PLAN: The Autonomous Video Crew (merged brainstorm — dev mates assemble!)"
- **What:** A single issue merging TWO brainstorm threads (#1 + #2) into one canonical spec
- **North Star Target:**
  > A **60-second, 5-shot short** starring **one recurring character**, mixed scene types (cinematic + talking head + b-roll), with **music + SFX**, exported in 3 formats — produced for **under £1** in **under 15 minutes**, with **0 manual retries** and a face that's the *same person* in every shot.

- **10 Threads Defined:**
  1. 🧠 Orchestrator + shared production state
  2. 🎬 Director agent (shot list, camera, pacing)
  3. 👁️ Critic (VLM quality eval + auto-retry)
  4. 🧬 Character Bible (DNA → reference packs → keyframes)
  5. 🔗 Continuity engine (last-frame → first-frame chaining)
  6. 🔊 Sound designer (music, SFX, ambience, mix)
  7. 📊 Eval harness + golden set
  8. 💾 Persistence + reproducibility + BROski$ gamification
  9. 🤖 MCP server (crew as a tool for other agents)
  10. 🖥️ Web UI storyboard (approve before you spend)

- **Starter Opinion:** "If we only did 3 things: Threads 1+8 (orchestrator + state), Thread 3 (critic), Thread 4 (character bible)"

---

### 4️⃣ **V3 Crew — First Push** — `706b77c` (02:47 AM BST, Sept 1, 2026)
- **Branch:** `v3/crew`
- **Message:** "🧠 V3: autonomous crew — FSM orchestrator, folder-first production state, VLM critic, character bible (Threads 1,3,4,8)"
- **Files (8):**
  - `crew/orchestrator.ts` — FSM loop with budget cap + retry guardrails
  - `crew/state.ts` — folder-first `job.json` per run (Thread 8 foundation)
  - `crew/critic.ts` — VLM image-grid critic (Thread 3)
  - `crew/character-bible.ts` — 4-layer character system (Thread 4)
  - `crew/render-bridge.ts` — connects crew to V2 generators
  - `crew/cli.ts` — entry point
  - `config/characters/broski.character.json` — example bible
  - `.env.example` — `CRITIC_*` + guardrail vars

- **What Changed:** V2 went from **pipeline → crew**. The loop now had **eyes** (critic), **memory** (state), and **identity** (character bible).

---

### 5️⃣ **V3 Level-Up — Director + Continuity** — `4db7d9b` (02:55 AM BST, Sept 1, 2026)
- **Branch:** `v3/crew`
- **Message:** "🎬 V3 level-up: LLM Director (Thread 2) + last-frame continuity engine (Thread 5) + North Star demo script"
- **Files (8):**
  - `crew/director.ts` — LLM shot list with regex fallback (Thread 2)
  - `crew/continuity.ts` — last-frame extract + chain vs hard-cut (Thread 5)
  - `workspace/ep1.md` — 5-shot North Star demo script
  - Updated: `orchestrator.ts`, `render-bridge.ts`, `state.ts`, `cli.ts`, `README.md`, `.env.example`

- **What Changed:** The crew now **plans shots** (Director) and **chains them** (continuity). Face doesn't reset every cut anymore.

---

### 6️⃣ **V3 Level-Up — Sound + Eval** — `bacd9f6` (02:58 AM BST, Sept 1, 2026)
- **Branch:** `v3/crew`
- **Message:** "🔊 V3 level-up: sound designer (Thread 6) + eval harness (Thread 7) + SFX/VO lines"
- **Files (6):**
  - `crew/sound-designer.ts` — TTS (ElevenLabs → espeak fallback) + SFX lookup + mix (Thread 6)
  - `crew/eval-harness.ts` — per-shot metrics + `eval.csv` + `eval.json` (Thread 7)
  - Updated: `orchestrator.ts`, `README.md`, `.env.example`, `cli.ts`, `workspace/ep1.md`

- **What Changed:** The crew now **hears** (sound designer) and **measures itself** (eval harness). After every render, it outputs a report card.

---

## 📊 Current State Summary

| Thread | Status | Files |
|---|---|---|
| 1 🧠 Orchestrator | ✅ Wired | `crew/orchestrator.ts` |
| 2 🎬 Director | ✅ Wired | `crew/director.ts` |
| 3 👁️ Critic | ✅ Wired | `crew/critic.ts` |
| 4 🧬 Character Bible | ✅ Wired | `crew/character-bible.ts` |
| 5 🔗 Continuity | ✅ Wired | `crew/continuity.ts` |
| 6 🔊 Sound Designer | ✅ Wired | `crew/sound-designer.ts` |
| 7 📊 Eval Harness | ✅ Wired | `crew/eval-harness.ts` |
| 8 💾 State (foundation) | ✅ Wired | `crew/state.ts` |
| 9 🤖 MCP Server | 🔧 TODO | — |
| 10 🖥️ Web UI | 🔧 TODO | — |

**Total Time:** ~1 hour 48 minutes from repo creation → full V3 crew (Threads 1–8) live on `v3/crew`

**Commits on `v3/crew`:** 3 (706b77c → 4db7d9b → bacd9f6)

**Open Issues:** 1 (Issue #2 — the V3 Master Plan itself)

---

## 🎯 What's Next (Per the Master Plan)

1. **Open PR** from `v3/crew` → `main` for mate review
2. **Test end-to-end** with real VLM (set `CRITIC_MOCK=0`, `DIRECTOR_API_KEY`)
3. **Thread 9 (MCP)** — wrap crew as `make_video()` tool for other BROski agents
4. **Thread 10 (UI)** — storyboard timeline with approve-before-spend gate

---

## 🏴💜 BROski Energy

From "Initial commit" at 01:10 AM to a **full autonomous video crew** by 02:58 AM — all in one night, all on one branch, all pointing at the North Star:

> **Hand the crew a script. Walk away. Come back to a finished video that needed zero human retries.**

That's the history, bro. Every commit, every thread, every file — logged. 🚀
