/**
 * 🎥 Kling 3.0 builder (Kuaishou) — best motion + image-to-video.
 */
import { MODEL_ENDPOINTS } from './muapi-client.js'
import type { Shot } from '../storyboard/shot-planner.js'

export function buildKlingPayload(shot: Shot): { endpoint: string; payload: Record<string, unknown> } {
  return {
    endpoint: MODEL_ENDPOINTS['kling-3.0'],
    payload: {
      prompt: shot.videoPrompt,
      negative_prompt: shot.negativePrompt,
      duration: Math.min(shot.durationSec, 10),
      aspect_ratio: shot.aspectRatio,
      // 🔥 Kling shines on image-to-video: pass `image` (URL or base64)
      // when you have a first-frame still from your storyboard.
    },
  }
}
