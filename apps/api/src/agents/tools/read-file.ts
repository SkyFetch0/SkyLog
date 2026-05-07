import { z } from 'zod'
import path from 'path'
import type { AgentTool, AgentContext, ToolResult, PathValidationResult } from '../types.js'

const inputSchema = z.object({
  path: z.string().min(1).describe('Absolute path to the file to read'),
  startLine: z.number().int().positive().optional().describe('First line to read (1-indexed)'),
  endLine: z.number().int().positive().optional().describe('Last line to read (inclusive)'),
})

type Input = z.infer<typeof inputSchema>

function validateReadPath(filePath: string, ctx: AgentContext): PathValidationResult {
  const resolved = path.resolve(filePath)

  const agentWorkdir = ctx.sandbox.agentWorkdir(ctx.sessionId, ctx.agentId)
  const uploadsDir = `/workspace/sessions/${ctx.sessionId}/uploads`

  const allowed =
    resolved.startsWith(agentWorkdir + '/') ||
    resolved === agentWorkdir ||
    resolved.startsWith(uploadsDir + '/') ||
    resolved === uploadsDir

  if (!allowed) {
    return {
      allowed: false,
      reason: `Path '${resolved}' is outside permitted directories. Allowed: agent workdir (${agentWorkdir}) and uploads (${uploadsDir}).`,
    }
  }

  return { allowed: true, resolvedPath: resolved }
}

export const readFileTool: AgentTool<Input> = {
  name: 'read_file',

  description:
    'Read the contents of a file. ' +
    'Permitted paths: the agent\'s own workspace directory and the session uploads directory (read-only). ' +
    'Optionally specify startLine / endLine to read a specific range.',

  inputSchema,

  async execute(input: Input, ctx: AgentContext): Promise<ToolResult> {
    const validation = validateReadPath(input.path, ctx)
    if (!validation.allowed) {
      return { success: false, output: '', error: validation.reason }
    }

    const { startLine, endLine } = input
    let command: string

    if (startLine !== undefined && endLine !== undefined) {
      command = `sed -n '${startLine},${endLine}p' ${JSON.stringify(validation.resolvedPath)}`
    } else if (startLine !== undefined) {
      command = `tail -n +${startLine} ${JSON.stringify(validation.resolvedPath)}`
    } else if (endLine !== undefined) {
      command = `head -n ${endLine} ${JSON.stringify(validation.resolvedPath)}`
    } else {
      command = `cat ${JSON.stringify(validation.resolvedPath)}`
    }

    try {
      const { stdout, stderr, exitCode } = await ctx.sandbox.exec(command)

      if (exitCode !== 0) {
        return { success: false, output: '', error: stderr || `Exit code ${exitCode}` }
      }

      return {
        success: true,
        output: stdout,
        metadata: { resolvedPath: validation.resolvedPath, startLine, endLine },
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      return { success: false, output: '', error: `Read failed: ${message}` }
    }
  },
}