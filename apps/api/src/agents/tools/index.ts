import type Anthropic from '@anthropic-ai/sdk'
import { zodToJsonSchema } from 'zod-to-json-schema'

import type { AgentTool } from '../types.js'
import { bashTool } from './bash.js'
import { readFileTool } from './read-file.js'
import { logStatsTool } from './log-stats.js'
import { logSampleTool } from './log-sample.js'
import { logGrepTool } from './log-grep.js'
import { spawnAgentTool } from './spawn-agent.js'
import { writeFileTool } from './write-file.js'
import { listFilesTool } from './list-files.js'

// ── Tool registries ────────────────────────────────────────────────────────────

const ALL_TOOLS: AgentTool[] = [
  bashTool,
  readFileTool,
  logStatsTool,
  logSampleTool,
  logGrepTool,
  spawnAgentTool,
  writeFileTool,
  listFilesTool,
]

const SUBAGENT_TOOLS: AgentTool[] = [
  readFileTool,
  logStatsTool,
  logSampleTool,
  logGrepTool,
  writeFileTool,
  listFilesTool,
]

// ── Selector ──────────────────────────────────────────────────────────────────

export function getToolsForAgent(role: 'orchestrator' | 'subagent'): AgentTool[] {
  return role === 'orchestrator' ? ALL_TOOLS : SUBAGENT_TOOLS
}

export function getToolByName(name: string): AgentTool | undefined {
  return ALL_TOOLS.find((t) => t.name === name)
}

// ── Anthropic format converter ────────────────────────────────────────────────

export function toAnthropicTool(tool: AgentTool): Anthropic.Tool {
  const jsonSchema = zodToJsonSchema(tool.inputSchema, {
    target: 'jsonSchema7',
    $refStrategy: 'none',
  })

  // Strip $schema key Anthropic doesn't accept
  const { $schema: _schema, ...inputSchemaClean } = jsonSchema as Record<string, unknown>

  return {
    name: tool.name,
    description: tool.description,
    input_schema: inputSchemaClean as Anthropic.Tool['input_schema'],
  }
}

export function toAnthropicTools(tools: AgentTool[]): Anthropic.Tool[] {
  return tools.map(toAnthropicTool)
}

// Re-export individual tools for direct access
export {
  bashTool,
  readFileTool,
  logStatsTool,
  logSampleTool,
  logGrepTool,
  spawnAgentTool,
  writeFileTool,
  listFilesTool,
}