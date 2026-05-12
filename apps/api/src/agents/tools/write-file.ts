import { z } from 'zod'
import path from 'path'
import type { AgentTool, AgentContext, ToolResult } from '../types.js'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

const inputSchema = z.object({
  path: z.string().min(1).describe("Absolute path to write (must be inside the agent's output/ directory)"),
  content: z.string().describe('File content to write'),
})

type Input = z.infer<typeof inputSchema>

export const writeFileTool: AgentTool<Input> = {
  name: 'write_file',

  description:
    'Write content to a file. ' +
    "The file MUST be inside the agent's own output/ directory " +
    '(/workspace/sessions/{sessionId}/agents/{agentId}/output/). ' +
    'Use this to persist analysis results, reports, or structured JSON output.',

  inputSchema,

  async execute(input: Input, ctx: AgentContext): Promise<ToolResult> {
    // Validate IDs to prevent path traversal
    if (!UUID_RE.test(ctx.sessionId) || !UUID_RE.test(ctx.agentId)) {
      return { success: false, output: '', error: 'Invalid session/agent ID format.' }
    }

    const resolved = path.resolve(input.path)
    const agentOutputDir = path.join(
      ctx.sandbox.agentWorkdir(ctx.sessionId, ctx.agentId),
      'output',
    )

    const allowed =
      resolved.startsWith(agentOutputDir + '/') || resolved === agentOutputDir

    if (!allowed) {
      // Models sometimes invent agent IDs that look plausible (e.g. copied
      // from a few-shot example or hallucinated). Tell them exactly which
      // path to use — and remind them to keep just the filename.
      const filename = path.basename(resolved) || 'report.json'
      const suggestion = path.join(agentOutputDir, filename)
      return {
        success: false,
        output: '',
        error:
          `Write denied. Path '${resolved}' is outside YOUR output directory.\n` +
          `Your output directory for this run is:\n  ${agentOutputDir}\n` +
          `Use this exact prefix and only your own agent ID. ` +
          `Suggested path: ${suggestion}`,
      }
    }

    const dir = path.dirname(resolved)
    const mkdirScript = `mkdir -p ${JSON.stringify(dir)}`

    // Use base64 encoding to avoid heredoc injection.
    // If content contains SKYLOG_EOF the heredoc would close prematurely,
    // allowing injected shell commands to run inside the sandbox.
    const b64 = Buffer.from(input.content, 'utf8').toString('base64')
    const writeScript = `echo ${JSON.stringify(b64)} | base64 -d > ${JSON.stringify(resolved)}`

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