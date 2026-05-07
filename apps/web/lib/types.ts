// ── Auth ────────────────────────────────────────────────────────────────────────

export interface User {
  id: string
  email: string
  createdAt: string
}

export interface AuthResponse {
  token: string
  user: User
}

// ── Session ──────────────────────────────────────────────────────────────────────

export interface Session {
  id: string
  userId: string
  title: string
  createdAt: string
  updatedAt: string
}

export interface SessionDetail extends Session {
  messages: Message[]
  files: FileRecord[]
  agentRuns: AgentRun[]
}

// ── Message ──────────────────────────────────────────────────────────────────────

export type MessageRole = 'user' | 'assistant' | 'system'

export interface Message {
  id: string
  sessionId: string
  role: MessageRole
  content: string
  thinkingContent?: string
  toolCalls?: import('@/hooks/use-messages').LocalToolCall[]
  subAgents?: import('@/hooks/use-messages').LocalSubAgent[]
  metadata?: Record<string, unknown> | null
  createdAt: string
}

// ── File ─────────────────────────────────────────────────────────────────────────

export interface FileRecord {
  id: string
  sessionId: string
  originalName: string
  storagePath: string
  sizeBytes: number
  mimeType: string
  createdAt: string
}

// ── Agent Runs ────────────────────────────────────────────────────────────────────

export type AgentStatus = 'pending' | 'running' | 'completed' | 'failed'

export interface AgentRun {
  id: string
  sessionId: string
  parentRunId?: string | null
  role: string
  status: AgentStatus
  task: string
  inputRefs?: unknown
  result?: unknown
  workspacePath: string
  tokensUsed: number
  startedAt?: string | null
  completedAt?: string | null
  children?: AgentRun[]
}

export interface ToolCall {
  id: string
  agentRunId: string
  toolName: string
  input: unknown
  output: unknown
  durationMs?: number | null
  createdAt: string
}

// ── SSE Events ─────────────────────────────────────────────────────────────────────

export type SseEvent =
  | { type: 'thinking'; content: string }
  | { type: 'text_delta'; content: string }
  | { type: 'tool_use'; tool: string; toolUseId: string; input: unknown }
  | { type: 'tool_result'; toolUseId: string; tool: string; success: boolean; output: string }
  | { type: 'sub_agent_spawned'; agentId: string; role: string; task: string }
  | { type: 'completed'; message: string; tokensUsed: number; messageId?: string }
  | { type: 'error'; message: string }
  | { type: 'done' }