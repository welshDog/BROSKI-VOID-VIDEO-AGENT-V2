/**
 * 🐉 Seedance builders (ByteDance) — best value (2.0 Mini) & best overall (2.5).
 * Seedance 2.5: up to 4K, 30s single-pass, 50 multimodal references.
 */
import { MODEL_ENDPOINTS } from './muapi-client.js'
import type { Shot } from '../storyboard/shot-planner.js'

export function buildSeedancePayload(
  model: 'seedance-2.0-mini' | 'seedance-2.5',
  shot: Shot,
): { endpoint: string; payload: Record<string, unknown> } {
  return {
    endpoint: MODEL_ENDPOINTS[model],
    payload: {
      prompt: shot.videoPrompt,
      negative_prompt: shot.negativePrompt,
      duration: shot.durationSec,
      resolution: '1080p',
      aspect_ratio: shot.aspectRatio,
      // TODO: Seedance 2.5 supports up to 50 multimodal references —
      // add `references: [{ type: 'image', url }]` once wired to a character sheet.
    },
  }
}
