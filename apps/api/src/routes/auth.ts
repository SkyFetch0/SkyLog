import type { FastifyInstance } from 'fastify'
import bcrypt from 'bcrypt'
import { z } from 'zod'
import { eq } from 'drizzle-orm'
import { randomUUID } from 'crypto'
import { db } from '../db/index.js'
import { users } from '../db/schema.js'

const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
})

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
})

const SALT_ROUNDS = 12

export default async function authRoutes(fastify: FastifyInstance) {
  // ── POST /auth/register ──────────────────────────────────────────────────────
  fastify.post('/register', async (request, reply) => {
    const body = registerSchema.safeParse(request.body)
    if (!body.success) {
      return reply.status(400).send({ error: 'Validation failed', issues: body.error.issues })
    }

    const { email, password } = body.data

    const existing = await db.select().from(users).where(eq(users.email, email)).limit(1)
    if (existing.length > 0) {
      return reply.status(409).send({ error: 'Email already registered' })
    }

    const passwordHash = await bcrypt.hash(password, SALT_ROUNDS)
    const [user] = await db
      .insert(users)
      .values({ id: randomUUID(), email, passwordHash })
      .returning({ id: users.id, email: users.email, createdAt: users.createdAt })

    const token = fastify.jwt.sign({ sub: user.id, email: user.email })
    return reply.status(201).send({ token, user })
  })

  // ── POST /auth/login ─────────────────────────────────────────────────────────
  fastify.post('/login', async (request, reply) => {
    const body = loginSchema.safeParse(request.body)
    if (!body.success) {
      return reply.status(400).send({ error: 'Validation failed', issues: body.error.issues })
    }

    const { email, password } = body.data

    const [user] = await db.select().from(users).where(eq(users.email, email)).limit(1)
    if (!user) {
      return reply.status(401).send({ error: 'Invalid credentials' })
    }

    const valid = await bcrypt.compare(password, user.passwordHash)
    if (!valid) {
      return reply.status(401).send({ error: 'Invalid credentials' })
    }

    const token = fastify.jwt.sign({ sub: user.id, email: user.email })
    return reply.send({
      token,
      user: { id: user.id, email: user.email, createdAt: user.createdAt },
    })
  })

  // ── GET /auth/me ─────────────────────────────────────────────────────────────
  fastify.get('/me', { onRequest: [fastify.authenticate] }, async (request, reply) => {
    const { sub } = request.user as { sub: string; email: string }

    const [user] = await db
      .select({ id: users.id, email: users.email, createdAt: users.createdAt })
      .from(users)
      .where(eq(users.id, sub))
      .limit(1)

    if (!user) return reply.status(404).send({ error: 'User not found' })
    return reply.send({ user })
  })
}