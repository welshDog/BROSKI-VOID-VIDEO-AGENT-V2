#!/usr/bin/env node
/**
 * 🎬 V3 Crew CLI — the entry point for the autonomous crew.
 *
 *   npx tsx crew/cli.ts --script workspace/ep1.md --mode CHEAP --character broski --yes
 *   npx tsx crew/cli.ts --resume job-xxxx
 *   npx tsx crew/cli.ts --new-character zed
 *
 * NOTE: the Director LLM (Thread 2) isn't wired yet — this uses V2's scene parser +
 * shot planner as the "director". Swap point is marked below.
 */
import * as fs from 'node:fs'
import { parseArgs } from 'node:util'
import { parseScript } from '../storyboard/scene-parser.js'
import { planShots, loadStylePreset } from '../storyboard/shot-planner.js'
import { runCrew, resumeCrew } from './orchestrator.js'
import { scaffoldCharacter } from './character-bible.js'
import { listJobs } from './state.js'
import type { ShotState } from './state.js'
import type { BudgetMode } from '../agent-router/model-selector.js'

async function main(): Promise<void> {
  const { values: args } = parseArgs({
    options: {
      script: { type: 'string', short: 's' },
      mode: { type: 'string', short: 'm', default: process.env.DEFAULT_MODE ?? 'CHEAP' },
      preset: { type: 'string', short: 'p', default: 'hyperfocus-zone' },
      aspect: { type: 'string', short: 'a', default: '9:16' },
      character: { type: 'string', short: 'c' },   // cast every shot with this character id
      resume: { type: 'string', short: 'r' },
      'new-character': { type: 'string' },
      jobs: { type: 'boolean', default: false },
      yes: { type: 'boolean', default: false },
      help: { type: 'boolean', default: false },
    },
  })

  if (args.help) return printUsage()
  if (args['new-character']) return scaffoldCharacter(args['new-character'])
  if (args.jobs) return console.log('📁 Jobs:\n  ' + (listJobs().join('\n  ') || '(none yet)'))

  const opts = {
    mode: String(args.mode).toUpperCase() as BudgetMode,
    preset: String(args.preset),
    aspect: String(args.aspect),
    scriptPath: String(args.script ?? ''),
  }

  // ── Resume path ──
  if (args.resume) return void (await resumeCrew(String(args.resume), opts))

  if (!args.script) return printUsage()
  const raw = fs.readFileSync(String(args.script), 'utf-8')

  // ── DIRECT (currently V2 parser — swap for Director LLM, Thread 2) ──
  const preset = loadStylePreset(String(args.preset))
  const planned = planShots(parseScript(raw), preset, String(args.aspect))
  const castIds = args.character ? [String(args.character)] : []

  const shots: ShotState[] = planned.map(p => ({
    id: p.id,
    type: p.type,
    heading: p.heading,
    prompt: p.videoPrompt,
    negativePrompt: p.negativePrompt,
    durationSec: p.durationSec,
    castIds,
    continuityFrom: null,   // ← Thread 5 wires last-frame chaining here
    status: 'planned',
    attempts: [],
  }))

  console.log(`\n🎬 V3 Crew — ${shots.length} shot(s) | mode ${opts.mode} | cast: ${castIds.join(', ') || 'none'}`)
  if (!args.yes) {
    console.log('👀 Dry run. Add --yes to let the crew spend.\n')
    return
  }

  await runCrew(shots, opts)
}

function printUsage(): void {
  console.log(`
🎬 V3 Crew CLI

  --script <file> --mode <MODE> [--character <id>] [--yes]   run a script through the crew
  --resume <jobId>                                           resume a paused/crashed run
  --new-character <id>                                       scaffold a character bible
  --jobs                                                     list all runs

Modes: FREE | CHEAP | QUALITY | PRO
Env guardrails: MAX_COST_GBP · MAX_RETRIES_PER_SHOT · ACCEPT_SCORE · CRITIC_* (see crew/README.md)
`)
}

main().catch(err => { console.error('❌', err?.message ?? err); process.exit(1) })
