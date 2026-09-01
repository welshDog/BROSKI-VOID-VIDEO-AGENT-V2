/**
 * 🎬 The Director — shot list, camera, pacing (Thread 2).
 *
 * Replaces V2's regex splitter when an LLM key is present. Reads the WHOLE script
 * and outputs a structured shot list: type, duration, camera, cast, continuity link.
 * Owns coverage (wide → medium → close) and rhythm (fast cuts vs holds).
 *
 * Fallback: if DIRECTOR_MOCK=1 or no key, uses V2 parseScript + planShots so the
 * crew still runs offline at £0. Swap is one function — CLI already calls this.
 *
 * Steal from: VideoGen-of-Thought script module · StoryAgent storyboard agent
 */
import { parseScript } from '../storyboard/scene-parser.js'
import { planShots, loadStylePreset } from '../storyboard/shot-planner.js'
import type { ShotState } from './state.js'
import type { SceneType } from '../agent-router/model-selector.js'

const BASE = process.env.DIRECTOR_BASE_URL ?? process.env.CRITIC_BASE_URL ?? 'https://openrouter.ai/api/v1'
const KEY = process.env.DIRECTOR_API_KEY ?? process.env.CRITIC_API_KEY ?? ''
const MODEL = process.env.DIRECTOR_MODEL ?? process.env.CRITIC_MODEL ?? 'google/gemini-2.0-flash-001'
const MOCK = process.env.DIRECTOR_MOCK === '1' || !KEY

export interface DirectOptions {
  preset: string
  aspect: string
  defaultCast: string[]
}

interface DirectorShot {
  type: SceneType
  heading: string
  prompt: string
  durationSec: number
  camera: string
  continuity: boolean
  castIds: string[]
}

const VALID_TYPES: SceneType[] = ['cinematic', 'anime', 'talking_head', 'b_roll', 'title_card']

export async function directScript(script: string, opts: DirectOptions): Promise<ShotState[]> {
  if (MOCK) {
    console.log('   🎬 Director: regex fallback (set DIRECTOR_API_KEY to use the LLM)')
    return fallbackPlan(script, opts)
  }
  try {
    const llmShots = await llmPlan(script, opts)
    console.log(`   🎬 Director LLM planned ${llmShots.length} shot(s)`)
    return llmShots
  } catch (err: unknown) {
    console.log(`   ⚠️  Director LLM failed (${err instanceof Error ? err.message : err}) — regex fallback`)
    return fallbackPlan(script, opts)
  }
}

async function llmPlan(script: string, opts: DirectOptions): Promise<ShotState[]> {
  const sys = `You are a film director for short-form AI video (max ~60s total).
Turn the script into a JSON shot list. Rules:
- Mix coverage: wide establishing → medium → close. Don't stay on one scale.
- Each shot 4–12 seconds. Total around 60s if the script supports it.
- Types: cinematic | anime | talking_head | b_roll | title_card
- continuity=true ONLY when action should visually continue from the previous shot (same location, same moment). Hard cuts (title cards, talking heads, location jumps) = false.
- Prompts are SCENE-LED: describe the action, camera, lighting, mood. Do NOT describe character identity/face — identity is injected via reference images.
- camera: one short phrase ("slow push in", "aerial drone", "static", "handheld follow").
Return STRICT JSON only, no markdown:
{"shots":[{"type":"cinematic","heading":"...","prompt":"...","durationSec":8,"camera":"...","continuity":false,"castIds":[]}]}
Default cast ids if a person is on screen: ${JSON.stringify(opts.defaultCast)}`

  const res = await fetch(`${BASE}/chat/completions`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: MODEL,
      temperature: 0.4,
      messages: [
        { role: 'system', content: sys },
        { role: 'user', content: `ASPECT: ${opts.aspect}\nPRESET: ${opts.preset}\n\nSCRIPT:\n${script}` },
      ],
    }),
  })
  if (!res.ok) throw new Error(`Director ${res.status}: ${(await res.text()).slice(0, 200)}`)
  const data = await res.json()
  const raw: string = data.choices?.[0]?.message?.content ?? ''
  const parsed = parseDirectorJson(raw)
  return toShotState(parsed, opts)
}

function parseDirectorJson(raw: string): DirectorShot[] {
  const cleaned = raw.replace(/```json|```/g, '').trim()
  const match = cleaned.match(/\{[\s\S]*\}/)
  if (!match) throw new Error(`Director returned non-JSON: ${raw.slice(0, 180)}`)
  const body = JSON.parse(match[0]) as { shots?: DirectorShot[] }
  if (!Array.isArray(body.shots) || body.shots.length === 0) throw new Error('Director returned no shots')
  return body.shots
}

function toShotState(planned: DirectorShot[], opts: DirectOptions): ShotState[] {
  const preset = loadStylePreset(opts.preset)
  return planned.map((s, i) => {
    const type = VALID_TYPES.includes(s.type) ? s.type : 'cinematic'
    const durationSec = Math.max(3, Math.min(30, Number(s.durationSec) || 8))
    const scenePrompt = s.prompt?.trim() || s.heading || 'cinematic shot'
    const withStyle = type === 'talking_head' ? scenePrompt : `${scenePrompt}. ${s.camera ? 'Camera: ' + s.camera + '.' : ''} ${preset.styleSuffix}`.trim()
    const castIds = (s.castIds?.length ? s.castIds : opts.defaultCast) ?? []
    return {
      id: i + 1,
      type,
      heading: (s.heading || scenePrompt).slice(0, 80),
      prompt: withStyle,
      negativePrompt: preset.negativePrompt,
      durationSec,
      castIds,
      continuityFrom: s.continuity && i > 0 ? i : null,
      lastFramePath: null,
      status: 'planned',
      attempts: [],
    }
  })
}

function fallbackPlan(script: string, opts: DirectOptions): ShotState[] {
  const preset = loadStylePreset(opts.preset)
  const planned = planShots(parseScript(script), preset, opts.aspect)
  return planned.map((p, i) => {
    const prev = planned[i - 1]
    const chain =
      i > 0 &&
      p.type !== 'talking_head' &&
      p.type !== 'title_card' &&
      prev?.type !== 'talking_head' &&
      prev?.type !== 'title_card'
    return {
      id: p.id,
      type: p.type,
      heading: p.heading,
      prompt: p.videoPrompt,
      negativePrompt: p.negativePrompt,
      durationSec: p.durationSec,
      castIds: opts.defaultCast,
      continuityFrom: chain ? planned[i - 1]!.id : null,
      lastFramePath: null,
      status: 'planned' as const,
      attempts: [],
    }
  })
}
