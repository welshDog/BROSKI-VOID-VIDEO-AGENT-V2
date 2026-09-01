/**
 * 🦙 FREE LANE — Wan 2.2 via local ComfyUI (needs GPU: docker compose --profile local up).
 * Workflow JSON lives in polish/comfyui-workflows/wan22-t2v.json (export in API format).
 */
import * as fs from 'node:fs'
import * as path from 'node:path'
import type { Shot } from '../storyboard/shot-planner.js'

const COMFY = process.env.COMFYUI_URL ?? 'http://comfyui:8188'
const WORKFLOW_PATH = process.env.WAN_WORKFLOW_PATH ?? 'polish/comfyui-workflows/wan22-t2v.json'
const PROMPT_NODE = process.env.WAN_PROMPT_NODE ?? '6'

export async function generateWanLocal(shot: Shot, outputDir: string): Promise<string> {
  if (!fs.existsSync(WORKFLOW_PATH)) {
    throw new Error(
      `Wan workflow not found: ${WORKFLOW_PATH} — export yours in ComfyUI API format (see polish/comfyui-workflows/README.md)`,
    )
  }
  const workflow = JSON.parse(fs.readFileSync(WORKFLOW_PATH, 'utf-8')) as Record<string, any>

  // Patch the prompt node with this shot's prompt (set WAN_PROMPT_NODE to match your workflow)
  if (workflow[PROMPT_NODE]?.inputs?.text != null) workflow[PROMPT_NODE].inputs.text = shot.videoPrompt

  const res = await fetch(`${COMFY}/prompt`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ prompt: workflow }),
  })
  if (!res.ok) throw new Error(`ComfyUI ${res.status} — is it running? (docker compose --profile local up comfyui)`)
  const { prompt_id: promptId } = (await res.json()) as { prompt_id: string }
  console.log(`   ⏳ ComfyUI job ${promptId} queued — polling …`)

  for (let i = 0; i < 120; i++) {
    await new Promise(r => setTimeout(r, 5000))
    const hist = (await (await fetch(`${COMFY}/history/${promptId}`)).json()) as Record<string, any>
    const outputs = hist?.[promptId]?.outputs
    if (outputs) {
      for (const node of Object.values<any>(outputs)) {
        const video = node.videos?.[0] ?? node.gifs?.[0]
        if (video) {
          const view = `${COMFY}/view?filename=${encodeURIComponent(video.filename)}&subfolder=${encodeURIComponent(video.subfolder ?? '')}&type=${encodeURIComponent(video.type ?? 'output')}`
          const dest = path.join(outputDir, `scene-${shot.id}-wan.mp4`)
          const body = await (await fetch(view)).arrayBuffer()
          fs.writeFileSync(dest, Buffer.from(body))
          return dest
        }
      }
    }
  }
  throw new Error(`ComfyUI job ${promptId} timed out`)
}
