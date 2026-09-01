#!/usr/bin/env node
/**
 * 🧠 BROski Void Video Agent V2 — Orchestrator
 *
 * Pipeline: Script → Storyboard → Model Router → Generate → Avatar → Polish → Publish
 *
 * Usage:
 *   npx tsx agent-router/index.ts --script workspace/my-script.md --mode CHEAP --yes
 */
import * as fs from 'node:fs'
import * as path from 'node:path'
import { parseArgs } from 'node:util'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { parseScript } from '../storyboard/scene-parser.js'
import { planShots, loadStylePreset, type Shot } from '../storyboard/shot-planner.js'
import { selectModel, estimateJobCost, MODEL_CATALOG, type BudgetMode, type ModelId } from './model-selector.js'
import { JobQueue } from './job-queue.js'
import { muapiGenerate, muapiWait, muapiDownload } from '../generators/muapi-client.js'
import { buildSeedancePayload } from '../generators/seedance.js'
import { buildKlingPayload } from '../generators/kling.js'
import { buildVeoPayload } from '../generators/veo.js'
import { generateWanLocal } from '../generators/wan-local.js'

const execFileAsync = promisify(execFile)
const OUTPUT_DIR = process.env.OUTPUT_DIR ?? './output'

interface ClipResult {
  sceneId: number
  model: ModelId
  file: string
  costUSD: number
  durationSec: number
}

function printUsage(): void {
  console.log(`
🎬 BROski Void Video Agent V2

  npx tsx agent-router/index.ts --script <file> [--mode FREE|CHEAP|QUALITY|PRO] [--preset NAME] [--aspect 9:16|16:9|1:1] [--yes]

Examples:
  ./scripts/make-video.sh workspace/episode-1.md --mode CHEAP
  ./scripts/make-video.sh "neon dragon flying over Nexus City" --mode QUALITY
`)
}

async function main(): Promise<void> {
  const { values: args } = parseArgs({
    options: {
      script: { type: 'string', short: 's' },
      mode: { type: 'string', short: 'm', default: process.env.DEFAULT_MODE ?? 'CHEAP' },
      preset: { type: 'string', short: 'p', default: 'hyperfocus-zone' },
      aspect: { type: 'string', short: 'a', default: '9:16' },
      yes: { type: 'boolean', default: false },
      help: { type: 'boolean', default: false },
    },
  })

  if (args.help || !args.script) {
    printUsage()
    return
  }

  const mode = String(args.mode).toUpperCase() as BudgetMode
  const raw = fs.readFileSync(args.script, 'utf-8')
  console.log(`\n🎬 BROski Void Video Agent V2 — mode: ${mode} | preset: ${args.preset} | aspect: ${args.aspect}\n`)

  // ── Stage 1 + 2: Storyboard ────────────────────────
  const preset = loadStylePreset(String(args.preset))
  const scenes = parseScript(raw)
  const shots = planShots(scenes, preset, String(args.aspect))
  console.log(`📝 Parsed ${shots.length} scene(s):`)
  for (const s of shots) console.log(`   ${s.id}. [${s.type}] ${s.durationSec}s — ${s.heading}`)

  // ── Stage 3: Model routing + cost plan ─────────────
  const plan = shots.map(shot => ({ shot, model: selectModel(shot.type, mode) }))
  const { perScene, total } = estimateJobCost(shots, mode)
  console.log(`\n🧠 Model plan:`)
  for (const item of plan) {
    const m = MODEL_CATALOG[item.model]
    const price = m.pricePerSecUSD ? ` @ $${m.pricePerSecUSD}/s` : ''
    console.log(`   Scene ${item.shot.id}: ${m.label} (${m.provider})${price}`)
  }
  console.log(`\n💰 Estimated cost: $${total.toFixed(2)} (${mode} mode)\n`)

  if (!args.yes) {
    console.log('👀 Dry run only — add --yes to execute this plan.')
    return
  }

  fs.mkdirSync(OUTPUT_DIR, { recursive: true })
  const results: ClipResult[] = []
  const queue = new JobQueue({ concurrency: 2, retries: 2, onLog: msg => console.log(`   ${msg}`) })

  for (const item of plan) {
    queue.add(async () => {
      const t0 = Date.now()
      const file = await renderScene(item.model, item.shot)
      results.push({
        sceneId: item.shot.id,
        model: item.model,
        file,
        costUSD: perScene[item.shot.id] ?? 0,
        durationSec: item.shot.durationSec,
      })
      console.log(`   ✅ Scene ${item.shot.id} done in ${((Date.now() - t0) / 1000).toFixed(0)}s → ${path.basename(file)}`)
    }, `scene-${item.shot.id}`)
  }
  await queue.wait()

  if (results.length === 0) {
    console.error('\n❌ All scenes failed — check the errors above.')
    process.exit(1)
  }

  // ── Stage 6: Publish (multi-format) ────────────────
  console.log(`\n📤 Exporting ${results.length} clip(s) to 9:16 / 16:9 / 1:1 …`)
  for (const r of results) {
    await execFileAsync('bash', ['publisher/ffmpeg-crop.sh', r.file, OUTPUT_DIR, 'all'])
  }

  // ── Manifest ───────────────────────────────────────
  const manifest = {
    createdAt: new Date().toISOString(),
    mode,
    preset: String(args.preset),
    totalCostUSD: total,
    clips: results,
  }
  fs.writeFileSync(path.join(OUTPUT_DIR, 'manifest.json'), JSON.stringify(manifest, null, 2))
  console.log(`\n🎉 DONE BROski! ${results.length} clips × 3 formats → ${OUTPUT_DIR}/`)
  console.log(`   Manifest: ${path.join(OUTPUT_DIR, 'manifest.json')}\n`)
}

async function renderScene(model: ModelId, shot: Shot): Promise<string> {
  // 🗣️ Avatar lane
  if (model === 'heygen' || model === 'musetalk-local') {
    if (model === 'musetalk-local') console.log('   ⚠️  MuseTalk local not wired yet — using HeyGen instead (see avatar/)')
    return runAvatar(shot.id, shot.dialogue ?? shot.description)
  }

  // 🦙 FREE local lane
  if (model === 'wan-local') return generateWanLocal(shot, OUTPUT_DIR)

  // ☁️ Cloud lane via MuAPI — one key, any model
  const built =
    model.startsWith('seedance')
      ? buildSeedancePayload(model as 'seedance-2.0-mini' | 'seedance-2.5', shot)
      : model.startsWith('kling')
        ? buildKlingPayload(shot)
        : buildVeoPayload(model as 'veo-3.1-lite' | 'veo-3.1-fast' | 'veo-3.1-quality', shot)

  const taskId = await muapiGenerate(built.endpoint, built.payload)
  console.log(`   ⏳ Task ${taskId} submitted — polling …`)
  const url = await muapiWait(taskId)
  const dest = path.join(OUTPUT_DIR, `scene-${shot.id}-${model}.mp4`)
  await muapiDownload(url, dest)
  return dest
}

async function runAvatar(sceneId: number, text: string): Promise<string> {
  const dest = path.join(OUTPUT_DIR, `scene-${sceneId}-heygen.mp4`)
  await execFileAsync('python3', ['avatar/heygen-client.py', '--text', text, '--out', dest])
  return dest
}

main().catch(err => {
  console.error('❌ Pipeline failed:', err?.message ?? err)
  process.exit(1)
})
