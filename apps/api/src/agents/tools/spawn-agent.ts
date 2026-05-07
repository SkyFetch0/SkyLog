import { z } from 'zod'
import type { AgentTool, AgentContext, ToolResult } from '../types.js'

// Semaphore lives solely in concurrency.ts / runner.ts.
// This tool no longer has its own semaphore to avoid double-throttle / deadlock.

const inputSchema = z.object({
  role: z
    .string()
    .min(1)
    .describe(
      'Role/specialization of the sub-agent, e.g. "apache_security", "mysql_perf", "nginx_errors"',
    ),
  task: z
    .string()
    .min(1)
    .describe('Detailed task description for the sub-agent to perform'),
  inputFiles: z
    .array(z.string())
    .describe('Absolute paths to files the sub-agent should analyze'),
  outputSchema: z
    .record(z.unknown())
    .optional()
    .describe('Expected JSON schema for the sub-agent result (optional)'),
})

type Input = z.infer<typeof inputSchema>

export const spawnAgentTool: AgentTool<Input> = {
  name: 'spawn_agent',

  description:
    'Spawn a specialized sub-agent to perform a focused analysis task. ' +
    'Only the orchestrator may call this. ' +
    'Maximum 5 sub-agents run concurrently (additional calls queue automatically). ' +
    "Returns the sub-agent's structured result as JSON. " +
    'Sub-agents cannot access the internet or spawn further agents.',

  inputSchema,

  async execute(input: Input, ctx: AgentContext): Promise<ToolResult> {
    if (!ctx.isOrchestrator) {
      return {
        success: false,
        output: '',
        error: 'spawn_agent is restricted to the orchestrator agent.',
      }
    }

    try {
      // Dynamic import to break circular dependency at module load time.
      // Concurrency is controlled exclusively by globalSubAgentSemaphore inside runSubAgent().
      const { AgentRunner } = await import('../runner.js')

      const runner = new AgentRunner()
      const result = await runner.runSubAgent({
        parentRunId: ctx.agentId,
        sessionId: ctx.sessionId,
        role: input.role,
        task: input.task,
        inputFiles: input.inputFiles,
        outputSchema: input.outputSchema,
        db: ctx.db,
        sandbox: ctx.sandbox,
      })

      return {
        success: result.success,
        output: JSON.stringify(result.data, null, 2),
        error: result.error,
        metadata: {
          subAgentId: result.agentId,
          role: input.role,
          tokensUsed: result.tokensUsed,
        },
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      return { success: false, output: '', error: `Sub-agent failed: ${message}` }
    }
  },
}