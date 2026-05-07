import {
  pgTable,
  pgEnum,
  uuid,
  text,
  integer,
  timestamp,
  jsonb,
  unique,
  type AnyPgColumn,
} from 'drizzle-orm/pg-core'
import { relations } from 'drizzle-orm'

// ── Enums ────────────────────────────────────────────────────────────────────

export const messageRoleEnum = pgEnum('message_role', ['user', 'assistant', 'system'])

export const agentStatusEnum = pgEnum('agent_status', [
  'pending',
  'running',
  'completed',
  'failed',
])

// ── Tables ───────────────────────────────────────────────────────────────────

export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  email: text('email').notNull(),
  passwordHash: text('password_hash').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [unique().on(t.email)])

export const sessions = pgTable('sessions', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  title: text('title').notNull().default('New Session'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
})

export const messages = pgTable('messages', {
  id: uuid('id').primaryKey().defaultRandom(),
  sessionId: uuid('session_id')
    .notNull()
    .references(() => sessions.id, { onDelete: 'cascade' }),
  role: messageRoleEnum('role').notNull(),
  content: text('content').notNull(),
  metadata: jsonb('metadata'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})

export const files = pgTable('files', {
  id: uuid('id').primaryKey().defaultRandom(),
  sessionId: uuid('session_id')
    .notNull()
    .references(() => sessions.id, { onDelete: 'cascade' }),
  originalName: text('original_name').notNull(),
  storagePath: text('storage_path').notNull(),
  sizeBytes: integer('size_bytes').notNull(),
  mimeType: text('mime_type').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})

export const agentRuns = pgTable('agent_runs', {
  id: uuid('id').primaryKey().defaultRandom(),
  sessionId: uuid('session_id')
    .notNull()
    .references(() => sessions.id, { onDelete: 'cascade' }),
  parentRunId: uuid('parent_run_id').references((): AnyPgColumn => agentRuns.id),
  role: text('role').notNull(),
  status: agentStatusEnum('status').notNull().default('pending'),
  task: text('task').notNull(),
  inputRefs: jsonb('input_refs'),
  result: jsonb('result'),
  workspacePath: text('workspace_path').notNull(),
  tokensUsed: integer('tokens_used').notNull().default(0),
  startedAt: timestamp('started_at', { withTimezone: true }),
  completedAt: timestamp('completed_at', { withTimezone: true }),
})

export const toolCalls = pgTable('tool_calls', {
  id: uuid('id').primaryKey().defaultRandom(),
  agentRunId: uuid('agent_run_id')
    .notNull()
    .references(() => agentRuns.id, { onDelete: 'cascade' }),
  toolName: text('tool_name').notNull(),
  input: jsonb('input').notNull(),
  output: jsonb('output'),
  durationMs: integer('duration_ms'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})

// ── Relations ─────────────────────────────────────────────────────────────────

export const usersRelations = relations(users, ({ many }) => ({
  sessions: many(sessions),
}))

export const sessionsRelations = relations(sessions, ({ one, many }) => ({
  user: one(users, { fields: [sessions.userId], references: [users.id] }),
  messages: many(messages),
  files: many(files),
  agentRuns: many(agentRuns),
}))

export const messagesRelations = relations(messages, ({ one }) => ({
  session: one(sessions, { fields: [messages.sessionId], references: [sessions.id] }),
}))

export const filesRelations = relations(files, ({ one }) => ({
  session: one(sessions, { fields: [files.sessionId], references: [sessions.id] }),
}))

export const agentRunsRelations = relations(agentRuns, ({ one, many }) => ({
  session: one(sessions, { fields: [agentRuns.sessionId], references: [sessions.id] }),
  parentRun: one(agentRuns, {
    fields: [agentRuns.parentRunId],
    references: [agentRuns.id],
    relationName: 'parentChild',
  }),
  childRuns: many(agentRuns, { relationName: 'parentChild' }),
  toolCalls: many(toolCalls),
}))

export const toolCallsRelations = relations(toolCalls, ({ one }) => ({
  agentRun: one(agentRuns, { fields: [toolCalls.agentRunId], references: [agentRuns.id] }),
}))