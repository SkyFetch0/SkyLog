import Anthropic from '@anthropic-ai/sdk'
import { eq } from 'drizzle-orm'
import { randomUUID } from 'crypto'

import { db } from '../db/index.js'
import { agentRuns, toolCalls } from '../db/schema.js'
import { getToolsForAgent, toAnthropicTools, getToolByName } from './tools/index.js'
import { getOrchestratorPrompt, getSpecialistPrompt } from './registry.js'
import { globalSubAgentSemaphore } from './concurrency.js'
import type { AgentContext, SandboxManager } from './types.js'

// ── Event types emitted by the runner ─────────────────────────────────────────

export type AgentEvent =
  | { type: 'thinking'; delta: string }
  | { type: 'tool_use'; toolName: string; toolUseId: string; input: unknown }
  | { type: 'tool_result'; toolUseId: string; toolName: string; success: boolean; output: string }
  | { type: 'sub_agent_spawned'; agentId: string; role: string; task: string }
  | { type: 'completed'; result: string; tokensUsed: number }
  | { type: 'error'; message: string }

// ── Runner options ─────────────────────────────────────────────────────────────

export interface AgentRunOptions {
  sessionId: string
  agentRunId: string
  role: 'orchestrator' | string
  userMessage: string
  inputFiles?: string[]
  parentRunId?: string
  maxIterations?: number
  sandbox: SandboxManager
}

// ── Sub-agent invocation (called from spawn_agent tool) ───────────────────────

export interface SubAgentRunOptions {
  parentRunId: string
  sessionId: string
  role: string
  task: string
  inputFiles: string[]
  outputSchema?: Record<string, unknown>
  db: typeof db
  sandbox: SandboxManager
}

export interface SubAgentResult {
  success: boolean
  agentId: string
  data: unknown
  error?: string
  tokensUsed: number
}

// ── Main AgentRunner class ────────────────────────────────────────────────────

export class AgentRunner {
  private readonly anthropic: Anthropic
  private readonly model = 'claude-sonnet-4-5-20250929'

  constructor() {
    this.anthropic = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY,
      ...(process.env.CUSTOM_API_BASE_URL
        ? { baseURL: process.env.CUSTOM_API_BASE_URL }
        : {}),
    })
  }

  // ── Primary streaming entry point ────────────────────────────────────────────

  async *run(options: AgentRunOptions): AsyncGenerator<AgentEvent> {
    const {
      sessionId,
      agentRunId,
      role,
      userMessage,
      inputFiles = [],
      parentRunId,
      maxIterations = 25,
      sandbox,
    } = options

    const isOrchestrator = role === 'orchestrator'
    const systemPrompt = isOrchestrator
      ? getOrchestratorPrompt()
      : getSpecialistPrompt(role)

    const toolRole: 'orchestrator' | 'subagent' = isOrchestrator ? 'orchestrator' : 'subagent'
    const agentTools = getToolsForAgent(toolRole)
    const anthropicTools = toAnthropicTools(agentTools)

    // Build initial context message
    const fileContext =
      inputFiles.length > 0
        ? `\n\nFiles available for analysis:\n${inputFiles.map((f) => `- ${f}`).join('\n')}`
        : ''

    const messages: Anthropic.MessageParam[] = [
      { role: 'user', content: userMessage + fileContext },
    ]

    // Persist run start
    await db
      .update(agentRuns)
      .set({ status: 'running', startedAt: new Date() })
      .where(eq(agentRuns.id, agentRunId))

    // Build AgentContext for tool execution
    const ctx: AgentContext = {
      sessionId,
      agentId: agentRunId,
      agentRole: role,
      sandbox,
      db,
      isOrchestrator,
    }

    let totalInputTokens = 0
    let totalOutputTokens = 0
    let finalText = ''

    try {
      for (let iteration = 0; iteration < maxIterations; iteration++) {
        // ── Stream one Claude turn ───────────────────────────────────────────
        const stream = this.anthropic.messages.stream({
          model: this.model,
          max_tokens: 8192,
          system: systemPrompt,
          tools: anthropicTools,
          messages,
        })

        let currentToolUseId = ''
        let currentToolName = ''
        let currentToolInputJson = ''
        const assistantContentBlocks: Anthropic.ContentBlock[] = []

        // ── Process streaming events ─────────────────────────────────────────
        for await (const event of stream) {
          switch (event.type) {
            case 'content_block_start':
              if (event.content_block.type === 'text') {
                assistantContentBlocks.push({ type: 'text', text: '', citations: [] } as Anthropic.ContentBlock)
              } else if (event.content_block.type === 'tool_use') {
                currentToolUseId = event.content_block.id
                currentToolName = event.content_block.name
                currentToolInputJson = ''
                assistantContentBlocks.push({
                  type: 'tool_use',
                  id: currentToolUseId,
                  name: currentToolName,
                  input: {},
                })
              }
              break

            case 'content_block_delta':
              if (event.delta.type === 'text_delta') {
                const last = assistantContentBlocks[assistantContentBlocks.length - 1]
                if (last?.type === 'text') {
                  last.text += event.delta.text
                  finalText += event.delta.text
                }
                yield { type: 'thinking', delta: event.delta.text }
              } else if (event.delta.type === 'input_json_delta') {
                currentToolInputJson += event.delta.partial_json
              }
              break

            case 'content_block_stop': {
              // Finalize tool input JSON when block ends
              const last = assistantContentBlocks[assistantContentBlocks.length - 1]
              if (last?.type === 'tool_use' && currentToolInputJson) {
                try {
                  last.input = JSON.parse(currentToolInputJson) as Record<string, unknown>
                } catch {
                  last.input = {}
                }
              }
              break
            }

            case 'message_delta':
              totalInputTokens += event.usage?.output_tokens ?? 0
              break
          }
        }

        const finalMessage = await stream.finalMessage()
        totalInputTokens += finalMessage.usage.input_tokens
        totalOutputTokens += finalMessage.usage.output_tokens

        // Add assistant turn to history
        messages.push({ role: 'assistant', content: assistantContentBlocks })

        // ── Check stop reason ────────────────────────────────────────────────
        if (finalMessage.stop_reason === 'end_turn') {
          break
        }

        if (finalMessage.stop_reason !== 'tool_use') {
          break
        }

        // ── Execute tool calls ───────────────────────────────────────────────
        const toolResultContent: Anthropic.ToolResultBlockParam[] = []

        for (const block of assistantContentBlocks) {
          if (block.type !== 'tool_use') continue

          const toolInput = block.input as Record<string, unknown>
          yield { type: 'tool_use', toolName: block.name, toolUseId: block.id, input: toolInput }

          const tool = getToolByName(block.name)
          const startedAt = Date.now()
          let toolOutput: string
          let toolSuccess: boolean

          if (!tool) {
            toolOutput = `Unknown tool: ${block.name}`
            toolSuccess = false
          } else {
            const parseResult = tool.inputSchema.safeParse(toolInput)
            if (!parseResult.success) {
              toolOutput = `Invalid input: ${parseResult.error.message}`
              toolSuccess = false
            } else {
              const result = await tool.execute(parseResult.data, ctx)
              toolOutput = result.output || result.error || ''
              toolSuccess = result.success
            }
          }

          const durationMs = Date.now() - startedAt

          // Persist tool call to DB
          await db.insert(toolCalls).values({
            id: randomUUID(),
            agentRunId,
            toolName: block.name,
            input: toolInput,
            output: { success: toolSuccess, output: toolOutput },
            durationMs,
          })

          yield {
            type: 'tool_result',
            toolUseId: block.id,
            toolName: block.name,
            success: toolSuccess,
            output: toolOutput,
          }

          toolResultContent.push({
            type: 'tool_result',
            tool_use_id: block.id,
            content: toolOutput,
            is_error: !toolSuccess,
          })
        }

        // Add tool results as user turn
        messages.push({ role: 'user', content: toolResultContent })
      }

      const tokensUsed = totalInputTokens + totalOutputTokens

      // Persist completion
      await db
        .update(agentRuns)
        .set({
          status: 'completed',
          result: { text: finalText },
          tokensUsed,
          completedAt: new Date(),
        })
        .where(eq(agentRuns.id, agentRunId))

      yield { type: 'completed', result: finalText, tokensUsed }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)

      await db
        .update(agentRuns)
        .set({ status: 'failed', result: { error: message }, completedAt: new Date() })
        .where(eq(agentRuns.id, agentRunId))

      yield { type: 'error', message }
    }
  }

  // ── Sub-agent entry point (called from spawn_agent tool) ─────────────────────

  async runSubAgent(options: SubAgentRunOptions): Promise<SubAgentResult> {
    const agentId = randomUUID()
    const { sessionId, parentRunId, role, task, inputFiles, sandbox } = options

    await globalSubAgentSemaphore.acquire()

    try {
      // Insert DB record for sub-agent run
      await db.insert(agentRuns).values({
        id: agentId,
        sessionId,
        parentRunId,
        role,
        status: 'pending',
        task,
        inputRefs: inputFiles,
        workspacePath: sandbox.agentWorkdir(sessionId, agentId),
        tokensUsed: 0,
      })

      let finalResult = ''
      let totalTokens = 0
      let success = true
      let errorMsg: string | undefined

      const gen = this.run({
        sessionId,
        agentRunId: agentId,
        role,
        userMessage: task,
        inputFiles,
        parentRunId,
        sandbox,
      })

      for await (const event of gen) {
        if (event.type === 'completed') {
          finalResult = event.result
          totalTokens = event.tokensUsed
        } else if (event.type === 'error') {
          success = false
          errorMsg = event.message
        } else if (event.type === 'sub_agent_spawned') {
          // Sub-agents cannot spawn further agents — guard is in spawn_agent tool
        }
      }

      // Try to parse final result as JSON (specialist output schema)
      let parsedData: unknown = finalResult
      try {
        const jsonMatch = finalResult.match(/```json\s*([\s\S]*?)```/)
        if (jsonMatch) {
          parsedData = JSON.parse(jsonMatch[1])
        } else {
          parsedData = JSON.parse(finalResult)
        }
      } catch {
        // Not JSON — return raw text
      }

      return { success, agentId, data: parsedData, error: errorMsg, tokensUsed: totalTokens }
    } finally {
      globalSubAgentSemaphore.release()
    }
  }
}