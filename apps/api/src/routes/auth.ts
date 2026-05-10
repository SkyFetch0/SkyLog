import type { FastifyInstance } from 'fastify'
import bcrypt from 'bcrypt'
import { z } from 'zod'
import { eq, sql } from 'drizzle-orm'
import { randomUUID } from 'crypto'
import { db } from '../db/index.js'
import { users } from '../db/schema.js'
import { createRateLimit } from '../lib/rate-limit.js'

// Anonim istekler IP-bazlı limit'lenir; brute-force koruması.
// Login: 10/dk, Register: 5/dk per IP
const loginRateLimit = createRateLimit({
  windowMs: 60_000,
  max: 10,
  message: 'Too many login attempts. Please wait a minute.',
  keyGenerator: (req) => `login:${req.ip}`,
})
const registerRateLimit = createRateLimit({
  windowMs: 60_000,
  max: 5,
  message: 'Too many registration attempts. Please wait a minute.',
  keyGenerator: (req) => `register:${req.ip}`,
})

const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
})

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
})

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(8),
})

const deleteAccountSchema = z.object({
  password: z.string().min(1),
})

const SALT_ROUNDS = 12

export default async function authRoutes(fastify: FastifyInstance) {
  // ── POST /auth/register ──────────────────────────────────────────────────────
  fastify.post('/register', { preHandler: registerRateLimit }, async (request, reply) => {
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

    // Bootstrap: if this is the first user in the DB, promote to admin.
    // Single-tenant self-hosted setup için pratik default.
    // Race condition: iki kullanıcı tam aynı anda kayıt olursa ikisi de
    // admin olabilir — kabul edilebilir bir risk (sadece bootstrap senaryosu).
    const [{ count }] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(users)
    const role: 'admin' | 'user' = count === 0 ? 'admin' : 'user'

    const [user] = await db
      .insert(users)
      .values({ id: randomUUID(), email, passwordHash, role })
      .returning({
        id: users.id,
        email: users.email,
        role: users.role,
        createdAt: users.createdAt,
      })

    const token = fastify.jwt.sign({ sub: user.id, email: user.email })
    return reply.status(201).send({ token, user })
  })

  // ── POST /auth/login ─────────────────────────────────────────────────────────
  fastify.post('/login', { preHandler: loginRateLimit }, async (request, reply) => {
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
      user: { id: user.id, email: user.email, role: user.role, createdAt: user.createdAt },
    })
  })

  // ── GET /auth/me ─────────────────────────────────────────────────────────────
  fastify.get('/me', { onRequest: [fastify.authenticate] }, async (request, reply) => {
    const { sub } = request.user as { sub: string; email: string }

    const [user] = await db
      .select({
        id: users.id,
        email: users.email,
        role: users.role,
        createdAt: users.createdAt,
      })
      .from(users)
      .where(eq(users.id, sub))
      .limit(1)

    if (!user) return reply.status(404).send({ error: 'User not found' })
    return reply.send({ user })
  })

  // ── PATCH /auth/password ─────────────────────────────────────────────────────
  // Authenticated kullanıcının kendi şifresini değiştirir.
  // currentPassword zorunlu — token çalan saldırgan şifre değiştiremesin.
  fastify.patch('/password', { onRequest: [fastify.authenticate] }, async (request, reply) => {
    const { sub } = request.user as { sub: string }

    const body = changePasswordSchema.safeParse(request.body)
    if (!body.success) {
      return reply.status(400).send({ error: 'Validation failed', issues: body.error.issues })
    }

    const { currentPassword, newPassword } = body.data

    const [user] = await db.select().from(users).where(eq(users.id, sub)).limit(1)
    if (!user) return reply.status(404).send({ error: 'User not found' })

    const valid = await bcrypt.compare(currentPassword, user.passwordHash)
    if (!valid) return reply.status(401).send({ error: 'Current password is incorrect' })

    if (currentPassword === newPassword) {
      return reply.status(400).send({ error: 'New password must be different from current' })
    }

    const newHash = await bcrypt.hash(newPassword, SALT_ROUNDS)
    await db.update(users).set({ passwordHash: newHash }).where(eq(users.id, sub))

    return reply.send({ ok: true })
  })

  // ── DELETE /auth/me ──────────────────────────────────────────────────────────
  // Hesabı kalıcı olarak sil. Şifre teyidi zorunlu.
  // Cascade sayesinde sessions/messages/files/agentRuns/toolCalls otomatik silinir.
  fastify.delete('/me', { onRequest: [fastify.authenticate] }, async (request, reply) => {
    const { sub } = request.user as { sub: string }

    const body = deleteAccountSchema.safeParse(request.body)
    if (!body.success) {
      return reply.status(400).send({ error: 'Validation failed', issues: body.error.issues })
    }

    const [user] = await db.select().from(users).where(eq(users.id, sub)).limit(1)
    if (!user) return reply.status(404).send({ error: 'User not found' })

    const valid = await bcrypt.compare(body.data.password, user.passwordHash)
    if (!valid) return reply.status(401).send({ error: 'Password is incorrect' })

    await db.delete(users).where(eq(users.id, sub))

    return reply.status(204).send()
  })
}