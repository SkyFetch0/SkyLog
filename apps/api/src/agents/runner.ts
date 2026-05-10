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
  | { type: 'thinking'; delta: string }      // Extended thinking block token
  | { type: 'text_delta'; delta: string }    // Regular response text token (streamed)
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
  signal?: AbortSignal
  // Previous turns in the session, oldest-first (user/assistant alternating)
  conversationHistory?: Array<{ role: 'user' | 'assistant'; content: string }>
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
  private readonly model: string

  constructor() {
    // Custom API takes precedence over Anthropic direct
    const customBase = process.env.CUSTOM_API_BASE_URL
    const customKey = process.env.CUSTOM_API_KEY
    const customModel = process.env.CUSTOM_API_MODEL

    const apiKey = customKey || process.env.ANTHROPIC_API_KEY
    if (!apiKey) throw new Error('ANTHROPIC_API_KEY (or CUSTOM_API_KEY) environment variable is not set')

    this.model = customModel || 'claude-sonnet-4-5-20250929'

    this.anthropic = new Anthropic({
      apiKey,
      ...(customBase ? { baseURL: customBase } : {}),
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
      signal,
    } = options

    const isOrchestrator = role === 'orchestrator'
    const systemPrompt = isOrchestrator
      ? getOrchestratorPrompt()
      : getSpecialistPrompt(role)

    const toolRole: 'orchestrator' | 'subagent' = isOrchestrator ? 'orchestrator' : 'subagent'
    const agentTools = getToolsForAgent(toolRole)
    const anthropicTools = toAnthropicTools(agentTools)

    const fileContext =
      inputFiles.length > 0
        ? `\n\nFiles available for analysis:\n${inputFiles.map((f) => `- ${f}`).join('\n')}`
        : ''

    // Build message list: inject conversation history before the current turn.
    // The Anthropic API requires messages to alternate user/assistant strictly.
    // We cap history at the last 20 turns (10 exchanges) to stay within context.
    const history = options.conversationHistory ?? []
    const cappedHistory = history.slice(-20)

    const messages: Anthropic.MessageParam[] = [
      ...cappedHistory.map((m) => ({ role: m.role, content: m.content })),
      { role: 'user', content: userMessage + fileContext },
    ]

    await db
      .update(agentRuns)
      .set({ status: 'running', startedAt: new Date() })
      .where(eq(agentRuns.id, agentRunId))

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
        if (signal?.aborted) break

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const streamParams: any = {
          model: this.model,
          max_tokens: 16000,
          system: systemPrompt,
          tools: anthropicTools,
          messages,
        }

        // Extended thinking — supported by claude-sonnet-4-x and compatible APIs.
        // If the API does not support it the stream will simply not emit
        // thinking_delta events and we fall back to text-only streaming.
        streamParams.thinking = { type: 'enabled', budget_tokens: 8000 }

        const stream = this.anthropic.messages.stream(streamParams)

        let currentToolUseId = ''
        let currentToolName = ''
        let currentToolInputJson = ''
        let currentBlockType: 'text' | 'thinking' | 'tool_use' | '' = ''
        const assistantContentBlocks: Anthropic.ContentBlock[] = []

        try {
          for await (const event of stream) {
            if (signal?.aborted) break

            switch (event.type) {
              case 'content_block_start':
                if (event.content_block.type === 'text') {
                  currentBlockType = 'text'
                  assistantContentBlocks.push({ type: 'text', text: '' } as Anthropic.TextBlock)
                } else if (event.content_block.type === 'thinking') {
                  currentBlockType = 'thinking'
                  // thinking blocks are not stored in assistant content for API replay
                } else if (event.content_block.type === 'tool_use') {
                  currentBlockType = 'tool_use'
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
                if (event.delta.type === 'thinking_delta') {
                  // Extended thinking token
                  yield { type: 'thinking', delta: event.delta.thinking }
                } else if (event.delta.type === 'text_delta') {
                  const last = assistantContentBlocks[assistantContentBlocks.length - 1]
                  if (last?.type === 'text') {
                    (last as Anthropic.TextBlock).text += event.delta.text
                    finalText += event.delta.text
                  }
                  if (currentBlockType === 'text') {
                    // Regular response text — stream to frontend in real-time
                    yield { type: 'text_delta', delta: event.delta.text }
                  }
                } else if (event.delta.type === 'input_json_delta') {
                  currentToolInputJson += event.delta.partial_json
                }
                break

              case 'content_block_stop': {
                const last = assistantContentBlocks[assistantContentBlocks.length - 1]
                if (last?.type === 'tool_use' && currentToolInputJson) {
                  try {
                    (last as Anthropic.ToolUseBlock).input = JSON.parse(currentToolInputJson) as Record<string, unknown>
                  } catch {
                    (last as Anthropic.ToolUseBlock).input = {}
                  }
                }
                break
              }

              // message_delta carries output_tokens — do NOT add to totalInputTokens
              // Token totals are taken from finalMessage() below.
            }
          }
        } catch (streamErr) {
          // Ensure Anthropic stream is cleaned up on error
          stream.abort?.()
          throw streamErr
        }

        const finalMessage = await stream.finalMessage()
        totalInputTokens += finalMessage.usage.input_tokens
        totalOutputTokens += finalMessage.usage.output_tokens

        messages.push({ role: 'assistant', content: assistantContentBlocks })

        if (finalMessage.stop_reason === 'end_turn') break
        if (finalMessage.stop_reason !== 'tool_use') break

        // ── Execute tool calls ───────────────────────────────────────────────
        const toolResultContent: Anthropic.ToolResultBlockParam[] = []
        const dbInserts: Promise<unknown>[] = []

        for (const block of assistantContentBlocks) {
          if (block.type !== 'tool_use') continue
          if (signal?.aborted) break

          const toolBlock = block as Anthropic.ToolUseBlock
          const toolInput = toolBlock.input as Record<string, unknown>
          yield { type: 'tool_use', toolName: toolBlock.name, toolUseId: toolBlock.id, input: toolInput }

          const tool = getToolByName(toolBlock.name)
          const startedAt = Date.now()
          let toolOutput: string
          let toolSuccess: boolean

          if (!tool) {
            // Help the model self-correct: list available tools so it picks
            // a valid one on the next turn. Some models occasionally emit
            // synthetic names like `function_calls` due to XML wrapper
            // artifacts in their pretraining — a clear list nudges them
            // back on track.
            const available = getToolsForAgent(toolRole).map((t) => t.name).join(', ')
            toolOutput = `Unknown tool: "${toolBlock.name}". Available tools: ${available}.`
            toolSuccess = false
          } else {
            const parseResult = tool.inputSchema.safeParse(toolInput)
            if (!parseResult.success) {
              toolOutput = `Invalid input: ${parseResult.error.message}`
              toolSuccess = false
            } else {
              try {
                const result = await tool.execute(parseResult.data, ctx)
                toolOutput = result.output || result.error || ''
                toolSuccess = result.success
              } catch (execErr) {
                toolOutput = execErr instanceof Error ? execErr.message : String(execErr)
                toolSuccess = false
              }
            }
          }

          const durationMs = Date.now() - startedAt

          // Buffer DB inserts — flush after loop to reduce round-trips
          dbInserts.push(
            db.insert(toolCalls).values({
              id: randomUUID(),
              agentRunId,
              toolName: toolBlock.name,
              input: toolInput,
              output: { success: toolSuccess, output: toolOutput },
              durationMs,
            }),
          )

          yield {
            type: 'tool_result',
            toolUseId: toolBlock.id,
            toolName: toolBlock.name,
            success: toolSuccess,
            output: toolOutput,
          }

          toolResultContent.push({
            type: 'tool_result',
            tool_use_id: toolBlock.id,
            content: toolOutput,
            is_error: !toolSuccess,
          })
        }

        // Flush all tool-call DB inserts in parallel
        await Promise.all(dbInserts)

        messages.push({ role: 'user', content: toolResultContent })
      }

      const tokensUsed = totalInputTokens + totalOutputTokens

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

    // Single semaphore point: only globalSubAgentSemaphore, not spawn-agent's local one
    await globalSubAgentSemaphore.acquire()

    try {
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
        }
      }

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