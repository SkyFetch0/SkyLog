export type AgentStatus = 'idle' | 'running' | 'completed' | 'failed'

export interface AgentJob {
  id: string
  status: AgentStatus
  query: string
  createdAt: string
  updatedAt: string
  result?: string
  error?: string
}

export interface AgentMessage {
  role: 'user' | 'assistant' | 'tool'
  content: string
  timestamp: string
}