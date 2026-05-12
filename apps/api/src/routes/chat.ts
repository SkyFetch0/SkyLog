import type { FastifyInstance } from 'fastify'
import { eq, and, inArray, asc, ne } from 'drizzle-orm'
import { randomUUID } from 'crypto'
import { z } from 'zod'
import { db } from '../db/index.js'
import { sessions, messages, files, agentRuns } from '../db/schema.js'
import { sandbox } from '../sandbox.js'
import { AgentRunner } from '../agents/runner.js'
import type { AgentEvent } from '../agents/runner.js'
import { AppError } from '../lib/errors.js'
import { createRateLimit } from '../lib/rate-limit.js'

// Per-user mesaj rate limit. JWT verify edildiği için key user-id olur.
// Anthropic maliyet patlamasına karşı koruma + tek kullanıcının
// tüm semafor slotlarını yememesi için.
const messageRateLimit = createRateLimit({
  windowMs: 60_000,
  max: 30,
  message: 'Too many messages. Please wait a moment.',
})

const sendMessageSchema = z.object({
  content: z.string().min(1).max(32_000),
  attachedFileIds: z.array(z.string().uuid()).max(20).optional().default([]),
})

export default async function chatRoutes(fastify: FastifyInstance) {
  // ── POST /sessions/:id/messages (SSE stream) ──────────────────────────────────
  // Auth + rate limit. Auth `onRequest` hook'unda olduğu için preHandler'a
  // ulaştığında request.user dolu olur ve rate-limit user-id ile çalışır.
  fastify.post(
    '/sessions/:id/messages',
    { onRequest: [fastify.authenticate], preHandler: [messageRateLimit] },
    async (request, reply) => {
    const { sub } = request.user as { sub: string }
    const { id: sessionId } = request.params as { id: string }

    const body = sendMessageSchema.safeParse(request.body)
    if (!body.success) {
      return reply.status(400).send({ error: 'Validation failed', issues: body.error.issues })
    }

    // Verify session ownership
    const [session] = await db
      .select()
      .from(sessions)
      .where(and(eq(sessions.id, sessionId), eq(sessions.userId, sub)))
      .limit(1)

    if (!session) return reply.status(404).send({ error: 'Session not found' })

    const { content, attachedFileIds } = body.data

    // Resolve attached file paths
    let attachedFiles: Array<{ id: string; storagePath: string; originalName: string }> = []
    if (attachedFileIds.length > 0) {
      attachedFiles = await db
        .select({ id: files.id, storagePath: files.storagePath, originalName: files.originalName })
        .from(files)
        .where(and(eq(files.sessionId, sessionId), inArray(files.id, attachedFileIds)))
    }

    // Persist user message + agentRun + session.updatedAt in a single transaction
    const userMsgId = randomUUID()
    const agentRunId = randomUUID()
    const inputFiles = attachedFiles.map((f) => f.storagePath)

    await db.transaction(async (tx) => {
      await tx.insert(messages).values({
        id: userMsgId,
        sessionId,
        role: 'user',
        content,
        metadata: attachedFileIds.length > 0 ? { attachedFileIds } : null,
      })

      await tx.insert(agentRuns).values({
        id: agentRunId,
        sessionId,
        role: 'orchestrator',
        status: 'pending',
        task: content,
        inputRefs: inputFiles,
        workspacePath: sandbox.agentWorkdir(sessionId, agentRunId),
        tokensUsed: 0,
      })

      await tx.update(sessions).set({ updatedAt: new Date() }).where(eq(sessions.id, sessionId))
    })

    const userMessageForAgent =
      attachedFiles.length > 0
        ? `${content}\n\nAttached files:\n${attachedFiles.map((f) => `- ${f.originalName} → ${f.storagePath}`).join('\n')}`
        : content

    // Fetch prior messages in this session (excluding the message we just inserted)
    // to build the conversation history for the agent.
    const priorMessages = await db
      .select({ id: messages.id, role: messages.role, content: messages.content })
      .from(messages)
      .where(and(eq(messages.sessionId, sessionId), ne(messages.id, userMsgId)))
      .orderBy(asc(messages.createdAt))

    const conversationHistory = priorMessages
      .filter((m) => m.role === 'user' || m.role === 'assistant')
      .map((m) => ({ role: m.role as 'user' | 'assistant', content: m.content }))

    // ── SSE response headers ─────────────────────────────────────────────────
    // reply.raw.writeHead bypasses Fastify's onSend hooks (including @fastify/cors),
    // so CORS headers must be added manually here for the browser to accept the stream.
    const requestOrigin = request.headers.origin
    reply.raw.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
      ...(requestOrigin && {
        'Access-Control-Allow-Origin': requestOrigin,
        'Access-Control-Allow-Credentials': 'true',
      }),
    })

    const sendEvent = (event: Record<string, unknown>) => {
      try {
        reply.raw.write(`data: ${JSON.stringify(event)}\n\n`)
      } catch {
        // Client already disconnected — ignore write error
      }
    }

    // Abort controller tied to client disconnect
    const abortCtrl = new AbortController()
    request.raw.on('close', () => {
      abortCtrl.abort()
    })

    // Heartbeat to keep connection alive — cleared on disconnect or completion
    const heartbeat = setInterval(() => {
      if (abortCtrl.signal.aborted) {
        clearInterval(heartbeat)
        return
      }
      try {
        reply.raw.write(': heartbeat\n\n')
      } catch {
        clearInterval(heartbeat)
      }
    }, 15_000)

    try {
      await sandbox.ensureAgentUser(sessionId, agentRunId)
      // Pre-create the output directory so bash_execute / write_file
      // can use the workdir without a "no such directory" error.
      const workdir = sandbox.agentWorkdir(sessionId, agentRunId)
      await sandbox.exec(`mkdir -p ${JSON.stringify(workdir + '/output')}`)
    } catch (err) {
      fastify.log.warn({ err }, 'ensureAgentUser / workdir init failed — continuing anyway')
    }

    try {
      const runner = new AgentRunner()
      let assistantContent = ''

      for await (const event of runner.run({
        sessionId,
        agentRunId,
        role: 'orchestrator',
        userMessage: userMessageForAgent,
        inputFiles,
        sandbox,
        signal: abortCtrl.signal,
        conversationHistory,
      })) {
        if (abortCtrl.signal.aborted) break

        dispatchEvent(event, sendEvent)

        if (event.type === 'thinking') {
          assistantContent += event.delta
        }

        if (event.type === 'completed') {
          assistantContent = event.result

          const assistantMsgId = randomUUID()
          await db.insert(messages).values({
            id: assistantMsgId,
            sessionId,
            role: 'assistant',
            content: assistantContent,
            metadata: { agentRunId },
          })

          // Send the server-assigned message ID so the client can use the same
          // UUID — this allows the merge logic to match local enrichment
          // (thinkingContent, toolCalls, subAgents) with the server record.
          sendEvent({ type: 'completed', message: event.result, tokensUsed: event.tokensUsed, messageId: assistantMsgId })
          sendEvent({ type: 'done' })
        }

        if (event.type === 'error') {
          // Only send a safe error message — never expose internal details
          sendEvent({ type: 'error', message: 'Analysis failed. Please try again.' })
        }
      }
    } catch (err) {
      fastify.log.error({ err, sessionId, agentRunId }, 'AgentRunner error')
      const isKnown = err instanceof AppError
      sendEvent({
        type: 'error',
        message: isKnown ? (err as AppError).message : 'An unexpected error occurred.',
      })
    } finally {
      clearInterval(heartbeat)
      reply.raw.end()
    }
  })
}

function dispatchEvent(
  event: AgentEvent,
  send: (e: Record<string, unknown>) => void,
): void {
  switch (event.type) {
    case 'thinking':
      send({ type: 'thinking', content: event.delta })
      break
    case 'text_delta':
      send({ type: 'text_delta', content: event.delta })
      break
    case 'tool_use':
      send({ type: 'tool_use', tool: event.toolName, toolUseId: event.toolUseId, input: event.input })
      break
    case 'tool_result':
      send({
        type: 'tool_result',
        toolUseId: event.toolUseId,
        tool: event.toolName,
        success: event.success,
        output: event.output.slice(0, 2000),
      })
      break
    case 'sub_agent_spawned':
      send({ type: 'sub_agent_spawned', agentId: event.agentId, role: event.role, task: event.task })
      break
    // ── Sub-agent live event forwarding ──────────────────────────────────
    case 'sub_agent_thinking':
      send({ type: 'sub_agent_thinking', agentId: event.agentId, content: event.delta })
      break
    case 'sub_agent_text_delta':
      send({ type: 'sub_agent_text_delta', agentId: event.agentId, content: event.delta })
      break
    case 'sub_agent_tool_use':
      send({
        type: 'sub_agent_tool_use',
        agentId: event.agentId,
        tool: event.toolName,
        toolUseId: event.toolUseId,
        input: event.input,
      })
      break
    case 'sub_agent_tool_result':
      send({
        type: 'sub_agent_tool_result',
        agentId: event.agentId,
        toolUseId: event.toolUseId,
        tool: event.toolName,
        success: event.success,
        output: event.output.slice(0, 2000),
      })
      break
    case 'sub_agent_completed':
      send({
        type: 'sub_agent_completed',
        agentId: event.agentId,
        result: event.result.slice(0, 8000),
        tokensUsed: event.tokensUsed,
        success: event.success,
        error: event.error,
      })
      break
    case 'completed':
      send({ type: 'completed', message: event.result, tokensUsed: event.tokensUsed })
      break
    case 'error':
      // Error payload already sent above — skip here to avoid double-send
      break
  }
}