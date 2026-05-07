import type { SandboxManager } from './types.js'
import type { db } from '../db/index.js'

// Placeholder — full implementation in next sprint
export interface SubAgentRunOptions {
  parentRunId: string
  sessionId: string
  role: string
  task: string
  inputFiles: string[]
  outputSchema?: Record<string, unknown>
  db: typeof db
  sandbox: SandboxManager
}

export interface SubAgentResult {
  success: boolean
  agentId: string
  data: unknown
  error?: string
  tokensUsed: number
}

export class AgentRunner {
  async runSubAgent(_options: SubAgentRunOptions): Promise<SubAgentResult> {
    // TODO: implement full agent loop in next sprint
    throw new Error('AgentRunner.runSubAgent not yet implemented')
  }
}