/**
 * 🧠 The Model Router — picks the best model per scene type + budget mode.
 *
 * Pricing + max-duration numbers load from ../config/pricing.json (the single source
 * of truth — README tables are kept in sync with it by hand). Those rates are
 * UNVERIFIED against the live MuAPI docs and drift often — re-check before a paid run.
 *
 * The routing table below is plain data — edit it to match your taste.
 */
import * as fs from 'node:fs'
import * as path from 'node:path'
import { fileURLToPath } from 'node:url'

interface PricingFile {
  gbpPerUsd: number
  lastVerified: string
  models: Record<string, { usdPerSec: number | null; maxDurationSec: number }>
}

const PRICING_PATH = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'config', 'pricing.json')

let PRICING: PricingFile
try {
  PRICING = JSON.parse(fs.readFileSync(PRICING_PATH, 'utf-8')) as PricingFile
} catch {
  console.warn('⚠️  config/pricing.json missing or invalid — cost estimates fall back to $0')
  PRICING = { gbpPerUsd: 0.79, lastVerified: 'unknown', models: {} }
}

/** GBP per USD — for anywhere that shows £ estimates. */
export const GBP_PER_USD = PRICING.gbpPerUsd
/** When the pricing.json rates were last checked against muapi.ai. */
export const PRICING_LAST_VERIFIED = PRICING.lastVerified

const usdPerSec = (id: string): number | null => PRICING.models[id]?.usdPerSec ?? null
const maxDur = (id: string, fallback: number): number => PRICING.models[id]?.maxDurationSec ?? fallback

export type BudgetMode = 'FREE' | 'CHEAP' | 'QUALITY' | 'PRO'
export type SceneType = 'cinematic' | 'anime' | 'talking_head' | 'b_roll' | 'title_card'
export type ModelId =
  | 'wan-local'
  | 'musetalk-local'
  | 'seedance-2.0-mini'
  | 'pixverse-v6'
  | 'vidu-q3'
  | 'veo-3.1-lite'
  | 'veo-3.1-fast'
  | 'kling-3.0'
  | 'seedance-2.5'
  | 'veo-3.1-quality'
  | 'heygen'

export interface ModelInfo {
  label: string
  provider: 'local' | 'muapi' | 'heygen'
  pricePerSecUSD: number | null
  maxDurationSec: number
}

// Structure (label / provider) lives here; the two numeric fields come from config/pricing.json.
export const MODEL_CATALOG: Record<ModelId, ModelInfo> = {
  'wan-local': { label: 'Wan 2.2 (local ComfyUI)', provider: 'local', pricePerSecUSD: usdPerSec('wan-local') ?? 0, maxDurationSec: maxDur('wan-local', 5) },
  'musetalk-local': { label: 'MuseTalk (local)', provider: 'local', pricePerSecUSD: usdPerSec('musetalk-local') ?? 0, maxDurationSec: maxDur('musetalk-local', 60) },
  'seedance-2.0-mini': { label: 'Seedance 2.0 Mini', provider: 'muapi', pricePerSecUSD: usdPerSec('seedance-2.0-mini'), maxDurationSec: maxDur('seedance-2.0-mini', 10) },
  'pixverse-v6': { label: 'PixVerse V6', provider: 'muapi', pricePerSecUSD: usdPerSec('pixverse-v6'), maxDurationSec: maxDur('pixverse-v6', 8) },
  'vidu-q3': { label: 'Vidu Q3', provider: 'muapi', pricePerSecUSD: usdPerSec('vidu-q3'), maxDurationSec: maxDur('vidu-q3', 8) },
  'veo-3.1-lite': { label: 'Veo 3.1 Lite', provider: 'muapi', pricePerSecUSD: usdPerSec('veo-3.1-lite'), maxDurationSec: maxDur('veo-3.1-lite', 8) },
  'veo-3.1-fast': { label: 'Veo 3.1 Fast', provider: 'muapi', pricePerSecUSD: usdPerSec('veo-3.1-fast'), maxDurationSec: maxDur('veo-3.1-fast', 8) },
  'kling-3.0': { label: 'Kling 3.0', provider: 'muapi', pricePerSecUSD: usdPerSec('kling-3.0'), maxDurationSec: maxDur('kling-3.0', 10) },
  'seedance-2.5': { label: 'Seedance 2.5', provider: 'muapi', pricePerSecUSD: usdPerSec('seedance-2.5'), maxDurationSec: maxDur('seedance-2.5', 30) },
  'veo-3.1-quality': { label: 'Veo 3.1 Quality', provider: 'muapi', pricePerSecUSD: usdPerSec('veo-3.1-quality'), maxDurationSec: maxDur('veo-3.1-quality', 8) },
  heygen: { label: 'HeyGen Avatar', provider: 'heygen', pricePerSecUSD: usdPerSec('heygen'), maxDurationSec: maxDur('heygen', 300) },
}

const ROUTING: Record<BudgetMode, Record<SceneType, ModelId>> = {
  FREE: {
    cinematic: 'wan-local',
    anime: 'wan-local',
    talking_head: 'musetalk-local',
    b_roll: 'wan-local',
    title_card: 'wan-local',
  },
  CHEAP: {
    cinematic: 'seedance-2.0-mini',
    anime: 'vidu-q3',
    talking_head: 'heygen',
    b_roll: 'pixverse-v6',
    title_card: 'pixverse-v6',
  },
  QUALITY: {
    cinematic: 'veo-3.1-fast',
    anime: 'seedance-2.5',
    talking_head: 'heygen',
    b_roll: 'kling-3.0',
    title_card: 'veo-3.1-lite',
  },
  PRO: {
    cinematic: 'seedance-2.5',
    anime: 'seedance-2.5',
    talking_head: 'heygen',
    b_roll: 'kling-3.0',
    title_card: 'veo-3.1-fast',
  },
}

export function selectModel(sceneType: SceneType, mode: BudgetMode): ModelId {
  const table = ROUTING[mode] ?? ROUTING.CHEAP
  return table[sceneType] ?? table.cinematic
}

export function estimateSceneCost(sceneType: SceneType, durationSec: number, mode: BudgetMode): number {
  const info = MODEL_CATALOG[selectModel(sceneType, mode)]
  if (info.pricePerSecUSD == null || info.pricePerSecUSD === 0) return 0
  return Math.min(durationSec, info.maxDurationSec) * info.pricePerSecUSD
}

export function estimateJobCost(
  shots: Array<{ id: number; type: SceneType; durationSec: number }>,
  mode: BudgetMode,
): { perScene: Record<number, number>; total: number } {
  const perScene: Record<number, number> = {}
  let total = 0
  for (const s of shots) {
    const cost = estimateSceneCost(s.type, s.durationSec, mode)
    perScene[s.id] = cost
    total += cost
  }
  return { perScene, total }
}
