/**
 * 🧠 The Orchestrator — the crew loop as an explicit finite-state machine (Thread 1).
 *
 * Per shot:  planned → generating → critiquing → (accepted | rejected→retry | exhausted)
 *
 * Guardrails in the CORE LOOP:
 *   - MAX_RETRIES_PER_SHOT
 *   - MAX_COST_GBP checked before EVERY generation
 *   - ACCEPT_SCORE
 *
 * On accept: extract last frame so the next chained shot can lock identity (Thread 5).
 */
import * as path from 'node:path'
import type { BudgetMode } from '../agent-router/model-selector.js'
import { selectModel, MODEL_CATALOG } from '../agent-router/model-selector.js'
import {
  newJob, saveJob, overBudget, jobDir,
  type JobState, type ShotState,
} from './state.js'
import { critique } from './critic.js'
import { buildShotContext } from './character-bible.js'
import { renderShot } from './render-bridge.js'
import { extractLastFrame } from './continuity.js'

export interface CrewOptions {
  mode: BudgetMode
  preset: string
  aspect: string
  scriptPath: string
  budgetCapGBP?: number
  maxRetriesPerShot?: number
  acceptScore?: number
}

export async function runCrew(shots: ShotState[], opts: CrewOptions): Promise<JobState> {
  const state = newJob({
    mode: opts.mode,
    preset: opts.preset,
    aspect: opts.aspect,
    scriptPath: opts.scriptPath,
    budgetCapGBP: opts.budgetCapGBP ?? Number(process.env.MAX_COST_GBP ?? 2.0),
    maxRetriesPerShot: opts.maxRetriesPerShot ?? Number(process.env.MAX_RETRIES_PER_SHOT ?? 3),
    acceptScore: opts.acceptScore ?? Number(process.env.ACCEPT_SCORE ?? 7.0),
  })
  state.shots = shots
  state.status = 'running'
  saveJob(state)

  console.log(`\n🧠 Crew started — job ${state.jobId} | mode ${opts.mode} | cap £${state.budgetCapGBP} | accept ≥ ${state.acceptScore}\n`)

  for (const shot of state.shots) {
    await runShotFSM(state, shot)
    if (state.status === 'budget_exceeded') {
      console.error(`\n💸 Budget cap hit (£${state.budgetCapGBP}) — resume later: npx tsx crew/cli.ts --resume ${state.jobId}`)
      saveJob(state)
      return state
    }
  }

  state.status = state.shots.every(s => s.status === 'done' || s.status === 'accepted') ? 'done' : 'failed'
  saveJob(state)
  const accepted = state.shots.filter(s => s.status === 'accepted' || s.status === 'done').length
  console.log(`\n🎬 Crew finished — ${accepted}/${state.shots.length} shots accepted · spent $${state.spentUSD.toFixed(3)} · job ${state.jobId}`)
  return state
}

async function runShotFSM(state: JobState, shot: ShotState): Promise<void> {
  shot.status = 'planned'
  saveJob(state)
  let prevNotes: string | undefined

  const prev = shot.continuityFrom != null ? state.shots.find(s => s.id === shot.continuityFrom) : undefined
  const firstFramePath = prev?.lastFramePath ?? undefined
  if (firstFramePath) console.log(`   🔗 Shot ${shot.id} chains from ${prev?.id} via ${path.basename(firstFramePath)}`)

  while (true) {
    if (overBudget(state)) { state.status = 'budget_exceeded'; saveJob(state); return }

    if (shot.attempts.length >= state.maxRetriesPerShot) {
      shot.status = 'exhausted'
      saveJob(state)
      console.log(`   ⚠️  Shot ${shot.id} exhausted ${state.maxRetriesPerShot} attempts — needs human review`)
      return
    }

    shot.status = 'generating'
    saveJob(state)
    const attemptNo = shot.attempts.length + 1
    const model = selectModel(shot.type, state.mode)
    const modelLabel = MODEL_CATALOG[model]?.label ?? model
    console.log(`   🎬 Shot ${shot.id} [${shot.type}] attempt ${attemptNo}/${state.maxRetriesPerShot} → ${modelLabel}`)

    const ctx = buildShotContext(shot.prompt, shot.castIds, shot.type)

    let file: string | null = null
    let cost = 0
    const seed = Math.floor(Math.random() * 1_000_000)
    try {
      const out = await renderShot({
        model,
        shot,
        prompt: ctx.prompt,
        referenceImages: ctx.referenceImages,
        firstFramePath,
        seed,
        prevNotes,
        outDir: path.join(jobDir(state.jobId), 'shots'),
      })
      file = out.file; cost = out.costUSD
    } catch (err: unknown) {
      console.log(`      ❌ generate failed: ${err instanceof Error ? err.message : err}`)
    }
    state.spentUSD += cost
    shot.attempts.push({ attempt: attemptNo, prompt: ctx.prompt, model, seed, file, costUSD: cost })
    saveJob(state)

    if (!file) { prevNotes = 'generation call failed'; continue }

    shot.status = 'critiquing'
    saveJob(state)
    const verdict = await critique(file, shot, state.acceptScore, prevNotes)
    state.spentUSD += verdict.costUSD
    shot.attempts[shot.attempts.length - 1]!.verdict = verdict
    saveJob(state)
    console.log(`      👁️  Critic ${verdict.score}/10 — ${verdict.accepted ? '✅ accepted' : `↩️  rejected: ${verdict.notes}`}`)

    if (verdict.accepted) {
      shot.status = 'accepted'
      try {
        shot.lastFramePath = await extractLastFrame(
          file,
          path.join(jobDir(state.jobId), 'shots', `shot-${shot.id}-last.png`),
        )
      } catch (err: unknown) {
        console.log(`      ⚠️  last-frame extract skipped: ${err instanceof Error ? err.message : err}`)
      }
      saveJob(state)
      return
    }
    shot.status = 'rejected'
    prevNotes = verdict.notes
    saveJob(state)
  }
}

export async function resumeCrew(jobId: string, opts: CrewOptions): Promise<JobState> {
  const { loadJob } = await import('./state.js')
  const state = loadJob(jobId)
  console.log(`\n⏯️  Resuming ${jobId} — ${state.shots.filter(s => s.status === 'accepted' || s.status === 'done').length}/${state.shots.length} already done`)
  state.status = 'running'
  saveJob(state)
  for (const shot of state.shots) {
    if (shot.status === 'accepted' || shot.status === 'done') continue
    await runShotFSM(state, shot)
    if (state.status === 'budget_exceeded') return state
  }
  state.status = 'done'
  saveJob(state)
  return state
}
