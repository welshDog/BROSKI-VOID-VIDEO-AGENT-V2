/**
 * 📊 Eval Harness — measure the crew's output (Thread 7).
 *
 * After a run, score each shot on: prompt adherence, artifacts, character match,
 * continuity, audio clarity. Output a CSV + a short report. This is how we
 * iterate: change one thing, re-run, compare metrics.
 *
 * Steal from: VideoGen-of-Thought eval · AIGVE survey metrics
 */
import * as fs from 'node:fs'
import * as path from 'node:path'
import type { JobState, ShotState } from './state.js'

export interface EvalReport {
  jobId: string
  shots: { id: number; score: number; adherence: number; artifacts: number; characterMatch: number; continuity: number; audioClarity: number }[]
  averages: { score: number; adherence: number; artifacts: number; characterMatch: number; continuity: number; audioClarity: number }
}

export function evaluateJob(state: JobState): EvalReport {
  const shots = state.shots.map(s => scoreShot(s))
  const avg = (key: keyof typeof shots[0]) => shots.reduce((a, b) => a + b[key], 0) / shots.length
  return {
    jobId: state.jobId,
    shots,
    averages: { score: avg('score'), adherence: avg('adherence'), artifacts: avg('artifacts'), characterMatch: avg('characterMatch'), continuity: avg('continuity'), audioClarity: avg('audioClarity') },
  }
}

function scoreShot(shot: ShotState): { id: number; score: number; adherence: number; artifacts: number; characterMatch: number; continuity: number; audioClarity: number } {
  const last = shot.attempts[shot.attempts.length - 1]
  const v = last?.verdict
  if (!v) return { id: shot.id, score: 0, adherence: 0, artifacts: 0, characterMatch: 0, continuity: 0, audioClarity: 0 }
  return {
    id: shot.id,
    score: v.score,
    adherence: v.adherence,
    artifacts: v.artifacts,
    characterMatch: v.characterMatch,
    continuity: v.continuity,
    audioClarity: 7, // TODO: measure from audio waveform / SNR
  }
}

export function saveReport(report: EvalReport, dir: string): void {
  fs.mkdirSync(dir, { recursive: true })
  const csv = ['id,score,adherence,artifacts,characterMatch,continuity,audioClarity', ...report.shots.map(s => `${s.id},${s.score},${s.adherence},${s.artifacts},${s.characterMatch},${s.continuity},${s.audioClarity}`)].join('\n')
  fs.writeFileSync(path.join(dir, 'eval.csv'), csv)
  fs.writeFileSync(path.join(dir, 'eval.json'), JSON.stringify(report, null, 2))
}
