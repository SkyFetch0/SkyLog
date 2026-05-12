import { z } from 'zod'
import type { AgentTool, AgentContext, ToolResult } from '../types.js'

// spawn_agent is special: the orchestrator runner detects this tool name
// and handles it via runSubAgentStream() so it can FORWARD every internal
// sub-agent event (thinking / text_delta / tool_use / tool_result) up to
// the SSE stream for live UI rendering.
//
// The execute() implementation below is therefore a fallback — it should
// never be hit in normal operation. We keep the schema/description because
// Anthropic still needs the tool definition in its tools list. If the
// fallback ever fires it means the runner's special-case branch missed
// this block (programmer bug), so we return a loud error instead of
// silently degrading to the old non-streaming path.

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

  async execute(_input: Input, _ctx: AgentContext): Promise<ToolResult> {
    // This path should be unreachable — runner.ts handles spawn_agent in its
    // own special branch so it can stream sub-agent events live. If we ever
    // land here, the runner's dispatching logic is broken.
    return {
      success: false,
      output: '',
      error:
        'spawn_agent must be dispatched by the runner, not executed via the normal tool path. ' +
        'This is a bug — please report it.',
    }
  },
}