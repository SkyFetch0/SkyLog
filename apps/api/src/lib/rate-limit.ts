import type { FastifyRequest, FastifyReply, preHandlerAsyncHookHandler } from 'fastify'

/**
 * Basit in-memory token bucket rate limiter.
 *
 * Tek-instance dağıtım için yeterli. Çoklu API instance'ı varsa
 * Redis tabanlı bir limiter (örn. @fastify/rate-limit + Redis store)
 * tercih edilmeli — şu an docker-compose.yml'de Redis var ama
 * uygulamada kullanılmıyor, gelecekte buraya entegre edilebilir.
 *
 * Anahtar: authenticated kullanıcılar için JWT subject (user id),
 * anonim istekler (login/register) için IP. Bu sayede tek
 * kullanıcı tüm IP'yi bloklamaz, ama brute-force IP-bazlı korunur.
 */

interface Bucket {
  count: number
  resetAt: number
}

interface RateLimitOptions {
  /** Pencere boyutu (ms). */
  windowMs: number
  /** Pencere içinde izin verilen max istek sayısı. */
  max: number
  /** Anahtar üretimi — default: authenticated user id veya IP */
  keyGenerator?: (req: FastifyRequest) => string
  /** Hata mesajı */
  message?: string
}

function defaultKey(req: FastifyRequest): string {
  // request.user JWT verify olmuşsa varsa kullanılır.
  const sub = (req.user as { sub?: string } | undefined)?.sub
  if (sub) return `u:${sub}`
  return `ip:${req.ip}`
}

export function createRateLimit(opts: RateLimitOptions): preHandlerAsyncHookHandler {
  const buckets = new Map<string, Bucket>()
  const keyGen = opts.keyGenerator ?? defaultKey
  const message = opts.message ?? 'Too many requests'

  // Gelişigüzel temizlik: 5 dakikada bir geçmiş bucket'ları sil (memory leak önle).
  setInterval(() => {
    const now = Date.now()
    for (const [k, b] of buckets) {
      if (b.resetAt <= now) buckets.delete(k)
    }
  }, 5 * 60_000).unref?.()

  return async function rateLimitHook(request: FastifyRequest, reply: FastifyReply) {
    const key = keyGen(request)
    const now = Date.now()
    const existing = buckets.get(key)

    if (!existing || existing.resetAt <= now) {
      buckets.set(key, { count: 1, resetAt: now + opts.windowMs })
      return
    }

    if (existing.count >= opts.max) {
      const retryAfterSecs = Math.ceil((existing.resetAt - now) / 1000)
      reply.header('Retry-After', String(retryAfterSecs))
      reply.header('X-RateLimit-Limit', String(opts.max))
      reply.header('X-RateLimit-Remaining', '0')
      reply.header('X-RateLimit-Reset', String(Math.floor(existing.resetAt / 1000)))
      return reply.status(429).send({
        error: message,
        code: 'RATE_LIMITED',
        retryAfterSeconds: retryAfterSecs,
      })
    }

    existing.count++
    reply.header('X-RateLimit-Limit', String(opts.max))
    reply.header('X-RateLimit-Remaining', String(opts.max - existing.count))
    reply.header('X-RateLimit-Reset', String(Math.floor(existing.resetAt / 1000)))
  }
}
