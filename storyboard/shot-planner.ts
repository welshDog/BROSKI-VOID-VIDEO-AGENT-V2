/**
 * 🎨 Storyboard Layer 2 — dresses scenes with style presets and builds final prompts.
 */
import * as fs from 'node:fs'
import type { Scene } from './scene-parser.js'

export interface StylePreset {
  name: string
  styleSuffix: string
  negativePrompt: string
}

export interface Shot extends Scene {
  videoPrompt: string
  negativePrompt: string
  aspectRatio: string
}

const PRESETS_PATH = process.env.STYLE_PRESETS_PATH ?? 'config/style-presets.json'

export function loadStylePreset(name: string): StylePreset {
  const all = JSON.parse(fs.readFileSync(PRESETS_PATH, 'utf-8')) as Record<string, Omit<StylePreset, 'name'>>
  const preset = all[name] ?? all['hyperfocus-zone']
  if (!preset) throw new Error(`Style preset "${name}" not found in ${PRESETS_PATH}`)
  return { name, ...preset }
}

export function planShots(scenes: Scene[], preset: StylePreset, aspectRatio: string): Shot[] {
  return scenes.map(scene => {
    const base =
      scene.type === 'talking_head'
        ? scene.dialogue ?? scene.description
        : `${scene.description}. ${preset.styleSuffix}`.trim()

    return {
      ...scene,
      videoPrompt: base,
      negativePrompt: preset.negativePrompt,
      aspectRatio,
    }
  })
}
