import axios from 'axios'
import { useAuthStore } from './auth'
import type {
  AuthResponse,
  Session,
  SessionDetail,
  FileRecord,
  AgentRun,
  ToolCall,
} from './types'

export const apiClient = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/api',
  headers: { 'Content-Type': 'application/json' },
})

// Attach JWT to every request
apiClient.interceptors.request.use((config) => {
  const token = useAuthStore.getState().token
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

// Redirect to /login on 401
apiClient.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401) {
      useAuthStore.getState().logout()
      if (typeof window !== 'undefined') {
        window.location.href = '/login'
      }
    }
    return Promise.reject(err)
  },
)

// ── Auth ──────────────────────────────────────────────────────────────────────

export const authApi = {
  register: (email: string, password: string) =>
    apiClient.post<AuthResponse>('/auth/register', { email, password }).then((r) => r.data),
  login: (email: string, password: string) =>
    apiClient.post<AuthResponse>('/auth/login', { email, password }).then((r) => r.data),
  me: () => apiClient.get<{ user: AuthResponse['user'] }>('/auth/me').then((r) => r.data),
}

// ── Sessions ──────────────────────────────────────────────────────────────────

export const sessionsApi = {
  list: () =>
    apiClient.get<{ sessions: Session[] }>('/sessions').then((r) => r.data.sessions),
  create: (title?: string) =>
    apiClient.post<{ session: Session }>('/sessions', { title }).then((r) => r.data.session),
  get: (id: string) =>
    apiClient.get<SessionDetail>(`/sessions/${id}`).then((r) => r.data),
  delete: (id: string) => apiClient.delete(`/sessions/${id}`),
}

// ── Files ─────────────────────────────────────────────────────────────────────

export const filesApi = {
  list: (sessionId: string) =>
    apiClient
      .get<{ files: FileRecord[] }>(`/sessions/${sessionId}/files`)
      .then((r) => r.data.files),
  upload: (sessionId: string, file: File, onProgress?: (pct: number) => void) => {
    const form = new FormData()
    form.append('file', file)
    return apiClient
      .post<{ file: FileRecord }>(`/sessions/${sessionId}/files`, form, {
        headers: { 'Content-Type': 'multipart/form-data' },
        onUploadProgress: (e) => {
          if (onProgress && e.total) onProgress(Math.round((e.loaded * 100) / e.total))
        },
      })
      .then((r) => r.data.file)
  },
  delete: (fileId: string) => apiClient.delete(`/files/${fileId}`),
}

// ── Agent runs ────────────────────────────────────────────────────────────────

export const agentRunsApi = {
  tree: (sessionId: string) =>
    apiClient
      .get<{ agentRuns: AgentRun[] }>(`/sessions/${sessionId}/agent-runs`)
      .then((r) => r.data.agentRuns),
  get: (id: string) =>
    apiClient
      .get<{ agentRun: AgentRun; toolCalls: ToolCall[] }>(`/agent-runs/${id}`)
      .then((r) => r.data),
}

// ── SSE chat stream (returns cleanup function) ────────────────────────────────

export function streamMessage(
  sessionId: string,
  content: string,
  attachedFileIds: string[],
  onEvent: (event: Record<string, unknown>) => void,
): () => void {
  const token = useAuthStore.getState().token
  const baseUrl = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/api'

  const ctrl = new AbortController()

  fetch(`${baseUrl}/sessions/${sessionId}/messages`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ content, attachedFileIds }),
    signal: ctrl.signal,
  }).then(async (res) => {
    if (!res.ok || !res.body) {
      onEvent({ type: 'error', message: `HTTP ${res.status}` })
      return
    }

    const reader = res.body.getReader()
    const decoder = new TextDecoder()
    let buffer = ''

    while (true) {
      const { done, value } = await reader.read()
      if (done) break

      buffer += decoder.decode(value, { stream: true })
      const lines = buffer.split('\n')
      buffer = lines.pop() ?? ''

      for (const line of lines) {
        if (line.startsWith('data: ')) {
          try {
            const parsed = JSON.parse(line.slice(6)) as Record<string, unknown>
            onEvent(parsed)
          } catch {
            // ignore malformed lines
          }
        }
      }
    }
  }).catch((err) => {
    if (err.name !== 'AbortError') {
      onEvent({ type: 'error', message: String(err) })
    }
  })

  return () => ctrl.abort()
}