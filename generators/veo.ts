/**
 * 🎥 Veo 3.1 builders (Google) — best prompt adherence + native synced audio.
 */
import { MODEL_ENDPOINTS } from './muapi-client.js'
import type { Shot } from '../storyboard/shot-planner.js'

export function buildVeoPayload(
  model: 'veo-3.1-lite' | 'veo-3.1-fast' | 'veo-3.1-quality',
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
      generate_audio: true, // 🔊 Veo 3.1 generates native synced audio
    },
  }
}
