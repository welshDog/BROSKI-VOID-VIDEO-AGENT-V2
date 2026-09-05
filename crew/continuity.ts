/**
 * 🔗 Continuity engine — last-frame → first-frame chaining (Thread 5).
 *
 * When the Director marks a shot as continuous, we extract the last frame of shot N
 * and feed it as the first frame of shot N+1. That's the glue that stops every clip
 * looking like a different universe.
 *
 * Hard cuts (title cards, talking heads, location jumps) skip chaining.
 * Pro workflows report 15–25% of clips still need regen — the Critic handles that.
 *
 * Steal from: VideoGen-of-Thought smoothing · LTX-2.5 multishot hold
 */
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import * as fs from 'node:fs'
import * as path from 'node:path'

const execFileAsync = promisify(execFile)

/** Grab the last visible frame of a clip as a PNG. */
export async function extractLastFrame(clipPath: string, destPng: string): Promise<string> {
  fs.mkdirSync(path.dirname(destPng), { recursive: true })
  await execFileAsync('ffmpeg', [
    '-hide_banner', '-loglevel', 'error', '-y',
    '-sseof', '-0.15',
    '-i', clipPath,
    '-frames:v', '1',
    destPng,
  ])
  if (!fs.existsSync(destPng)) throw new Error(`last-frame extract failed: ${destPng}`)
  return destPng
}

/** Should this shot chain from the previous one? Director's call, with a safety rule. */
export function shouldChain(
  thisType: string,
  prevType: string | undefined,
  directorSaysYes: boolean,
): boolean {
  if (!directorSaysYes) return false
  if (!prevType) return false
  if (thisType === 'talking_head' || thisType === 'title_card') return false
  if (prevType === 'talking_head' || prevType === 'title_card') return false
  return true
}
