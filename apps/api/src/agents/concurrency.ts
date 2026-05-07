export class SubAgentSemaphore {
  private queue: Array<() => void> = []
  private running = 0

  constructor(readonly limit: number = 5) {}

  async acquire(): Promise<void> {
    if (this.running < this.limit) {
      this.running++
      return
    }
    await new Promise<void>((resolve) => this.queue.push(resolve))
    this.running++
  }

  release(): void {
    this.running--
    const next = this.queue.shift()
    if (next) next()
  }

  get activeCount(): number {
    return this.running
  }

  get queueLength(): number {
    return this.queue.length
  }
}

export const globalSubAgentSemaphore = new SubAgentSemaphore(5)