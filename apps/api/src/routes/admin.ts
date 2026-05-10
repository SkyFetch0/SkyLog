import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { eq, desc, sql, and, gte, ne } from 'drizzle-orm'
import { db } from '../db/index.js'
import { users, sessions, messages, agentRuns, toolCalls, files } from '../db/schema.js'
import { sandbox } from '../sandbox.js'

const updateRoleSchema = z.object({
  role: z.enum(['user', 'admin']),
})

const listUsersQuery = z.object({
  search: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(200).optional().default(50),
  offset: z.coerce.number().int().min(0).optional().default(0),
})

export default async function adminRoutes(fastify: FastifyInstance) {
  const auth = { onRequest: [fastify.requireAdmin] }

  // ── GET /admin/stats ─────────────────────────────────────────────────────
  // Dashboard kartları için tek atışta agregat sayılar.
  fastify.get('/stats', auth, async (_request, reply) => {
    const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000)
    const since7d = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)

    const [userCount] = await db.select({ c: sql<number>`count(*)::int` }).from(users)
    const [sessionCount] = await db.select({ c: sql<number>`count(*)::int` }).from(sessions)
    const [messageCount] = await db.select({ c: sql<number>`count(*)::int` }).from(messages)
    const [fileCount] = await db.select({ c: sql<number>`count(*)::int` }).from(files)

    const [tokens] = await db
      .select({ total: sql<number>`coalesce(sum(${agentRuns.tokensUsed}),0)::bigint` })
      .from(agentRuns)

    const [tokens24h] = await db
      .select({ total: sql<number>`coalesce(sum(${agentRuns.tokensUsed}),0)::bigint` })
      .from(agentRuns)
      .where(gte(agentRuns.startedAt, since24h))

    const [activeUsers7d] = await db
      .select({ c: sql<number>`count(distinct ${sessions.userId})::int` })
      .from(sessions)
      .where(gte(sessions.updatedAt, since7d))

    const [activeRuns] = await db
      .select({ c: sql<number>`count(*)::int` })
      .from(agentRuns)
      .where(eq(agentRuns.status, 'running'))

    const [failedRuns24h] = await db
      .select({ c: sql<number>`count(*)::int` })
      .from(agentRuns)
      .where(and(eq(agentRuns.status, 'failed'), gte(agentRuns.startedAt, since24h)))

    return reply.send({
      users: userCount.c,
      sessions: sessionCount.c,
      messages: messageCount.c,
      files: fileCount.c,
      tokensTotal: Number(tokens.total),
      tokens24h: Number(tokens24h.total),
      activeUsers7d: activeUsers7d.c,
      activeRuns: activeRuns.c,
      failedRuns24h: failedRuns24h.c,
    })
  })

  // ── GET /admin/users ─────────────────────────────────────────────────────
  fastify.get('/users', auth, async (request, reply) => {
    const q = listUsersQuery.safeParse(request.query)
    if (!q.success) {
      return reply.status(400).send({ error: 'Invalid query', issues: q.error.issues })
    }

    const search = q.data.search?.trim().toLowerCase() ?? ''

    // Drizzle'da count + sessionCount sub-query ile birlikte tek istek
    const list = await db
      .select({
        id: users.id,
        email: users.email,
        role: users.role,
        createdAt: users.createdAt,
        sessionCount: sql<number>`(SELECT count(*)::int FROM ${sessions} WHERE ${sessions.userId} = ${users.id})`,
      })
      .from(users)
      .where(search ? sql`lower(${users.email}) LIKE ${'%' + search + '%'}` : sql`true`)
      .orderBy(desc(users.createdAt))
      .limit(q.data.limit)
      .offset(q.data.offset)

    const [total] = await db
      .select({ c: sql<number>`count(*)::int` })
      .from(users)
      .where(search ? sql`lower(${users.email}) LIKE ${'%' + search + '%'}` : sql`true`)

    return reply.send({ users: list, total: total.c })
  })

  // ── PATCH /admin/users/:id/role ──────────────────────────────────────────
  // Promote / demote. Admin kendi rolünü değiştiremez (kendini lockout'a karşı).
  fastify.patch<{ Params: { id: string } }>('/users/:id/role', auth, async (request, reply) => {
    const { sub } = request.user as { sub: string }
    const { id } = request.params

    if (id === sub) {
      return reply.status(400).send({ error: 'You cannot change your own role' })
    }

    const body = updateRoleSchema.safeParse(request.body)
    if (!body.success) {
      return reply.status(400).send({ error: 'Validation failed', issues: body.error.issues })
    }

    const [target] = await db.select().from(users).where(eq(users.id, id)).limit(1)
    if (!target) return reply.status(404).send({ error: 'User not found' })

    // En az bir admin kalmasını garantile (başkasını demote ediyorsak)
    if (target.role === 'admin' && body.data.role === 'user') {
      const [{ c }] = await db
        .select({ c: sql<number>`count(*)::int` })
        .from(users)
        .where(and(eq(users.role, 'admin'), ne(users.id, id)))
      if (c === 0) {
        return reply.status(400).send({ error: 'Cannot demote the last admin' })
      }
    }

    const [updated] = await db
      .update(users)
      .set({ role: body.data.role })
      .where(eq(users.id, id))
      .returning({ id: users.id, email: users.email, role: users.role })

    return reply.send({ user: updated })
  })

  // ── DELETE /admin/users/:id ──────────────────────────────────────────────
  // Cascade: tüm session/file/message/agentRun/toolCall otomatik silinir.
  fastify.delete<{ Params: { id: string } }>('/users/:id', auth, async (request, reply) => {
    const { sub } = request.user as { sub: string }
    const { id } = request.params

    if (id === sub) {
      return reply.status(400).send({ error: 'You cannot delete your own account here. Use Settings → Account.' })
    }

    const [target] = await db.select().from(users).where(eq(users.id, id)).limit(1)
    if (!target) return reply.status(404).send({ error: 'User not found' })

    // Son adminse silmeyi engelle
    if (target.role === 'admin') {
      const [{ c }] = await db
        .select({ c: sql<number>`count(*)::int` })
        .from(users)
        .where(and(eq(users.role, 'admin'), ne(users.id, id)))
      if (c === 0) {
        return reply.status(400).send({ error: 'Cannot delete the last admin' })
      }
    }

    await db.delete(users).where(eq(users.id, id))
    return reply.status(204).send()
  })

  // ── GET /admin/sessions ──────────────────────────────────────────────────
  // Tüm session'lar — admin için global görünüm. Email join.
  fastify.get('/sessions', auth, async (request, reply) => {
    const limit = Math.min(200, Number((request.query as { limit?: string })?.limit ?? 50))
    const offset = Math.max(0, Number((request.query as { offset?: string })?.offset ?? 0))

    const list = await db
      .select({
        id: sessions.id,
        title: sessions.title,
        createdAt: sessions.createdAt,
        updatedAt: sessions.updatedAt,
        userId: sessions.userId,
        userEmail: users.email,
        messageCount: sql<number>`(SELECT count(*)::int FROM ${messages} WHERE ${messages.sessionId} = ${sessions.id})`,
      })
      .from(sessions)
      .innerJoin(users, eq(sessions.userId, users.id))
      .orderBy(desc(sessions.updatedAt))
      .limit(limit)
      .offset(offset)

    const [total] = await db.select({ c: sql<number>`count(*)::int` }).from(sessions)

    return reply.send({ sessions: list, total: total.c })
  })

  // ── GET /admin/agent-runs/recent ─────────────────────────────────────────
  fastify.get('/agent-runs/recent', auth, async (_request, reply) => {
    const list = await db
      .select({
        id: agentRuns.id,
        sessionId: agentRuns.sessionId,
        role: agentRuns.role,
        status: agentRuns.status,
        task: agentRuns.task,
        tokensUsed: agentRuns.tokensUsed,
        startedAt: agentRuns.startedAt,
        completedAt: agentRuns.completedAt,
        userEmail: users.email,
      })
      .from(agentRuns)
      .innerJoin(sessions, eq(agentRuns.sessionId, sessions.id))
      .innerJoin(users, eq(sessions.userId, users.id))
      .orderBy(desc(agentRuns.startedAt))
      .limit(50)

    return reply.send({ agentRuns: list })
  })

  // ── GET /admin/health ────────────────────────────────────────────────────
  // Sandbox + DB ping + tool-call istatistikleri
  fastify.get('/health', auth, async (_request, reply) => {
    let sandboxOk = false
    try {
      sandboxOk = await sandbox.ping()
    } catch {
      sandboxOk = false
    }

    let dbOk = false
    try {
      await db.execute(sql`SELECT 1`)
      dbOk = true
    } catch {
      dbOk = false
    }

    const [toolCallCount] = await db.select({ c: sql<number>`count(*)::int` }).from(toolCalls)
    const [avgDuration] = await db
      .select({
        avg: sql<number>`coalesce(avg(${toolCalls.durationMs}),0)::int`,
      })
      .from(toolCalls)

    return reply.send({
      sandbox: sandboxOk ? 'ok' : 'error',
      database: dbOk ? 'ok' : 'error',
      toolCalls: toolCallCount.c,
      avgToolDurationMs: avgDuration.avg,
      timestamp: new Date().toISOString(),
    })
  })
}
