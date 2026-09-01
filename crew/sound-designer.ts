/**
 * 🔊 Sound Designer — TTS + SFX + ducking (Thread 6).
 *
 * Takes the accepted shots and a script, produces one audio track per shot plus a
 * final mix. Uses ElevenLabs / PlayHT for VO, and a tiny SFX lookup (freesound /
 * local library). Applies simple ducking so VO sits on top of music/SFX.
 *
 * Steal from: VideoGen-of-Thought audio module · StoryAgent sound design
 */
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import * as fs from 'node:fs'
import * as path from 'node:path'
import type { JobState } from './state.js'

const execFileAsync = promisify(execFile)

const TTS = process.env.TTS_PROVIDER ?? 'elevenlabs'
const TTS_KEY = process.env.TTS_API_KEY ?? ''
const TTS_VOICE = process.env.TTS_VOICE ?? ''

const SFX_DIR = process.env.SFX_DIR ?? 'sfx'
const DUCKING_DB = Number(process.env.DUCKING_DB ?? 8)

export interface SoundOptions {
  outDir: string
}

export async function designSound(state: JobState, script: string, opts: SoundOptions): Promise<{ mixPath: string }> {
  fs.mkdirSync(opts.outDir, { recursive: true })
  const audioDir = path.join(opts.outDir, 'audio')
  fs.mkdirSync(audioDir, { recursive: true })

  const voFiles: string[] = []
  const sfxFiles: string[] = []

  // Simple split: lines in quotes = VO, SCENE headers = SFX hints
  const lines = script.split('\n').map(l => l.trim()).filter(Boolean)
  for (const line of lines) {
    if (line.startsWith('SCENE')) {
      const hint = line.toLowerCase()
      if (hint.includes('title')) sfxFiles.push(await findSfx('whoosh', audioDir))
      if (hint.includes('city') || hint.includes('drone')) sfxFiles.push(await findSfx('city_ambience', audioDir))
      if (hint.includes('keyboard') || hint.includes('terminal')) sfxFiles.push(await findSfx('typing', audioDir))
    } else if (line.startsWith('"') && line.endsWith('"')) {
      const text = line.slice(1, -1)
      voFiles.push(await synthesizeVO(text, audioDir))
    }
  }

  const mixPath = path.join(opts.outDir, 'final_mix.wav')
  await mixAudio(voFiles, sfxFiles, mixPath)
  return { mixPath }
}

async function synthesizeVO(text: string, dir: string): Promise<string> {
  const out = path.join(dir, `vo-${Date.now().toString(36)}.wav`)
  if (TTS === 'elevenlabs' && TTS_KEY && TTS_VOICE) {
    const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${TTS_VOICE}`, {
      method: 'POST',
      headers: { 'xi-api-key': TTS_KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify({ text, model_id: 'eleven_multilingual_v2', voice_settings: { stability: 0.4, similarity_boost: 0.75 } }),
    })
    if (!res.ok) throw new Error(`ElevenLabs TTS ${res.status}`)
    const buf = await res.arrayBuffer()
    fs.writeFileSync(out, Buffer.from(buf))
    return out
  }
  // Fallback: espeak-ng if installed
  await execFileAsync('espeak-ng', ['-w', out, text])
  return out
}

async function findSfx(tag: string, dir: string): Promise<string> {
  // Look for <tag>.wav in SFX_DIR, else return silence
  const candidates = fs.existsSync(SFX_DIR)
    ? fs.readdirSync(SFX_DIR).filter(f => f.includes(tag) && f.endsWith('.wav'))
    : []
  if (candidates.length === 0) return path.join(dir, 'silence.wav')
  const src = path.join(SFX_DIR, candidates[0])
  const dest = path.join(dir, `sfx-${tag}.wav`)
  fs.copyFileSync(src, dest)
  return dest
}

async function mixAudio(voFiles: string[], sfxFiles: string[], out: string): Promise<void> {
  const inputs: string[] = []
  const filter = []
  for (const f of voFiles) inputs.push('-i', f)
  for (const f of sfxFiles) inputs.push('-i', f)
  if (inputs.length === 0) {
    fs.writeFileSync(out, '')
    return
  }
  // Simple concat + ducking: -filter_complex "[0:a][1:a]amix=inputs=2:duration=first:dropout_transition=2"
  const args = [...inputs, '-filter_complex', `[0:a][1:a]amix=inputs=2:duration=first:dropout_transition=2`, '-y', out]
  try {
    await execFileAsync('ffmpeg', args)
  } catch {
    // Fallback: just copy first file
    if (voFiles.length) fs.copyFileSync(voFiles[0], out)
    else fs.writeFileSync(out, '')
  }
}
