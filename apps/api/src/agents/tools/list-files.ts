import { z } from 'zod'
import path from 'path'
import type { AgentTool, AgentContext, ToolResult } from '../types.js'

const inputSchema = z.object({
  path: z.string().min(1).describe('Absolute path to the directory to list'),
})

type Input = z.infer<typeof inputSchema>

export const listFilesTool: AgentTool<Input> = {
  name: 'list_files',

  description:
    'List files in a directory (ls -la). ' +
    'Permitted paths: agent workdir and session uploads directory. ' +
    'Use this to discover log files before reading or analyzing them.',

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
      return {
        success: false,
        output: '',
        error: `Path '${resolved}' is not in an allowed directory.`,
      }
    }

    try {
      const { stdout, stderr, exitCode } = await ctx.sandbox.exec(
        `ls -la ${JSON.stringify(resolved)}`,
      )

      if (exitCode !== 0) {
        return { success: false, output: '', error: stderr || `ls failed (exit ${exitCode})` }
      }

      return {
        success: true,
        output: stdout,
        metadata: { path: resolved },
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      return { success: false, output: '', error: `List failed: ${message}` }
    }
  },
}