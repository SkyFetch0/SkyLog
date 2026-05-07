import { z } from 'zod'
import path from 'path'
import type { AgentTool, AgentContext, ToolResult } from '../types.js'

const inputSchema = z.object({
  path: z.string().min(1).describe('Absolute path to write (must be inside the agent\'s output/ directory)'),
  content: z.string().describe('File content to write'),
})

type Input = z.infer<typeof inputSchema>

export const writeFileTool: AgentTool<Input> = {
  name: 'write_file',

  description:
    'Write content to a file. ' +
    'The file MUST be inside the agent\'s own output/ directory ' +
    '(/workspace/sessions/{sessionId}/agents/{agentId}/output/). ' +
    'Use this to persist analysis results, reports, or structured JSON output.',

  inputSchema,

  async execute(input: Input, ctx: AgentContext): Promise<ToolResult> {
    const resolved = path.resolve(input.path)
    const agentOutputDir = path.join(
      ctx.sandbox.agentWorkdir(ctx.sessionId, ctx.agentId),
      'output',
    )

    const allowed =
      resolved.startsWith(agentOutputDir + '/') || resolved === agentOutputDir

    if (!allowed) {
      return {
        success: false,
        output: '',
        error:
          `Write denied. Path '${resolved}' is outside the agent output directory ` +
          `(${agentOutputDir}). Agents may only write to their own output/ folder.`,
      }
    }

    // Ensure output directory exists then write the file
    const dir = path.dirname(resolved)
    const mkdirScript = `mkdir -p ${JSON.stringify(dir)}`
    const writeScript = `cat > ${JSON.stringify(resolved)} << 'SKYLOG_EOF'\n${input.content}\nSKYLOG_EOF`

    const user = ctx.sandbox.agentUser(ctx.agentId)

    try {
      await ctx.sandbox.exec(`su -s /bin/bash -c ${JSON.stringify(mkdirScript)} ${user}`)

      const { exitCode, stderr } = await ctx.sandbox.exec(
        `su -s /bin/bash -c ${JSON.stringify(writeScript)} ${user}`,
      )

      if (exitCode !== 0) {
        return { success: false, output: '', error: stderr || `Write failed (exit ${exitCode})` }
      }

      const sizeBytes = Buffer.byteLength(input.content, 'utf8')

      return {
        success: true,
        output: `File written: ${resolved} (${sizeBytes} bytes)`,
        metadata: { path: resolved, sizeBytes },
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      return { success: false, output: '', error: `Write failed: ${message}` }
    }
  },
}