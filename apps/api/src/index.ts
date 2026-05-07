import 'dotenv/config'
import { buildServer } from './server.js'
import { db } from './db/index.js'
import { runMigrations } from './db/migrate.js'
import { sandbox } from './sandbox.js'
import { sql } from 'drizzle-orm'

async function main() {
  // ── DB connectivity check ────────────────────────────────────────────────────
  try {
    await db.execute(sql`SELECT 1`)
    console.log('[db] Connected to PostgreSQL')
  } catch (err) {
    console.error('[db] Failed to connect to PostgreSQL:', err)
    process.exit(1)
  }

  // ── Auto-migrate on every startup ────────────────────────────────────────────
  try {
    await runMigrations()
    console.log('[db] Migrations up to date')
  } catch (err) {
    console.error('[db] Migration failed:', err)
    process.exit(1)
  }

  // ── Sandbox connectivity check ───────────────────────────────────────────────
  try {
    const ok = await sandbox.ping()
    if (!ok) throw new Error('Sandbox ping returned false')
    console.log('[sandbox] Docker sandbox is reachable')
  } catch (err) {
    console.warn('[sandbox] Sandbox not available — agent features will fail at runtime:', err)
  }

  // ── Start HTTP server ─────────────────────────────────────────────────────────
  const server = await buildServer()

  const port = Number(process.env.API_PORT ?? 4000)
  const host = process.env.API_HOST ?? '0.0.0.0'

  await server.listen({ port, host })
  console.log(`[api] Listening on http://${host}:${port}`)
}

main().catch((err) => {
  console.error('Fatal error during startup:', err)
  process.exit(1)
})