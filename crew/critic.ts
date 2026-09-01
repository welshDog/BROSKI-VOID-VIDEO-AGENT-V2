/**
 * 👁️ The Critic — a VLM that gives the crew eyes (Thread 3).
 *
 * The video-understanding trick: instead of asking a VLM to "watch video" (heavy,
 * many VLMs can't), we sample N frames from the clip, tile them into ONE image
 * grid, and have the VLM read the grid. One image = full temporal coverage, works
 * with any vision-capable endpoint. (See arxiv 2403.18406 — "An Image Grid Can Be
 * Worth a Video".)
 *
 * Scoring dimensions follow the AIGVE surveys (arxiv 2410.19884, 2506.18564).
 *
 * Runs against any OpenAI-compatible vision endpoint: OpenRouter, Ollama
 * (llava / qwen2-vl), vLLM, etc. Set CRITIC_MODEL accordingly.
 *
 * MOCK MODE: if CRITIC_MOCK=1 (or no key set), returns a random-ish verdict so you
 * can exercise the whole crew loop offline with zero spend.
 */
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import * as fs from 'node:fs'
import * as path from 'node:path'
import type { ShotState, CriticVerdict } from './state.js'

const execFileAsync = promisify(execFile)

const BASE = process.env.CRITIC_BASE_URL ?? 'https://openrouter.ai/api/v1'
const KEY = process.env.CRITIC_API_KEY ?? ''
const MODEL = process.env.CRITIC_MODEL ?? 'google/gemini-2.0-flash-001'
const MOCK = process.env.CRITIC_MOCK === '1' || (!KEY && process.env.NODE_ENV !== 'production')

const FRAMES = 6 // how many frames to sample into the grid

/** Pull N frames and tile into one grid image via ffmpeg. */
export async function sampleGrid(clipPath: string, outDir: string): Promise<string> {
  fs.mkdirSync(outDir, { recursive: true })
  const gridPath = path.join(outDir, `grid-${Date.now()}.png`)
  // fps trick: sample FRAMES evenly across the clip, then tile into a 3x2 grid
  await execFileAsync('ffmpeg', [
    '-hide_banner', '-loglevel', 'error', '-y',
    '-i', clipPath,
    '-vf', `fps=${FRAMES}/999999,scale=640:-1,tile=3x2`,
    '-frames:v', '1',
    gridPath,
  ])
  return gridPath
}

function buildPrompt(shot: ShotState, prevNotes?: string): string {
  return `You are a strict AI-video quality critic. You are shown a 3x2 grid of ${FRAMES} frames sampled evenly across a short generated video clip (read left-to-right, top-to-bottom = time order).

THE SHOT THAT WAS REQUESTED:
- Type: ${shot.type}
- Prompt: "${shot.prompt}"
- Duration target: ${shot.durationSec}s
${shot.castIds.length ? `- Characters expected: ${shot.castIds.join(', ')}` : ''}
${prevNotes ? `- Previous attempt was REJECTED with notes: "${prevNotes}" — check whether these specific issues are fixed.` : ''}

Score the clip 0-10 on each axis, then decide accept/reject.
Return STRICT JSON only, no markdown fences:
{
  "adherence": <0-10 how well the visuals match the prompt>,
  "artifacts": <0-10, 10 = zero visual artifacts like extra fingers/melted faces/morphing>,
  "characterMatch": <0-10, how consistent any person looks across frames; 10 = same person>,
  "continuity": <0-10, visual coherence of motion/scene across the sampled frames>,
  "notes": "<one or two sentences of SPECIFIC, actionable feedback for a retry. If good, say why>",
  "accepted": <true|false>
}`
}

export async function critique(clipPath: string, shot: ShotState, acceptScore: number, prevNotes?: string): Promise<CriticVerdict> {
  const attempt = shot.attempts.length + 1

  if (MOCK) {
    // Deterministic-ish mock: score improves with each attempt so the loop terminates
    const bump = Math.min(attempt - 1, 3)
    const score = 5 + bump + Math.random() * (5 - bump)
    const accepted = score >= acceptScore
    return {
      attempt,
      score: round1(score),
      adherence: round1(score),
      artifacts: round1(score + 0.5),
      characterMatch: round1(score - 0.3),
      continuity: round1(score),
      notes: accepted ? 'MOCK: looks good.' : `MOCK: attempt ${attempt} below bar — re-roll with a seed variation.`,
      accepted,
      costUSD: 0,
    }
  }

  const grid = await sampleGrid(clipPath, path.join(path.dirname(clipPath), 'grids'))
  const imageB64 = fs.readFileSync(grid).toString('base64')

  const res = await fetch(`${BASE}/chat/completions`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: MODEL,
      messages: [
        {
          role: 'user',
          content: [
            { type: 'text', text: buildPrompt(shot, prevNotes) },
            { type: 'image_url', image_url: { url: `data:image/png;base64,${imageB64}` } },
          ],
        },
      ],
      temperature: 0.1,
    }),
  })
  if (!res.ok) throw new Error(`Critic VLM ${res.status}: ${(await res.text()).slice(0, 200)}`)
  const data = await res.json()
  const raw: string = data.choices?.[0]?.message?.content ?? ''
  const parsed = parseVerdict(raw)

  const score = (parsed.adherence + parsed.artifacts + parsed.characterMatch + parsed.continuity) / 4
  return {
    attempt,
    score: round1(score),
    adherence: parsed.adherence,
    artifacts: parsed.artifacts,
    characterMatch: parsed.characterMatch,
    continuity: parsed.continuity,
    notes: parsed.notes,
    accepted: score >= acceptScore && parsed.accepted,
    costUSD: 0.001, // ~one vision call; refine per provider pricing
  }
}

function parseVerdict(raw: string): Omit<CriticVerdict, 'attempt' | 'score' | 'costUSD' | 'accepted'> & { accepted: boolean } {
  const cleaned = raw.replace(/```json|```/g, '').trim()
  const match = cleaned.match(/\{[\s\S]*\}/)
  if (!match) throw new Error(`Critic returned non-JSON: ${raw.slice(0, 200)}`)
  const v = JSON.parse(match[0])
  return {
    adherence: num(v.adherence),
    artifacts: num(v.artifacts),
    characterMatch: num(v.characterMatch),
    continuity: num(v.continuity),
    notes: String(v.notes ?? ''),
    accepted: Boolean(v.accepted),
  }
}

const num = (x: unknown): number => Math.max(0, Math.min(10, Number(x) || 0))
const round1 = (x: number): number => Math.round(x * 10) / 10
