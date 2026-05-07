import type { FastifyInstance } from 'fastify'
import { eq, and, isNull } from 'drizzle-orm'
import { db } from '../db/index.js'
import { agentRuns, toolCalls, sessions } from '../db/schema.js'

export default async function agentRoutes(fastify: FastifyInstance) {
  const auth = { onRequest: [fastify.authenticate] }

  // ── GET /sessions/:id/agent-runs  (tree: orchestrator → sub-agents) ──────────
  fastify.get('/sessions/:id/agent-runs', auth, async (request, reply) => {
    const { sub } = request.user as { sub: string }
    const { id: sessionId } = request.params as { id: string }

    const [session] = await db
      .select()
      .from(sessions)
      .where(and(eq(sessions.id, sessionId), eq(sessions.userId, sub)))
      .limit(1)

    if (!session) return reply.status(404).send({ error: 'Session not found' })

    const allRuns = await db
      .select()
      .from(agentRuns)
      .where(eq(agentRuns.sessionId, sessionId))
      .orderBy(agentRuns.startedAt)

    // Build tree: orchestrators at root, children nested
    const runMap = new Map(allRuns.map((r) => [r.id, { ...r, children: [] as typeof allRuns }]))

    const roots: Array<(typeof allRuns)[0] & { children: typeof allRuns }> = []

    for (const run of allRuns) {
      const node = runMap.get(run.id)!
      if (run.parentRunId && runMap.has(run.parentRunId)) {
        runMap.get(run.parentRunId)!.children.push(node as never)
      } else {
        roots.push(node)
      }
    }

    return reply.send({ agentRuns: roots })
  })

  // ── GET /agent-runs/:id ───────────────────────────────────────────────────────
  fastify.get('/agent-runs/:id', auth, async (request, reply) => {
    const { sub } = request.user as { sub: string }
    const { id } = request.params as { id: string }

    const result = await db
      .select({ run: agentRuns, session: sessions })
      .from(agentRuns)
      .innerJoin(sessions, eq(agentRuns.sessionId, sessions.id))
      .where(and(eq(agentRuns.id, id), eq(sessions.userId, sub)))
      .limit(1)

    if (result.length === 0) return reply.status(404).send({ error: 'Agent run not found' })

    const { run } = result[0]

    const calls = await db
      .select()
      .from(toolCalls)
      .where(eq(toolCalls.agentRunId, id))
      .orderBy(toolCalls.createdAt)

    return reply.send({ agentRun: run, toolCalls: calls })
  })

  // ── GET /agent-runs/:id/conversation  (debug: full message history) ──────────
  fastify.get('/agent-runs/:id/conversation', auth, async (request, reply) => {
    const { sub } = request.user as { sub: string }
    const { id } = request.params as { id: string }

    const result = await db
      .select({ run: agentRuns, session: sessions })
      .from(agentRuns)
      .innerJoin(sessions, eq(agentRuns.sessionId, sessions.id))
      .where(and(eq(agentRuns.id, id), eq(sessions.userId, sub)))
      .limit(1)

    if (result.length === 0) return reply.status(404).send({ error: 'Agent run not found' })

    const { run } = result[0]

    // Return stored result + all tool calls as conversation trace
    const calls = await db
      .select()
      .from(toolCalls)
      .where(eq(toolCalls.agentRunId, id))
      .orderBy(toolCalls.createdAt)

    return reply.send({
      agentRun: run,
      conversation: calls.map((c) => ({
        turn: 'tool',
        toolName: c.toolName,
        input: c.input,
        output: c.output,
        durationMs: c.durationMs,
        at: c.createdAt,
      })),
    })
  })
}