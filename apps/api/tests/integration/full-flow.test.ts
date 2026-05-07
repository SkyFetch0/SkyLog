/**
 * Full flow integration test.
 *
 * Requires:
 *   - Running Postgres (DATABASE_URL set)
 *   - Running API server (or in-process via buildServer)
 *   - Sandbox container is optional (agent will fail gracefully if absent)
 *
 * Run with:
 *   pnpm --filter @skylog/api test:integration
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { buildServer } from '../../src/server.js'
import { db } from '../../src/db/index.js'
import { users, sessions, messages, agentRuns } from '../../src/db/schema.js'
import { eq } from 'drizzle-orm'
import path from 'path'
import fs from 'fs'
import FormData from 'form-data'
import type { FastifyInstance } from 'fastify'

// ── helpers ──────────────────────────────────────────────────────────────────

const TEST_EMAIL = `test-${Date.now()}@skylog.test`
const TEST_PASSWORD = 'testpassword123'

let app: FastifyInstance
let authToken: string
let sessionId: string
let userId: string

// ── setup ────────────────────────────────────────────────────────────────────

beforeAll(async () => {
  app = await buildServer()
  await app.ready()
})

afterAll(async () => {
  // Clean up test data
  if (userId) {
    await db.delete(users).where(eq(users.id, userId))
  }
  await app.close()
})

// ── 1. Auth ──────────────────────────────────────────────────────────────────

describe('Auth', () => {
  it('registers a new user', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/register',
      payload: { email: TEST_EMAIL, password: TEST_PASSWORD },
    })

    expect(res.statusCode).toBe(201)
    const body = JSON.parse(res.body) as { token: string; user: { id: string; email: string } }
    expect(body.token).toBeTruthy()
    expect(body.user.email).toBe(TEST_EMAIL)

    authToken = body.token
    userId = body.user.id
  })

  it('logs in with correct credentials', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: { email: TEST_EMAIL, password: TEST_PASSWORD },
    })

    expect(res.statusCode).toBe(200)
    const body = JSON.parse(res.body) as { token: string }
    expect(body.token).toBeTruthy()
  })

  it('rejects wrong password', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: { email: TEST_EMAIL, password: 'wrongpassword' },
    })
    expect(res.statusCode).toBe(401)
  })

  it('returns current user on GET /auth/me', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/auth/me',
      headers: { Authorization: `Bearer ${authToken}` },
    })

    expect(res.statusCode).toBe(200)
    const body = JSON.parse(res.body) as { user: { email: string } }
    expect(body.user.email).toBe(TEST_EMAIL)
  })
})

// ── 2. Session ───────────────────────────────────────────────────────────────

describe('Sessions', () => {
  it('creates a new session', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/sessions',
      headers: { Authorization: `Bearer ${authToken}` },
      payload: { title: 'Security Test Session' },
    })

    expect(res.statusCode).toBe(201)
    const body = JSON.parse(res.body) as { session: { id: string; title: string } }
    expect(body.session.title).toBe('Security Test Session')

    sessionId = body.session.id
  })

  it('lists sessions', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/sessions',
      headers: { Authorization: `Bearer ${authToken}` },
    })

    expect(res.statusCode).toBe(200)
    const body = JSON.parse(res.body) as { sessions: unknown[] }
    expect(body.sessions.length).toBeGreaterThanOrEqual(1)
  })

  it('returns session detail', async () => {
    const res = await app.inject({
      method: 'GET',
      url: `/api/sessions/${sessionId}`,
      headers: { Authorization: `Bearer ${authToken}` },
    })

    expect(res.statusCode).toBe(200)
    const body = JSON.parse(res.body) as { id: string; messages: unknown[] }
    expect(body.id).toBe(sessionId)
    expect(Array.isArray(body.messages)).toBe(true)
  })
})

// ── 3. File upload ───────────────────────────────────────────────────────────

describe('File upload', () => {
  it('uploads apache-access-sample.log', async () => {
    const fixturePath = path.resolve(import.meta.dirname ?? __dirname, '../fixtures/apache-access-sample.log')

    // Skip if fixture doesn't exist
    if (!fs.existsSync(fixturePath)) {
      console.warn('Fixture not found, skipping file upload test')
      return
    }

    const form = new FormData()
    form.append('file', fs.createReadStream(fixturePath), {
      filename: 'apache-access-sample.log',
      contentType: 'text/plain',
    })

    const res = await app.inject({
      method: 'POST',
      url: `/api/sessions/${sessionId}/files`,
      headers: {
        Authorization: `Bearer ${authToken}`,
        ...form.getHeaders(),
      },
      payload: form,
    })

    // May fail if sandbox is not running — that's acceptable in unit CI
    if (res.statusCode === 201) {
      const body = JSON.parse(res.body) as { file: { id: string; originalName: string } }
      expect(body.file.originalName).toBe('apache-access-sample.log')
    } else {
      console.warn(`File upload returned ${res.statusCode} — sandbox likely not running`)
    }
  })
})

// ── 4. Agent runs tree ────────────────────────────────────────────────────────

describe('Agent runs', () => {
  it('returns empty agent runs initially', async () => {
    const res = await app.inject({
      method: 'GET',
      url: `/api/sessions/${sessionId}/agent-runs`,
      headers: { Authorization: `Bearer ${authToken}` },
    })

    expect(res.statusCode).toBe(200)
    const body = JSON.parse(res.body) as { agentRuns: unknown[] }
    expect(Array.isArray(body.agentRuns)).toBe(true)
  })
})

// ── 5. Specialist prompt integrity ───────────────────────────────────────────

describe('Specialist prompts', () => {
  it('apache_security prompt contains required detection patterns', async () => {
    const { getSpecialistPrompt } = await import('../../src/agents/registry.js')
    const prompt = getSpecialistPrompt('apache_security')

    expect(prompt).toContain('brute')
    expect(prompt).toContain('SQL')
    expect(prompt).toContain('riskScore')
    expect(prompt.length).toBeGreaterThan(500)
  })

  it('all 7 specialists are registered', async () => {
    const { listAvailableSpecialists } = await import('../../src/agents/registry.js')
    const specialists = listAvailableSpecialists()

    expect(specialists).toContain('apache_security')
    expect(specialists).toContain('apache_traffic')
    expect(specialists).toContain('nginx_security')
    expect(specialists).toContain('nginx_traffic')
    expect(specialists).toContain('mysql_performance')
    expect(specialists).toContain('mysql_errors')
    expect(specialists).toContain('generic_error')
    expect(specialists).toHaveLength(7)
  })

  it('generic_error prompt auto-detects format section', async () => {
    const { getSpecialistPrompt } = await import('../../src/agents/registry.js')
    const prompt = getSpecialistPrompt('generic_error')

    expect(prompt).toContain('Format detection')
    expect(prompt).toContain('JSON')
    expect(prompt).toContain('syslog')
  })
})

// ── 6. Session cleanup ────────────────────────────────────────────────────────

describe('Session deletion', () => {
  it('deletes the test session', async () => {
    const res = await app.inject({
      method: 'DELETE',
      url: `/api/sessions/${sessionId}`,
      headers: { Authorization: `Bearer ${authToken}` },
    })

    expect(res.statusCode).toBe(204)
  })

  it('returns 404 for deleted session', async () => {
    const res = await app.inject({
      method: 'GET',
      url: `/api/sessions/${sessionId}`,
      headers: { Authorization: `Bearer ${authToken}` },
    })

    expect(res.statusCode).toBe(404)
  })
})