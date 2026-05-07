import { z } from 'zod'
import type { AgentTool, AgentContext, ToolResult } from '../types.js'

const inputSchema = z.object({
  command: z.string().min(1).describe('Bash command to execute in the sandbox'),
  timeoutMs: z
    .number()
    .int()
    .min(500)
    .max(300_000)
    .optional()
    .default(30_000)
    .describe('Execution timeout in milliseconds (default: 30s, max: 5m)'),
})

type Input = z.infer<typeof inputSchema>

export const bashTool: AgentTool<Input> = {
  name: 'bash_execute',

  description:
    'Execute a bash command inside the isolated sandbox container as the current agent user. ' +
    'Only the orchestrator agent may call this tool. ' +
    'Commands run in the agent-specific workspace directory. ' +
    'Do NOT use for reading log files — prefer read_file or log_grep instead.',

  inputSchema,

  async execute(input: Input, ctx: AgentContext): Promise<ToolResult> {
    if (!ctx.isOrchestrator) {
      return {
        success: false,
        output: '',
        error: 'bash_execute is restricted to the orchestrator agent.',
      }
    }

    const user = ctx.sandbox.agentUser(ctx.agentId)
    const cwd = ctx.sandbox.agentWorkdir(ctx.sessionId, ctx.agentId)

    const wrappedCommand = `su -s /bin/bash -c ${JSON.stringify(input.command)} ${user}`

    try {
      const { stdout, stderr, exitCode } = await ctx.sandbox.exec(wrappedCommand, {
        timeoutMs: input.timeoutMs,
        cwd,
      })

      const combined = [stdout, stderr].filter(Boolean).join('\n')

      return {
        success: exitCode === 0,
        output: combined || '(no output)',
        error: exitCode !== 0 ? `Exit code ${exitCode}` : undefined,
        metadata: { exitCode, cwd, user },
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      return { success: false, output: '', error: `Execution failed: ${message}` }
    }
  },
}