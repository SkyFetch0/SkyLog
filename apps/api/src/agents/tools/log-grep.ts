import { z } from 'zod'
import path from 'path'
import type { AgentTool, AgentContext, ToolResult } from '../types.js'

const inputSchema = z.object({
  path: z.string().min(1).describe('Absolute path to the log file'),
  pattern: z.string().min(1).describe('Regex pattern to search for (ripgrep syntax)'),
  contextLines: z
    .number()
    .int()
    .min(0)
    .max(20)
    .optional()
    .default(2)
    .describe('Number of context lines to show before and after each match (default: 2)'),
  maxMatches: z
    .number()
    .int()
    .min(1)
    .max(1000)
    .optional()
    .default(100)
    .describe('Maximum number of matches to return (default: 100)'),
})

type Input = z.infer<typeof inputSchema>

export const logGrepTool: AgentTool<Input> = {
  name: 'log_grep',

  description:
    'Search a log file for lines matching a regex pattern using ripgrep (rg). ' +
    'Returns matching lines with optional context. ' +
    'Use for targeted searches: specific IP, error code, user ID, time range, etc. ' +
    'Prefer this over bash_execute for log searching.',

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

    const contextLines = input.contextLines ?? 2
    const maxMatches = input.maxMatches ?? 100

    const rgCmd = [
      'rg',
      '--no-heading',
      '--line-number',
      '--color=never',
      `-C ${contextLines}`,
      `-m ${maxMatches}`,
      `-e ${JSON.stringify(input.pattern)}`,
      JSON.stringify(resolved),
    ].join(' ')

    try {
      const { stdout, stderr, exitCode } = await ctx.sandbox.exec(rgCmd)

      // rg exits 1 when no matches found — not an error
      if (exitCode === 2) {
        return { success: false, output: '', error: `ripgrep error: ${stderr}` }
      }

      const matchCount = stdout.split('\n').filter((l) => /^\d+:/.test(l)).length

      return {
        success: true,
        output: stdout || '(no matches found)',
        metadata: {
          pattern: input.pattern,
          matchCount,
          contextLines,
          maxMatches,
          path: resolved,
          noMatches: exitCode === 1,
        },
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      return { success: false, output: '', error: `Grep failed: ${message}` }
    }
  },
}