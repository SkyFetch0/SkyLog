import { z } from 'zod'
import path from 'path'
import type { AgentTool, AgentContext, ToolResult } from '../types.js'

const inputSchema = z.object({
  path: z.string().min(1).describe('Absolute path to the log file'),
})

type Input = z.infer<typeof inputSchema>

type LogFormat = 'apache' | 'nginx' | 'json' | 'syslog' | 'unknown'

function detectFormat(sample: string): LogFormat {
  if (/^\s*\{/.test(sample)) return 'json'
  if (/\d+\.\d+\.\d+\.\d+.*\[.*\].*"(GET|POST|PUT|DELETE|HEAD|OPTIONS)/.test(sample)) return 'apache'
  if (/\d+\.\d+\.\d+\.\d+.*"(GET|POST|PUT|DELETE|HEAD|OPTIONS).*HTTP/.test(sample)) return 'nginx'
  if (/^[A-Z][a-z]{2}\s+\d+\s+\d{2}:\d{2}:\d{2}/.test(sample)) return 'syslog'
  return 'unknown'
}

export const logStatsTool: AgentTool<Input> = {
  name: 'log_stats',

  description:
    'Return statistics about a log file: line count, file size, first/last lines, and detected format ' +
    '(apache, nginx, json, syslog, or unknown). Use this before sampling or grepping to understand the file.',

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

    const script = [
      `LINES=$(wc -l < ${JSON.stringify(resolved)} 2>/dev/null || echo 0)`,
      `SIZE=$(wc -c < ${JSON.stringify(resolved)} 2>/dev/null || echo 0)`,
      `FIRST=$(head -1 ${JSON.stringify(resolved)} 2>/dev/null || echo '')`,
      `LAST=$(tail -1 ${JSON.stringify(resolved)} 2>/dev/null || echo '')`,
      `echo "LINES=$LINES"`,
      `echo "SIZE=$SIZE"`,
      `echo "FIRST=$FIRST"`,
      `echo "LAST=$LAST"`,
    ].join('\n')

    try {
      const { stdout, exitCode } = await ctx.sandbox.exec(`bash -c ${JSON.stringify(script)}`)

      if (exitCode !== 0) {
        return { success: false, output: '', error: `Stats command failed (exit ${exitCode})` }
      }

      const get = (key: string) => {
        const match = stdout.match(new RegExp(`^${key}=(.*)$`, 'm'))
        return match ? match[1].trim() : ''
      }

      const firstLine = get('FIRST')
      const format = detectFormat(firstLine)

      const stats = {
        lineCount: parseInt(get('LINES') || '0', 10),
        sizeBytes: parseInt(get('SIZE') || '0', 10),
        firstLine,
        lastLine: get('LAST'),
        detectedFormat: format,
        path: resolved,
      }

      return {
        success: true,
        output: JSON.stringify(stats, null, 2),
        metadata: stats,
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      return { success: false, output: '', error: `Stats failed: ${message}` }
    }
  },
}