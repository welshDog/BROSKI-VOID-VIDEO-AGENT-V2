/**
 * 💾 Production State — folder-first, one job.json per run.
 *
 * The single source of truth every agent reads and writes. Resumable: if the
 * process dies mid-run, reloadJob() picks up exactly where it left off.
 * Replayable: every prompt, seed, model and cost is stored, so you can
 * re-render one shot with everything else frozen.
 *
 * Deliberately NOT a database yet — see Thread 8 in the V3 Master Plan.
 */
import * as fs from 'node:fs'
import * as path from 'node:path'
import type { BudgetMode, SceneType } from '../agent-router/model-selector.js'

export type ShotStatus =
  | 'planned'      // Director has a plan, nothing generated yet
  | 'generating'   // a render is in flight
  | 'critiquing'   // clip exists, critic is scoring
  | 'accepted'     // critic score >= ACCEPT_SCORE
  | 'rejected'     // critic rejected, notes attached, will retry
  | 'exhausted'    // hit retry budget — human review needed
  | 'done'         // polished + exported

export interface CriticVerdict {
  attempt: number
  score: number              // 0–10 overall
  adherence: number          // prompt adherence 0–10
  artifacts: number          // artifact cleanliness 0–10 (10 = no artifacts)
  characterMatch: number     // vs character bible 0–10
  continuity: number         // vs previous shot 0–10
  notes: string              // specific, actionable feedback for the retry
  accepted: boolean
  costUSD: number            // what this critique call cost
}

export interface ShotAttempt {
  attempt: number
  prompt: string
  model: string
  seed: number
  file: string | null
  costUSD: number
  verdict?: CriticVerdict
}

export interface ShotState {
  id: number
  type: SceneType
  heading: string
  prompt: string
  negativePrompt: string
  durationSec: number
  castIds: string[]          // which characters appear (from the bible)
  continuityFrom: number | null  // shot id this one chains from (last-frame link)
  status: ShotStatus
  attempts: ShotAttempt[]
}

export interface JobState {
  jobId: string
  createdAt: string
  updatedAt: string
  mode: BudgetMode
  preset: string
  aspect: string
  scriptPath: string
  budgetCapGBP: number
  maxRetriesPerShot: number
  acceptScore: number
  spentUSD: number
  status: 'planning' | 'running' | 'done' | 'budget_exceeded' | 'failed'
  shots: ShotState[]
}

const RUNS_DIR = process.env.RUNS_DIR ?? 'runs'

export function jobDir(jobId: string): string {
  return path.join(RUNS_DIR, jobId)
}

export function newJob(opts: {
  mode: BudgetMode
  preset: string
  aspect: string
  scriptPath: string
  budgetCapGBP: number
  maxRetriesPerShot: number
  acceptScore: number
}): JobState {
  const jobId = `job-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`
  const state: JobState = {
    jobId,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    status: 'planning',
    spentUSD: 0,
    shots: [],
    ...opts,
  }
  fs.mkdirSync(path.join(jobDir(jobId), 'shots'), { recursive: true })
  fs.mkdirSync(path.join(jobDir(jobId), 'refs'), { recursive: true })
  fs.mkdirSync(path.join(jobDir(jobId), 'final'), { recursive: true })
  saveJob(state)
  return state
}

export function saveJob(state: JobState): void {
  state.updatedAt = new Date().toISOString()
  fs.writeFileSync(path.join(jobDir(state.jobId), 'job.json'), JSON.stringify(state, null, 2))
}

export function loadJob(jobId: string): JobState {
  const p = path.join(jobDir(jobId), 'job.json')
  if (!fs.existsSync(p)) throw new Error(`No such job: ${jobId} (looked in ${p})`)
  return JSON.parse(fs.readFileSync(p, 'utf-8')) as JobState
}

export function listJobs(): string[] {
  if (!fs.existsSync(RUNS_DIR)) return []
  return fs.readdirSync(RUNS_DIR).filter(d => fs.existsSync(path.join(RUNS_DIR, d, 'job.json')))
}

/** Total £ guardrail — checked before EVERY generation, not just at the edge. */
export function overBudget(state: JobState, usdToGbp = 0.79): boolean {
  return state.spentUSD * usdToGbp >= state.budgetCapGBP
}
