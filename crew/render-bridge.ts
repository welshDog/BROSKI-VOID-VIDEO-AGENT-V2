/**
 * 🔌 Render Bridge — connects the V3 crew to V2's generators without changing them.
 *
 * Injects:
 *   - character reference images (Seedance 2.5 refs / Kling first-frame)
 *   - chained last-frame from the previous accepted shot (Thread 5)
 *   - critic retry notes into the prompt
 */
import * as path from 'node:path'
import type { ModelId } from '../agent-router/model-selector.js'
import type { ShotState } from './state.js'
import { muapiGenerate, muapiWait, muapiDownload } from '../generators/muapi-client.js'
import { generateWanLocal } from '../generators/wan-local.js'
import { buildSeedancePayload } from '../generators/seedance.js'
import { buildKlingPayload } from '../generators/kling.js'
import { buildVeoPayload } from '../generators/veo.js'

export interface RenderRequest {
  model: ModelId
  shot: ShotState
  prompt: string
  referenceImages: string[]
  firstFramePath?: string
  seed: number
  prevNotes?: string
  outDir: string
}

export interface RenderResult { file: string; costUSD: number }

export async function renderShot(req: RenderRequest): Promise<RenderResult> {
  const { model, shot } = req

  if (model === 'heygen' || model === 'musetalk-local') {
    const { execFile } = await import('node:child_process')
    const { promisify } = await import('node:util')
    const dest = path.join(req.outDir, `shot-${shot.id}-heygen.mp4`)
    await promisify(execFile)('python3', ['avatar/heygen-client.py', '--text', shot.prompt, '--out', dest])
    return { file: dest, costUSD: 0 }
  }

  if (model === 'wan-local') {
    const shotLike = { ...shot, videoPrompt: req.prompt, aspectRatio: '9:16', description: shot.heading }
    const file = await generateWanLocal(shotLike as any, req.outDir)
    return { file, costUSD: 0 }
  }

  const prompt = req.prevNotes ? `${req.prompt}\n\nCRITICAL FIX from last attempt: ${req.prevNotes}` : req.prompt
  const shotLike = {
    ...shot,
    videoPrompt: prompt,
    negativePrompt: shot.negativePrompt,
    aspectRatio: '9:16',
    description: shot.heading,
  }

  let built: { endpoint: string; payload: Record<string, unknown> }
  if (model.startsWith('seedance')) {
    built = buildSeedancePayload(model as 'seedance-2.0-mini' | 'seedance-2.5', shotLike as any)
    const refs = [
      ...req.referenceImages.map(url => ({ type: 'image', url })),
      ...(req.firstFramePath ? [{ type: 'image', url: req.firstFramePath }] : []),
    ]
    if (refs.length) built.payload.references = refs
    if (req.firstFramePath) built.payload.first_frame = req.firstFramePath
    built.payload.seed = req.seed
  } else if (model.startsWith('kling')) {
    built = buildKlingPayload(shotLike as any)
    built.payload.image = req.firstFramePath ?? req.referenceImages[0]
  } else if (model.startsWith('veo')) {
    built = buildVeoPayload(model as 'veo-3.1-lite' | 'veo-3.1-fast' | 'veo-3.1-quality', shotLike as any)
  } else {
    built = { endpoint: `/video/${model}`, payload: { prompt, duration: shot.durationSec } }
  }

  const taskId = await muapiGenerate(built.endpoint, built.payload)
  const url = await muapiWait(taskId)
  const dest = path.join(req.outDir, `shot-${shot.id}-attempt${shot.attempts.length + 1}.mp4`)
  await muapiDownload(url, dest)
  return { file: dest, costUSD: estimateCost(model, shot.durationSec) }
}

function estimateCost(model: ModelId, sec: number): number {
  const rates: Partial<Record<ModelId, number>> = {
    'seedance-2.0-mini': 0.025, 'pixverse-v6': 0.033, 'vidu-q3': 0.04, 'veo-3.1-lite': 0.04,
    'veo-3.1-fast': 0.15, 'kling-3.0': 0.1, 'seedance-2.5': 0.12, 'veo-3.1-quality': 0.4,
  }
  return (rates[model] ?? 0) * sec
}
