import type { FastifyInstance } from 'fastify'
import { eq, and, inArray } from 'drizzle-orm'
import { randomUUID } from 'crypto'
import { z } from 'zod'
import { db } from '../db/index.js'
import { sessions, messages, files, agentRuns } from '../db/schema.js'
import { sandbox } from '../sandbox.js'
import { AgentRunner } from '../agents/runner.js'
import type { AgentEvent } from '../agents/runner.js'

const sendMessageSchema = z.object({
  content: z.string().min(1).max(32_000),
  attachedFileIds: z.array(z.string().uuid()).optional().default([]),
})

export default async function chatRoutes(fastify: FastifyInstance) {
  const auth = { onRequest: [fastify.authenticate] }

  // ── POST /sessions/:id/messages (SSE stream) ──────────────────────────────────
  fastify.post('/sessions/:id/messages', auth, async (request, reply) => {
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

    // Persist user message
    const userMsgId = randomUUID()
    await db.insert(messages).values({
      id: userMsgId,
      sessionId,
      role: 'user',
      content,
      metadata: attachedFileIds.length > 0 ? { attachedFileIds } : null,
    })

    // Create orchestrator agent run record
    const agentRunId = randomUUID()
    const inputFiles = attachedFiles.map((f) => f.storagePath)

    const userMessageForAgent =
      attachedFiles.length > 0
        ? `${content}\n\nAttached files:\n${attachedFiles.map((f) => `- ${f.originalName} → ${f.storagePath}`).join('\n')}`
        : content

    await db.insert(agentRuns).values({
      id: agentRunId,
      sessionId,
      role: 'orchestrator',
      status: 'pending',
      task: content,
      inputRefs: inputFiles,
      workspacePath: sandbox.agentWorkdir(sessionId, agentRunId),
      tokensUsed: 0,
    })

    // Update session updatedAt
    await db.update(sessions).set({ updatedAt: new Date() }).where(eq(sessions.id, sessionId))

    // ── SSE response headers ─────────────────────────────────────────────────
    reply.raw.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    })

    const sendEvent = (event: Record<string, unknown>) => {
      reply.raw.write(`data: ${JSON.stringify(event)}\n\n`)
    }

    // Heartbeat to keep connection alive
    const heartbeat = setInterval(() => {
      reply.raw.write(': heartbeat\n\n')
    }, 15_000)

    // Ensure agent user exists in sandbox
    try {
      await sandbox.ensureAgentUser(sessionId, agentRunId)
    } catch (err) {
      fastify.log.warn({ err }, 'ensureAgentUser failed — continuing anyway')
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
      })) {
        await dispatchEvent(event, sendEvent)

        if (event.type === 'thinking') {
          assistantContent += event.delta
        }

        if (event.type === 'completed') {
          assistantContent = event.result

          // Persist assistant message
          await db.insert(messages).values({
            id: randomUUID(),
            sessionId,
            role: 'assistant',
            content: assistantContent,
            metadata: { agentRunId },
          })

          sendEvent({ type: 'done' })
        }

        if (event.type === 'error') {
          sendEvent({ type: 'error', message: event.message })
        }
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      fastify.log.error({ err }, 'AgentRunner error')
      sendEvent({ type: 'error', message })
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
    case 'tool_use':
      send({ type: 'tool_use', tool: event.toolName, toolUseId: event.toolUseId, input: event.input })
      break
    case 'tool_result':
      send({
        type: 'tool_result',
        toolUseId: event.toolUseId,
        tool: event.toolName,
        success: event.success,
        output: event.output.slice(0, 2000), // truncate for SSE
      })
      break
    case 'sub_agent_spawned':
      send({ type: 'sub_agent_spawned', agentId: event.agentId, role: event.role, task: event.task })
      break
    case 'completed':
      send({ type: 'completed', message: event.result, tokensUsed: event.tokensUsed })
      break
    case 'error':
      send({ type: 'error', message: event.message })
      break
  }
}