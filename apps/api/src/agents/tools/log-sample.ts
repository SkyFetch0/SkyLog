import { z } from 'zod'
import path from 'path'
import type { AgentTool, AgentContext, ToolResult } from '../types.js'

const inputSchema = z.object({
  path: z.string().min(1).describe('Absolute path to the log file'),
  count: z
    .number()
    .int()
    .min(1)
    .max(1000)
    .optional()
    .default(100)
    .describe('Number of lines to return (default: 100, max: 1000)'),
  strategy: z
    .enum(['head', 'tail', 'random', 'errors'])
    .default('head')
    .describe(
      '"head" = first N lines, "tail" = last N lines, ' +
      '"random" = evenly distributed sample, ' +
      '"errors" = lines matching error/fail/warn patterns',
    ),
})

type Input = z.infer<typeof inputSchema>

export const logSampleTool: AgentTool<Input> = {
  name: 'log_sample',

  description:
    'Sample lines from a log file using one of four strategies: ' +
    '"head" (first N lines), "tail" (last N lines), "random" (distributed sample), ' +
    'or "errors" (lines containing error/fail/warn keywords). ' +
    'Use log_stats first to understand file size before sampling.',

  inputSchema,

  async execute(input: Input, ctx: AgentContext): Promise<ToolResult> {
    const resolved = path.resolve(input.path)

    const uploadsDir = `/workspace/sessions/${ctx.sessionId}/uploads`
    const agentWorkdir = ctx.sandbox.agentWorkdir(ctx.sessionId, ctx.agentId)

    const allowed =
      resolved.startsWith(uploadsDir + '/') ||
      resolved === uploadsDir ||
      resolved.startsWith(agentWorkdir + '/') ||
      resolved === agentWorkdir

    if (!allowed) {
      return { success: false, output: '', error: `Path '${resolved}' is not in an allowed directory.` }
    }

    const q = JSON.stringify(resolved)
    const n = input.count ?? 100

    let command: string
    switch (input.strategy) {
      case 'head':
        command = `head -n ${n} ${q}`
        break
      case 'tail':
        command = `tail -n ${n} ${q}`
        break
      case 'random': {
        // awk-based reservoir sampling: pick N evenly distributed lines
        const script = `awk 'NR==1{print; next} int(NR % (int(NR/${n})+1))==0{print}' ${q} | head -n ${n}`
        command = `bash -c ${JSON.stringify(script)}`
        break
      }
      case 'errors':
        command = `bash -c ${JSON.stringify(`grep -iE "error|fail|warn|exception|critical" ${q} | head -n ${n}`)}`
        break
    }

    try {
      const { stdout, stderr, exitCode } = await ctx.sandbox.exec(command)

      if (exitCode !== 0 && !stdout) {
        return { success: false, output: '', error: stderr || `Exit code ${exitCode}` }
      }

      const lines = stdout.split('\n').filter(Boolean)

      return {
        success: true,
        output: stdout,
        metadata: { strategy: input.strategy, requestedCount: n, returnedLines: lines.length, path: resolved },
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      return { success: false, output: '', error: `Sample failed: ${message}` }
    }
  },
}