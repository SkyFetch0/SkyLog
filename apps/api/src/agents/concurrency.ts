export class SubAgentSemaphore {
  private queue: Array<() => void> = []
  private running = 0

  constructor(readonly limit: number = 5) {}

  async acquire(): Promise<void> {
    if (this.running < this.limit) {
      this.running++
      return
    }
    // Wait in queue — running is NOT incremented here; release() handles it.
    await new Promise<void>((resolve) => this.queue.push(resolve))
  }

  release(): void {
    const next = this.queue.shift()
    if (next) {
      // Hand the slot directly to the next waiter; running count stays the same.
      next()
    } else {
      this.running--
    }
  }

  get activeCount(): number {
    return this.running
  }

  get queueLength(): number {
    return this.queue.length
  }
}

export const globalSubAgentSemaphore = new SubAgentSemaphore(5)