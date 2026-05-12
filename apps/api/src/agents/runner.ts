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
//
// Top-level events (no `agentId`) come from the orchestrator/root agent.
// Sub-agent events carry an `agentId` so the UI can route them to the right
// sub-agent card. This lets the frontend render a Cursor-style nested
// "sub-task" view where each spawned specialist has its own thinking +
// tool timeline + final result, streamed live.

export type AgentEvent =
  | { type: 'thinking'; delta: string }      // Extended thinking block token (orchestrator)
  | { type: 'text_delta'; delta: string }    // Regular response text token (orchestrator)
  | { type: 'tool_use'; toolName: string; toolUseId: string; input: unknown }
  | { type: 'tool_result'; toolUseId: string; toolName: string; success: boolean; output: string }
  | { type: 'sub_agent_spawned'; agentId: string; role: string; task: string }
  // ── Sub-agent lifecycle (forwarded from runSubAgent generators) ──
  | { type: 'sub_agent_thinking'; agentId: string; delta: string }
  | { type: 'sub_agent_text_delta'; agentId: string; delta: string }
  | { type: 'sub_agent_tool_use'; agentId: string; toolName: string; toolUseId: string; input: unknown }
  | { type: 'sub_agent_tool_result'; agentId: string; toolUseId: string; toolName: string; success: boolean; output: string }
  | { type: 'sub_agent_completed'; agentId: string; result: string; tokensUsed: number; success: boolean; error?: string }
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

        // ── Execute tool calls (in PARALLEL, with sub-agent event forwarding) ──
        // Two execution paths:
        //   1) Regular tools (bash, log_*, read/write/list_file)
        //        → tool.execute() returns a Promise<ToolResult>
        //   2) spawn_agent
        //        → runs a nested AgentRunner generator and forwards every
        //          internal event (thinking, text_delta, tool_use, tool_result,
        //          sub_agent_completed) up to OUR consumer so the UI can show
        //          live sub-task activity.
        //
        // Both paths feed into the same Anthropic `tool_result` array (in
        // ORIGINAL relative order) and the same SSE event stream (in
        // COMPLETION order). The global SubAgentSemaphore (limit=5) is
        // acquired inside runSubAgentStream — so even though we start all
        // spawn_agent generators in parallel, only 5 actually run at a time.
        type ToolExecOutcome = {
          blockIndex: number
          toolUseId: string
          toolName: string
          input: Record<string, unknown>
          output: string
          success: boolean
          durationMs: number
        }

        const toolUseBlocks: Array<{
          index: number  // 0..(toolUseCount-1)
          block: Anthropic.ToolUseBlock
        }> = []
        for (const block of assistantContentBlocks) {
          if (block.type === 'tool_use') {
            toolUseBlocks.push({
              index: toolUseBlocks.length,
              block: block as Anthropic.ToolUseBlock,
            })
          }
        }

        const toolResultContent: Anthropic.ToolResultBlockParam[] = new Array(toolUseBlocks.length)
        const dbInserts: Promise<unknown>[] = []

        // Emit all tool_use events synchronously up front so the UI sees the
        // full plan immediately (the user can watch N specialists spawn at once).
        for (const { block } of toolUseBlocks) {
          if (signal?.aborted) break
          yield {
            type: 'tool_use',
            toolName: block.name,
            toolUseId: block.id,
            input: block.input as Record<string, unknown>,
          }
        }

        // Build a generator-per-slot, then race-drain them all in parallel.
        // Each generator yields zero or more AgentEvents and finally produces
        // a ToolExecOutcome (carried in the generator's return value).
        //
        // Regular tools yield nothing — only their final outcome is consumed
        // via the generator's `return` value. spawn_agent yields a stream of
        // sub_agent_* events plus the outcome.
        const runRegularTool = async function* (
          slot: { index: number; block: Anthropic.ToolUseBlock },
        ): AsyncGenerator<AgentEvent, ToolExecOutcome, void> {
          const { block, index: blockIndex } = slot
          const toolInput = block.input as Record<string, unknown>
          const tool = getToolByName(block.name)
          const startedAt = Date.now()
          let toolOutput: string
          let toolSuccess: boolean

          if (!tool) {
            const available = getToolsForAgent(toolRole).map((t) => t.name).join(', ')
            toolOutput = `Unknown tool: "${block.name}". Available tools: ${available}.`
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
          return {
            blockIndex, toolUseId: block.id, toolName: block.name,
            input: toolInput, output: toolOutput, success: toolSuccess, durationMs,
          }
        }

        const self = this
        const runSpawnAgentSlot = async function* (
          slot: { index: number; block: Anthropic.ToolUseBlock },
        ): AsyncGenerator<AgentEvent, ToolExecOutcome, void> {
          const { block, index: blockIndex } = slot
          const toolInput = block.input as Record<string, unknown>
          const startedAt = Date.now()

          // Orchestrator-only guard mirrors spawnAgentTool's runtime check
          if (!ctx.isOrchestrator) {
            return {
              blockIndex, toolUseId: block.id, toolName: block.name,
              input: toolInput, output: 'spawn_agent is restricted to the orchestrator agent.',
              success: false, durationMs: Date.now() - startedAt,
            }
          }

          // Validate inputs with the same schema spawnAgentTool uses
          const { spawnAgentTool } = await import('./tools/spawn-agent.js')
          const parsed = spawnAgentTool.inputSchema.safeParse(toolInput)
          if (!parsed.success) {
            return {
              blockIndex, toolUseId: block.id, toolName: block.name,
              input: toolInput, output: `Invalid input: ${parsed.error.message}`,
              success: false, durationMs: Date.now() - startedAt,
            }
          }

          const subAgentId = randomUUID()

          // Announce the spawn BEFORE acquiring the semaphore so the UI shows
          // a "queued/starting" card immediately even if all slots are busy.
          yield {
            type: 'sub_agent_spawned',
            agentId: subAgentId,
            role: parsed.data.role,
            task: parsed.data.task,
          }

          let subResult: SubAgentResult | undefined
          try {
            const subGen = self.runSubAgentStream(
              {
                parentRunId: ctx.agentId,
                sessionId: ctx.sessionId,
                role: parsed.data.role,
                task: parsed.data.task,
                inputFiles: parsed.data.inputFiles,
                outputSchema: parsed.data.outputSchema,
                db: ctx.db,
                sandbox: ctx.sandbox,
              },
              subAgentId,
            )

            // Drain the sub-agent generator, forwarding every event upstream.
            // The terminal value (SubAgentResult) is delivered via gen.return.
            while (true) {
              const next = await subGen.next()
              if (next.done) {
                subResult = next.value as SubAgentResult
                break
              }
              yield next.value
            }
          } catch (err) {
            const message = err instanceof Error ? err.message : String(err)
            return {
              blockIndex, toolUseId: block.id, toolName: block.name,
              input: toolInput, output: `Sub-agent failed: ${message}`,
              success: false, durationMs: Date.now() - startedAt,
            }
          }

          const durationMs = Date.now() - startedAt
          const output = subResult
            ? JSON.stringify(subResult.data, null, 2)
            : ''
          return {
            blockIndex, toolUseId: block.id, toolName: block.name,
            input: toolInput,
            output,
            success: subResult?.success ?? false,
            durationMs,
          }
        }

        const buildSlotGen = (slot: { index: number; block: Anthropic.ToolUseBlock }) =>
          slot.block.name === 'spawn_agent' ? runSpawnAgentSlot(slot) : runRegularTool(slot)

        // Each slot becomes a "live driver" that pumps its generator and,
        // when done, resolves with its final ToolExecOutcome.
        type Driver = {
          slotId: number
          nextPromise: Promise<{ slotId: number; ev: IteratorResult<AgentEvent, ToolExecOutcome> }>
          gen: AsyncGenerator<AgentEvent, ToolExecOutcome, void>
        }

        const drivers: Map<number, Driver> = new Map()
        toolUseBlocks.forEach((slot, slotId) => {
          const gen = buildSlotGen(slot)
          drivers.set(slotId, {
            slotId,
            gen,
            nextPromise: gen.next().then((ev) => ({ slotId, ev })),
          })
        })

        // Race-drain across all live drivers. Whenever a driver yields an
        // event we forward it; when it completes (`ev.done`) we record the
        // outcome and remove it from the live set.
        while (drivers.size > 0) {
          if (signal?.aborted) break

          const winner = await Promise.race(
            Array.from(drivers.values()).map((d) => d.nextPromise),
          )
          const driver = drivers.get(winner.slotId)
          if (!driver) continue  // already removed

          if (winner.ev.done) {
            const outcome = winner.ev.value

            yield {
              type: 'tool_result',
              toolUseId: outcome.toolUseId,
              toolName: outcome.toolName,
              success: outcome.success,
              output: outcome.output,
            }

            dbInserts.push(
              db.insert(toolCalls).values({
                id: randomUUID(),
                agentRunId,
                toolName: outcome.toolName,
                input: outcome.input,
                output: { success: outcome.success, output: outcome.output },
                durationMs: outcome.durationMs,
              }),
            )

            toolResultContent[outcome.blockIndex] = {
              type: 'tool_result',
              tool_use_id: outcome.toolUseId,
              content: outcome.output,
              is_error: !outcome.success,
            }

            drivers.delete(winner.slotId)
          } else {
            // Forward the streamed sub-event (only spawn_agent generators
            // produce these; regular tool generators don't yield anything).
            yield winner.ev.value

            // Queue the driver's next pump
            driver.nextPromise = driver.gen.next().then((ev) => ({ slotId: winner.slotId, ev }))
          }
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

  // ── Sub-agent streaming entry point ─────────────────────────────────────────
  //
  // Unlike the old Promise-returning version, this is an async generator so
  // that the PARENT runner can forward every internal event (thinking,
  // text_delta, tool_use, tool_result) to the SSE stream — letting the UI
  // render a live "sub-task" view per spawned specialist.
  //
  // The final SubAgentResult is delivered via the generator's `return` value,
  // accessible to the caller as the `value` field of the final iteration
  // result when `done` is true.
  async *runSubAgentStream(
    options: SubAgentRunOptions,
    agentId: string,
  ): AsyncGenerator<AgentEvent, SubAgentResult, void> {
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

      // Make sure the sub-agent's sandbox user + workdir exist BEFORE its
      // tools start firing. Without this, log_grep/log_stats/read_file all
      // fail with "no such file or directory" because the workdir's `output/`
      // hasn't been created yet (only the orchestrator's workdir is pre-made
      // in routes/chat.ts).
      try {
        await sandbox.ensureAgentUser(sessionId, agentId)
        const workdir = sandbox.agentWorkdir(sessionId, agentId)
        await sandbox.exec(`mkdir -p ${JSON.stringify(workdir + '/output')}`)
      } catch {
        // Non-fatal: tools will surface the real error if dirs are missing
      }

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
        // Forward every internal event up to the parent, but RETAG it so the
        // frontend can route it to the correct sub-agent card.
        switch (event.type) {
          case 'thinking':
            yield { type: 'sub_agent_thinking', agentId, delta: event.delta }
            break
          case 'text_delta':
            yield { type: 'sub_agent_text_delta', agentId, delta: event.delta }
            break
          case 'tool_use':
            yield {
              type: 'sub_agent_tool_use',
              agentId,
              toolName: event.toolName,
              toolUseId: event.toolUseId,
              input: event.input,
            }
            break
          case 'tool_result':
            yield {
              type: 'sub_agent_tool_result',
              agentId,
              toolUseId: event.toolUseId,
              toolName: event.toolName,
              success: event.success,
              output: event.output,
            }
            break
          case 'completed':
            finalResult = event.result
            totalTokens = event.tokensUsed
            break
          case 'error':
            success = false
            errorMsg = event.message
            break
          // Nested sub-agents would propagate up here too, but specialists
          // can't call spawn_agent so this is currently dead code — we leave
          // the pass-through in case that policy ever changes.
          case 'sub_agent_spawned':
          case 'sub_agent_thinking':
          case 'sub_agent_text_delta':
          case 'sub_agent_tool_use':
          case 'sub_agent_tool_result':
          case 'sub_agent_completed':
            yield event
            break
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

      // Emit a terminal sub_agent_completed event so the UI can flip the
      // card from "running" to "done" before the parent's own tool_result
      // event arrives. Both events carry the same agentId.
      yield {
        type: 'sub_agent_completed',
        agentId,
        result: finalResult,
        tokensUsed: totalTokens,
        success,
        error: errorMsg,
      }

      return { success, agentId, data: parsedData, error: errorMsg, tokensUsed: totalTokens }
    } finally {
      globalSubAgentSemaphore.release()
    }
  }
}