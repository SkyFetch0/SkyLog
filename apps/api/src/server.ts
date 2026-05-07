import Fastify from 'fastify'
import cors from '@fastify/cors'
import helmet from '@fastify/helmet'
import jwt from '@fastify/jwt'
import multipart from '@fastify/multipart'
import sensible from '@fastify/sensible'

import authRoutes from './routes/auth.js'
import sessionRoutes from './routes/sessions.js'
import fileRoutes from './routes/files.js'
import chatRoutes from './routes/chat.js'
import agentRoutes from './routes/agents.js'

declare module '@fastify/jwt' {
  interface FastifyJWT {
    payload: { sub: string; email: string }
    user: { sub: string; email: string }
  }
}

declare module 'fastify' {
  interface FastifyInstance {
    authenticate: (request: import('fastify').FastifyRequest, reply: import('fastify').FastifyReply) => Promise<void>
  }
}

export async function buildServer() {
  const fastify = Fastify({
    logger: {
      transport:
        process.env.NODE_ENV === 'development'
          ? { target: 'pino-pretty', options: { colorize: true } }
          : undefined,
    },
  })

  // ── Security plugins ─────────────────────────────────────────────────────────
  await fastify.register(helmet, {
    contentSecurityPolicy: false, // disabled for API-only server
  })

  await fastify.register(cors, {
    origin: process.env.CORS_ORIGIN ?? 'http://localhost:3000',
    credentials: true,
  })

  // ── Auth ─────────────────────────────────────────────────────────────────────
  await fastify.register(jwt, {
    secret: process.env.JWT_SECRET ?? 'change_me_in_production',
    sign: { expiresIn: '7d' },
  })

  fastify.decorate('authenticate', async function (request, reply) {
    try {
      await request.jwtVerify()
    } catch (err) {
      reply.status(401).send({ error: 'Unauthorized' })
    }
  })

  // ── Multipart (file uploads) ──────────────────────────────────────────────────
  await fastify.register(multipart, {
    limits: {
      fileSize: 500 * 1024 * 1024, // 500 MB
      files: 1,
    },
  })

  // ── Sensible (error helpers) ──────────────────────────────────────────────────
  await fastify.register(sensible)

  // ── Health check ─────────────────────────────────────────────────────────────
  fastify.get('/health', async () => ({
    status: 'ok',
    timestamp: new Date().toISOString(),
    version: process.env.npm_package_version ?? '0.1.0',
  }))

  // ── Routes ───────────────────────────────────────────────────────────────────
  await fastify.register(authRoutes, { prefix: '/api/auth' })
  await fastify.register(sessionRoutes, { prefix: '/api' })
  await fastify.register(fileRoutes, { prefix: '/api' })
  await fastify.register(chatRoutes, { prefix: '/api' })
  await fastify.register(agentRoutes, { prefix: '/api' })

  // ── Global error handler ──────────────────────────────────────────────────────
  fastify.setErrorHandler((error: import('fastify').FastifyError, _request, reply) => {
    fastify.log.error(error)

    if (error.validation) {
      return reply.status(400).send({ error: 'Validation error', details: error.validation })
    }

    const statusCode = error.statusCode ?? 500
    return reply.status(statusCode).send({
      error: statusCode === 500 ? 'Internal server error' : error.message,
    })
  })

  return fastify
}