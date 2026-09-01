#!/usr/bin/env node
/**
 * 🎬 V3 Crew CLI — the entry point for the autonomous crew.
 *
 *   npx tsx crew/cli.ts --script workspace/ep1.md --mode CHEAP --character broski --yes
 *   npx tsx crew/cli.ts --resume job-xxxx
 *   npx tsx crew/cli.ts --new-character zed
 */
import * as fs from 'node:fs'
import { parseArgs } from 'node:util'
import { runCrew, resumeCrew } from './orchestrator.js'
import { scaffoldCharacter } from './character-bible.js'
import { listJobs } from './state.js'
import { directScript } from './director.js'
import type { BudgetMode } from '../agent-router/model-selector.js'

async function main(): Promise<void> {
  const { values: args } = parseArgs({
    options: {
      script: { type: 'string', short: 's' },
      mode: { type: 'string', short: 'm', default: process.env.DEFAULT_MODE ?? 'CHEAP' },
      preset: { type: 'string', short: 'p', default: 'hyperfocus-zone' },
      aspect: { type: 'string', short: 'a', default: '9:16' },
      character: { type: 'string', short: 'c' },
      resume: { type: 'string', short: 'r' },
      'new-character': { type: 'string' },
      jobs: { type: 'boolean', default: false },
      yes: { type: 'boolean', default: false },
      help: { type: 'boolean', default: false },
    },
  })

  if (args.help) return printUsage()
  if (args['new-character']) return scaffoldCharacter(args['new-character'])
  if (args.jobs) return console.log('   ' + (listJobs().join('\n  ') || '(none yet)'))

  const opts = {
    mode: String(args.mode).toUpperCase() as BudgetMode,
    preset: String(args.preset),
    aspect: String(args.aspect),
    scriptPath: String(args.script ?? ''),
  }

  if (args.resume) return void (await resumeCrew(String(args.resume), opts))

  if (!args.script) return printUsage()
  const raw = fs.readFileSync(String(args.script), 'utf-8')
  const castIds = args.character ? [String(args.character)] : []

  const shots = await directScript(raw, {
    preset: String(args.preset),
    aspect: String(args.aspect),
    defaultCast: castIds,
  })

  console.log(`\n🎬 V3 Crew — ${shots.length} shot(s) | mode ${opts.mode} | cast: ${castIds.join(', ') || 'none'}`)
  for (const s of shots) {
    const link = s.continuityFrom ? ` ← chains from ${s.continuityFrom}` : ''
    console.log(`   ${s.id}. [${s.type}] ${s.durationSec}s ${s.heading}${link}`)
  }
  if (!args.yes) {
    console.log('\n👀 Dry run. Add --yes to let the crew spend.\n')
    return
  }

  await runCrew(shots, opts)
}

function printUsage(): void {
  console.log(`\n🎬 V3 Crew CLI\n\n  --script <file> --mode <MODE> [--character <id>] [--yes]\n  --resume <jobId>\n  --new-character <id>\n  --jobs\n\nTry: npx tsx crew/cli.ts --script workspace/ep1.md --character broski\n`)
}

main().catch(err => { console.error('❌', err?.message ?? err); process.exit(1) })
