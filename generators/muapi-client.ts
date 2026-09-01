/**
 * 🔑 ONE KEY TO RULE THEM ALL — unified MuAPI client (Seedance / Veo / Kling / PixVerse / Vidu).
 *
 * NOTE: MuAPI endpoint paths and response shapes differ slightly per model and evolve
 * fast — verify each one in the docs playground before your first cloud run:
 * https://muapi.ai/docs/video-generation
 * Adjust MODEL_ENDPOINTS below if a path has changed.
 */
import * as fs from 'node:fs'
import * as path from 'node:path'

const BASE = process.env.MUAPI_BASE_URL ?? 'https://api.muapi.ai/v1'
const KEY = process.env.MUAPI_KEY ?? ''

export const MODEL_ENDPOINTS: Record<string, string> = {
  'seedance-2.0-mini': '/video/seedance-2.0-mini',
  'seedance-2.5': '/video/seedance-2.5',
  'kling-3.0': '/video/kling-v3',
  'veo-3.1-lite': '/video/veo-3.1-lite',
  'veo-3.1-fast': '/video/veo-3.1-fast',
  'veo-3.1-quality': '/video/veo-3.1-quality',
  'pixverse-v6': '/video/pixverse-v6',
  'vidu-q3': '/video/vidu-q3',
}

async function authFetch(url: string, init: RequestInit = {}): Promise<any> {
  if (!KEY) throw new Error('MUAPI_KEY is not set — copy .env.example to .env and fill it in')
  const res = await fetch(url, {
    ...init,
    headers: { Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json', ...(init.headers ?? {}) },
  })
  const text = await res.text()
  if (!res.ok) throw new Error(`MuAPI ${res.status}: ${text.slice(0, 300)}`)
  return JSON.parse(text)
}

export async function muapiGenerate(endpoint: string, payload: unknown): Promise<string> {
  const data = await authFetch(`${BASE}${endpoint}`, { method: 'POST', body: JSON.stringify(payload) })
  const taskId = data.task_id ?? data.id ?? data?.data?.task_id
  if (!taskId) throw new Error(`MuAPI returned no task id: ${JSON.stringify(data).slice(0, 200)}`)
  return String(taskId)
}

export async function muapiWait(taskId: string, timeoutMs = 10 * 60_000): Promise<string> {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    const data = await authFetch(`${BASE}/tasks/${taskId}`)
    const status = String(data.status ?? data?.data?.status ?? '').toLowerCase()

    if (status === 'succeeded' || status === 'completed') {
      const url = data.output?.video_url ?? data?.data?.output?.video_url ?? data.output?.url
      if (!url) throw new Error(`Task ${taskId} finished but no video url: ${JSON.stringify(data).slice(0, 200)}`)
      return String(url)
    }
    if (status === 'failed' || status === 'error') {
      throw new Error(`Task ${taskId} failed: ${JSON.stringify(data).slice(0, 300)}`)
    }
    await new Promise(r => setTimeout(r, 5000))
  }
  throw new Error(`Task ${taskId} timed out after ${timeoutMs / 1000}s`)
}

export async function muapiDownload(url: string, dest: string): Promise<void> {
  fs.mkdirSync(path.dirname(dest), { recursive: true })
  const res = await fetch(url)
  if (!res.ok) throw new Error(`Download failed ${res.status}: ${url}`)
  fs.writeFileSync(dest, Buffer.from(await res.arrayBuffer()))
}
