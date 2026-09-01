/**
 * 🎬 Storyboard Layer 1 — turns a script file into structured scenes.
 * Pure heuristics, no LLM required — plug an LLM splitter in later if you want.
 *
 * Script format:
 *   SCENE 1 (5s) TITLE CARD: glitch logo reveal — "HYPERFOCUS ZONE"
 *   SCENE 2 (8s) CINEMATIC: aerial shot over Nexus City at night, rain on neon
 *   SCENE 3 (12s) TALKING HEAD: "Yo BROskis, welcome back to the Zone!"
 */
import type { SceneType } from '../agent-router/model-selector.js'

export interface Scene {
  id: number
  heading: string
  description: string
  dialogue?: string
  durationSec: number
  type: SceneType
}

const SCENE_RE = /^\s*(?:#+\s*)?(?:SCENE|SHOT|SC)\s*#?\d+\s*[:(\-]?/i

export function parseScript(text: string): Scene[] {
  const lines = text.split(/\r?\n/)
  const blocks: string[] = []
  let current: string[] = []

  for (const line of lines) {
    if (SCENE_RE.test(line) && current.length > 0) {
      blocks.push(current.join('\n').trim())
      current = []
    }
    if (line.trim()) current.push(line.trim())
  }
  if (current.length > 0) blocks.push(current.join('\n').trim())

  // Fallback: no scene headings → each paragraph is a scene
  const source =
    blocks.length > 0
      ? blocks
      : text
          .split(/\n\s*\n/)
          .map(b => b.trim())
          .filter(Boolean)

  return source.map((block, i) => parseScene(block, i + 1)).filter(s => s.description.length > 0)
}

function parseScene(block: string, id: number): Scene {
  const first = block.split('\n')[0] ?? block
  const durationMatch = block.match(/\((\d+)\s*s(?:ec)?s?\)/i) ?? block.match(/(\d+)\s*seconds?/i)
  const durationSec = durationMatch ? Math.min(parseInt(durationMatch[1]!, 10), 30) : 8
  const quoted = block.match(/"([^"]+)"/)

  return {
    id,
    heading: first.slice(0, 80),
    description: block
      .replace(SCENE_RE, '')
      .replace(/\(\d+\s*s(?:ec)?s?\)/i, '')
      .trim(),
    dialogue: quoted ? quoted[1] : undefined,
    durationSec,
    type: classifyScene(block),
  }
}

export function classifyScene(text: string): SceneType {
  const t = text.toLowerCase()
  if (/(talking head|presenter|avatar|speaks?|dialogue|voiceover|\bvo\b)/.test(t)) return 'talking_head'
  if (/(anime|manga|cel[- ]shaded|illustrated)/.test(t)) return 'anime'
  if (/(title card|logo reveal|intro|outro|end card)/.test(t)) return 'title_card'
  if (/(b[- ]roll|cutaway|montage|establishing shot)/.test(t)) return 'b_roll'
  return 'cinematic'
}
