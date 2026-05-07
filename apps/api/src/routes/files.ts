import type { FastifyInstance } from 'fastify'
import { eq, and } from 'drizzle-orm'
import { randomUUID } from 'crypto'
import path from 'path'
import { pipeline } from 'stream/promises'
import fs from 'fs'
import { db } from '../db/index.js'
import { files, sessions } from '../db/schema.js'
import { sandbox } from '../sandbox.js'

const MAX_FILE_SIZE = 500 * 1024 * 1024 // 500 MB

export default async function fileRoutes(fastify: FastifyInstance) {
  const auth = { onRequest: [fastify.authenticate] }

  // ── POST /sessions/:id/files ─────────────────────────────────────────────────
  fastify.post('/sessions/:id/files', auth, async (request, reply) => {
    const { sub } = request.user as { sub: string }
    const { id: sessionId } = request.params as { id: string }

    // Verify session belongs to user
    const [session] = await db
      .select()
      .from(sessions)
      .where(and(eq(sessions.id, sessionId), eq(sessions.userId, sub)))
      .limit(1)

    if (!session) return reply.status(404).send({ error: 'Session not found' })

    const data = await request.file({ limits: { fileSize: MAX_FILE_SIZE } })
    if (!data) return reply.status(400).send({ error: 'No file uploaded' })

    const fileId = randomUUID()
    const safeFilename = path.basename(data.filename).replace(/[^a-zA-Z0-9._-]/g, '_')
    const uploadsDir = `/workspace/sessions/${sessionId}/uploads`
    const storagePath = `${uploadsDir}/${fileId}_${safeFilename}`

    // Ensure uploads directory exists in sandbox
    await sandbox.ensureUploadsDir(sessionId)

    // Stream file to a temp path on host, then copy into sandbox via docker cp
    const tmpPath = `/tmp/skylog_upload_${fileId}`
    await pipeline(data.file, fs.createWriteStream(tmpPath))
    const stat = fs.statSync(tmpPath)

    // Copy into sandbox container
    const { exitCode, stderr } = await sandbox.exec(
      `docker cp ${tmpPath} skylog-sandbox-1:${storagePath} 2>&1 || true`,
    )

    // Clean up temp file
    fs.unlink(tmpPath, () => {})

    if (exitCode !== 0 && stderr.includes('Error')) {
      return reply.status(500).send({ error: 'Failed to copy file to sandbox', detail: stderr })
    }

    // Save to DB
    const [file] = await db
      .insert(files)
      .values({
        id: fileId,
        sessionId,
        originalName: data.filename,
        storagePath,
        sizeBytes: stat.size,
        mimeType: data.mimetype,
      })
      .returning()

    return reply.status(201).send({ file })
  })

  // ── GET /sessions/:id/files ───────────────────────────────────────────────────
  fastify.get('/sessions/:id/files', auth, async (request, reply) => {
    const { sub } = request.user as { sub: string }
    const { id: sessionId } = request.params as { id: string }

    const [session] = await db
      .select()
      .from(sessions)
      .where(and(eq(sessions.id, sessionId), eq(sessions.userId, sub)))
      .limit(1)

    if (!session) return reply.status(404).send({ error: 'Session not found' })

    const list = await db
      .select()
      .from(files)
      .where(eq(files.sessionId, sessionId))
      .orderBy(files.createdAt)

    return reply.send({ files: list })
  })

  // ── DELETE /files/:id ────────────────────────────────────────────────────────
  fastify.delete('/files/:id', auth, async (request, reply) => {
    const { sub } = request.user as { sub: string }
    const { id: fileId } = request.params as { id: string }

    // Join to verify ownership via session → user
    const result = await db
      .select({ file: files, session: sessions })
      .from(files)
      .innerJoin(sessions, eq(files.sessionId, sessions.id))
      .where(and(eq(files.id, fileId), eq(sessions.userId, sub)))
      .limit(1)

    if (result.length === 0) return reply.status(404).send({ error: 'File not found' })

    const { file } = result[0]

    await db.delete(files).where(eq(files.id, fileId))

    // Remove from sandbox (fire-and-forget)
    sandbox
      .exec(`rm -f ${JSON.stringify(file.storagePath)}`)
      .catch((err) => fastify.log.warn({ err, fileId }, 'Failed to delete file from sandbox'))

    return reply.status(204).send()
  })
}