import type { FastifyReply } from 'fastify'

// ── User-facing error codes ──────────────────────────────────────────────────

export class AppError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number = 500,
    public readonly code?: string,
  ) {
    super(message)
    this.name = 'AppError'
  }
}

export class NotFoundError extends AppError {
  constructor(resource = 'Resource') {
    super(`${resource} not found`, 404, 'NOT_FOUND')
  }
}

export class UnauthorizedError extends AppError {
  constructor(message = 'Unauthorized') {
    super(message, 401, 'UNAUTHORIZED')
  }
}

export class RateLimitError extends AppError {
  constructor(retryAfterSecs?: number) {
    super(
      retryAfterSecs
        ? `API rate limit reached. Retry after ${retryAfterSecs}s.`
        : 'API rate limit reached. Please wait before retrying.',
      429,
      'RATE_LIMITED',
    )
  }
}

export class SandboxTimeoutError extends AppError {
  constructor(toolName: string, timeoutMs: number) {
    super(
      `Sandbox tool "${toolName}" timed out after ${timeoutMs}ms. The log file may be too large.`,
      504,
      'SANDBOX_TIMEOUT',
    )
  }
}

export class SandboxUnavailableError extends AppError {
  constructor() {
    super(
      'Sandbox container is not running. Start it with: docker compose up -d sandbox',
      503,
      'SANDBOX_UNAVAILABLE',
    )
  }
}

// ── Anthropic error detection ─────────────────────────────────────────────────

export function isAnthropicRateLimit(err: unknown): boolean {
  if (typeof err !== 'object' || !err) return false
  const e = err as Record<string, unknown>
  return (
    (e.status === 429 || e.statusCode === 429) ||
    (typeof e.message === 'string' && e.message.toLowerCase().includes('rate limit'))
  )
}

export function isAnthropicOverloaded(err: unknown): boolean {
  if (typeof err !== 'object' || !err) return false
  const e = err as Record<string, unknown>
  return e.status === 529 || e.statusCode === 529
}

export function anthropicRetryAfter(err: unknown): number | undefined {
  if (typeof err !== 'object' || !err) return undefined
  const e = err as Record<string, unknown>
  const headers = e.headers as Record<string, string> | undefined
  if (!headers) return undefined
  const ra = headers['retry-after'] ?? headers['x-ratelimit-reset-requests']
  return ra ? parseInt(ra, 10) : undefined
}

// ── Reply helpers ─────────────────────────────────────────────────────────────

export function replyError(
  reply: FastifyReply,
  err: unknown,
  defaultMessage = 'Internal server error',
): FastifyReply {
  if (err instanceof AppError) {
    return reply.status(err.statusCode).send({
      error: err.message,
      code: err.code,
    })
  }

  if (isAnthropicRateLimit(err)) {
    const retryAfter = anthropicRetryAfter(err)
    const msg = retryAfter
      ? `Anthropic rate limit. Retry after ${retryAfter}s.`
      : 'Anthropic rate limit reached. Please wait a moment.'
    return reply.status(429).send({ error: msg, code: 'ANTHROPIC_RATE_LIMITED' })
  }

  if (isAnthropicOverloaded(err)) {
    return reply.status(503).send({
      error: 'Anthropic API is temporarily overloaded. Please retry in a few seconds.',
      code: 'ANTHROPIC_OVERLOADED',
    })
  }

  return reply.status(500).send({ error: defaultMessage })
}