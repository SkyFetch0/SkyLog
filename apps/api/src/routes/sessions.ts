import type { FastifyInstance } from 'fastify'
import { eq, and, desc } from 'drizzle-orm'
import { randomUUID } from 'crypto'
import { z } from 'zod'
import { db } from '../db/index.js'
import { sessions, messages, files, agentRuns } from '../db/schema.js'
import { sandbox } from '../sandbox.js'

const createSessionSchema = z.object({
  title: z.string().min(1).max(200).optional().default('New Session'),
})

export default async function sessionRoutes(fastify: FastifyInstance) {
  const auth = { onRequest: [fastify.authenticate] }

  // ── GET /sessions ────────────────────────────────────────────────────────────
  fastify.get('/sessions', auth, async (request, reply) => {
    const { sub } = request.user as { sub: string }

    const list = await db
      .select()
      .from(sessions)
      .where(eq(sessions.userId, sub))
      .orderBy(desc(sessions.updatedAt))

    return reply.send({ sessions: list })
  })

  // ── POST /sessions ───────────────────────────────────────────────────────────
  fastify.post('/sessions', auth, async (request, reply) => {
    const { sub } = request.user as { sub: string }

    const body = createSessionSchema.safeParse(request.body)
    if (!body.success) {
      return reply.status(400).send({ error: 'Validation failed', issues: body.error.issues })
    }

    const id = randomUUID()

    const [session] = await db
      .insert(sessions)
      .values({ id, userId: sub, title: body.data.title })
      .returning()

    // Create uploads directory in sandbox (fire-and-forget — don't block response)
    sandbox.ensureUploadsDir(id).catch((err) => {
      fastify.log.warn({ err, sessionId: id }, 'Failed to create sandbox uploads dir')
    })

    return reply.status(201).send({ session })
  })

  // ── GET /sessions/:id ────────────────────────────────────────────────────────
  fastify.get('/sessions/:id', auth, async (request, reply) => {
    const { sub } = request.user as { sub: string }
    const { id } = request.params as { id: string }

    const [session] = await db
      .select()
      .from(sessions)
      .where(and(eq(sessions.id, id), eq(sessions.userId, sub)))
      .limit(1)

    if (!session) return reply.status(404).send({ error: 'Session not found' })

    const [sessionMessages, sessionFiles, runs] = await Promise.all([
      db.select().from(messages).where(eq(messages.sessionId, id)).orderBy(messages.createdAt),
      db.select().from(files).where(eq(files.sessionId, id)).orderBy(files.createdAt),
      db
        .select()
        .from(agentRuns)
        .where(and(eq(agentRuns.sessionId, id)))
        .orderBy(desc(agentRuns.startedAt))
        .limit(20),
    ])

    return reply.send({ session, messages: sessionMessages, files: sessionFiles, agentRuns: runs })
  })

  // ── DELETE /sessions/:id ─────────────────────────────────────────────────────
  fastify.delete('/sessions/:id', auth, async (request, reply) => {
    const { sub } = request.user as { sub: string }
    const { id } = request.params as { id: string }

    const [session] = await db
      .select()
      .from(sessions)
      .where(and(eq(sessions.id, id), eq(sessions.userId, sub)))
      .limit(1)

    if (!session) return reply.status(404).send({ error: 'Session not found' })

    await db.delete(sessions).where(eq(sessions.id, id))

    // Remove sandbox workspace (fire-and-forget)
    sandbox.removeSessionWorkspace(id).catch((err) => {
      fastify.log.warn({ err, sessionId: id }, 'Failed to remove sandbox workspace')
    })

    return reply.status(204).send()
  })
}