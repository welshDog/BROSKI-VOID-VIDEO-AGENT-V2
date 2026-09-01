/**
 * 🧬 Character Bible — memory for faces (Thread 4).
 *
 * The 4-layer system (the 2026 pro workflow):
 *   1. DNA        — a fixed written physical spec (never changes)
 *   2. PACK       — 3-6 canonical reference images (multi-angle turnaround)
 *   3. KEYFRAMES  — per-shot pose/expression targets
 *   4. ANIMATION  — the actual generation
 *
 * Golden rule: prompts stay SCENE-LED, never identity-led. You do NOT describe the
 * character in every prompt — identity rides in via reference images / first-frames.
 * Describing identity in text invites the model to reinvent the face every shot.
 *
 * Bible files live in config/characters/<name>.character.json — see the example.
 */
import * as fs from 'node:fs'
import * as path from 'node:path'

export interface CharacterDNA {
  name: string
  age: string
  build: string
  face: string          // shape, eyes, nose, jaw — the fixed geometry
  hair: string
  skinTone: string
  distinguishing: string[]  // scars, tattoos, glasses, etc.
}

export interface ReferenceImage {
  path: string          // local path or URL
  angle: 'front' | 'three-quarter' | 'profile' | 'back' | 'custom'
  note?: string
}

export interface WardrobeVariant {
  id: string
  description: string
  appliesTo?: string[]  // scene types this outfit is for (e.g. ["cinematic"])
}

export interface CharacterBible {
  id: string            // e.g. "broski" — used in shot.castIds
  dna: CharacterDNA
  voiceId?: string      // HeyGen / TTS voice
  referencePack: ReferenceImage[]
  wardrobe: WardrobeVariant[]
}

const CHAR_DIR = process.env.CHARACTER_DIR ?? 'config/characters'

export function loadCharacter(id: string): CharacterBible {
  const p = path.join(CHAR_DIR, `${id}.character.json`)
  if (!fs.existsSync(p)) throw new Error(`No character bible: ${id} (looked in ${p})`)
  return JSON.parse(fs.readFileSync(p, 'utf-8')) as CharacterBible
}

export function loadCast(castIds: string[]): CharacterBible[] {
  return castIds.map(loadCharacter)
}

/** Pick reference images for a shot — prefer front/three-quarter for dialogue, profile for motion. */
export function refsForShot(character: CharacterBible, shotType: string): string[] {
  const pack = character.referencePack
  if (pack.length === 0) return []
  const preferred = shotType === 'talking_head' ? ['front', 'three-quarter'] : ['three-quarter', 'profile', 'front']
  const sorted = [...pack].sort((a, b) => preferred.indexOf(a.angle) - preferred.indexOf(b.angle))
  return sorted.slice(0, 3).map(r => r.path)
}

/**
 * Build the generation context for a shot with cast. The prompt itself is NOT
 * modified with identity text — we return the scene prompt unchanged plus the
 * reference image list, which the generator injects via its reference mechanism
 * (Seedance 2.5: up to 50 multimodal refs; Kling: first-frame still; etc.).
 */
export function buildShotContext(scenePrompt: string, castIds: string[], shotType: string): {
  prompt: string            // scene-led, unchanged
  referenceImages: string[] // identity rides in here
  wardrobeNotes: string[]   // optional outfit hints for the shot
} {
  const cast = loadCast(castIds)
  const referenceImages = cast.flatMap(c => refsForShot(c, shotType))
  const wardrobeNotes = cast.flatMap(c =>
    c.wardrobe.filter(w => !w.appliesTo || w.appliesTo.includes(shotType)).map(w => `${c.id}: ${w.description}`),
  )
  return { prompt: scenePrompt, referenceImages, wardrobeNotes }
}

/** Scaffold a blank character bible to fill in. */
export function scaffoldCharacter(id: string): void {
  fs.mkdirSync(CHAR_DIR, { recursive: true })
  const blank: CharacterBible = {
    id,
    dna: { name: id, age: '', build: '', face: '', hair: '', skinTone: '', distinguishing: [] },
    referencePack: [],
    wardrobe: [],
  }
  const p = path.join(CHAR_DIR, `${id}.character.json`)
  fs.writeFileSync(p, JSON.stringify(blank, null, 2))
  console.log(`🧬 Scaffolded ${p} — fill in the DNA and add 3-6 reference images`)
}
