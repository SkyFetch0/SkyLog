import { useAuthStore } from './auth'
import type { SseEvent } from './types'

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/api'

export interface SseOptions {
  onEvent: (event: SseEvent) => void
  onDone?: () => void
  onError?: (err: string) => void
}

/**
 * POST-based SSE client (fetch + ReadableStream).
 * Returns an abort function.
 */
export function postSse(
  path: string,
  body: Record<string, unknown>,
  options: SseOptions,
): () => void {
  const ctrl = new AbortController()
  const token = useAuthStore.getState().token

  ;(async () => {
    let res: Response
    try {
      res = await fetch(`${API_BASE}${path}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify(body),
        signal: ctrl.signal,
      })
    } catch (err) {
      if ((err as Error).name !== 'AbortError') {
        options.onError?.(String(err))
      }
      return
    }

    if (!res.ok || !res.body) {
      options.onError?.(`HTTP ${res.status}`)
      return
    }

    const reader = res.body.getReader()
    const decoder = new TextDecoder()
    let buffer = ''

    try {
      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() ?? ''

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const raw = line.slice(6).trim()
            if (!raw) continue
            try {
              const parsed = JSON.parse(raw) as SseEvent
              options.onEvent(parsed)
              if (parsed.type === 'done') {
                options.onDone?.()
                return
              }
            } catch {
              // skip malformed frames
            }
          }
        }
      }
    } catch (err) {
      if ((err as Error).name !== 'AbortError') {
        options.onError?.(String(err))
      }
    } finally {
      options.onDone?.()
    }
  })()

  return () => ctrl.abort()
}