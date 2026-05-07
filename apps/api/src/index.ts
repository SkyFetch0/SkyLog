import Fastify from 'fastify'
import { TypeBoxTypeProvider } from '@fastify/type-provider-typebox'
import cors from '@fastify/cors'
import helmet from '@fastify/helmet'
import sensible from '@fastify/sensible'

const server = Fastify({
  logger: {
    transport:
      process.env.NODE_ENV === 'development'
        ? { target: 'pino-pretty', options: { colorize: true } }
        : undefined,
  },
}).withTypeProvider<TypeBoxTypeProvider>()

async function bootstrap() {
  await server.register(helmet)
  await server.register(cors, {
    origin: process.env.CORS_ORIGIN ?? 'http://localhost:3000',
  })
  await server.register(sensible)

  server.get('/health', async () => ({ status: 'ok', timestamp: new Date().toISOString() }))

  // TODO: register route plugins here
  // await server.register(import('./routes/logs'), { prefix: '/api/logs' })

  await server.listen({
    port: Number(process.env.API_PORT ?? 3001),
    host: process.env.API_HOST ?? '0.0.0.0',
  })
}

bootstrap().catch((err) => {
  server.log.error(err)
  process.exit(1)
})