/**
 * 🔄 Tiny job queue — concurrency + retries with backoff, zero deps.
 */
export interface QueueOptions {
  concurrency?: number
  retries?: number
  onLog?: (msg: string) => void
}

interface QueuedJob {
  label: string
  fn: () => Promise<void>
}

export class JobQueue {
  private jobs: QueuedJob[] = []
  private active = 0
  private failures: Array<{ label: string; error: string }> = []

  constructor(private opts: QueueOptions = {}) {}

  add(fn: () => Promise<void>, label = 'job'): void {
    this.jobs.push({ label, fn })
  }

  async wait(): Promise<void> {
    const workers = Array.from({ length: this.opts.concurrency ?? 2 }, () => this.worker())
    await Promise.all(workers)
    if (this.failures.length > 0) {
      console.error(`\n⚠️  ${this.failures.length} job(s) failed:`)
      for (const f of this.failures) console.error(`   ❌ ${f.label}: ${f.error}`)
    }
  }

  private async worker(): Promise<void> {
    while (true) {
      const job = this.jobs.shift()
      if (!job) return
      const retries = this.opts.retries ?? 1
      for (let attempt = 1; attempt <= retries; attempt++) {
        try {
          await job.fn()
          break
        } catch (err: unknown) {
          const message = err instanceof Error ? err.message : String(err)
          if (attempt === retries) {
            this.failures.push({ label: job.label, error: message })
          } else {
            const backoff = attempt * 5000
            this.opts.onLog?.(`↩️  ${job.label} failed (attempt ${attempt}) — retrying in ${backoff / 1000}s: ${message}`)
            await new Promise(r => setTimeout(r, backoff))
          }
        }
      }
    }
  }
}
