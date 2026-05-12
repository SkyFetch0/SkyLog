'use client'

import { useState, useCallback, useRef } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { postSse } from '@/lib/sse'
import type { SseEvent } from '@/lib/types'

interface UseSendMessageOptions {
  sessionId: string
  onEvent: (event: SseEvent) => void
  onDone: (finalContent: string) => void
}

export function useSendMessage({ sessionId, onEvent, onDone }: UseSendMessageOptions) {
  const [sending, setSending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const abortRef = useRef<(() => void) | null>(null)
  const qc = useQueryClient()
  const contentRef = useRef('')

  const send = useCallback(
    (content: string, attachedFileIds: string[] = []) => {
      if (sending) return
      setSending(true)
      setError(null)
      contentRef.current = ''

      const abort = postSse(
        `/sessions/${sessionId}/messages`,
        { content, attachedFileIds },
        {
          onEvent: (event) => {
            // Accumulate response text tokens in real-time
            if (event.type === 'text_delta') {
              contentRef.current += event.content
            }
            // completed.message is the authoritative final answer
            if (event.type === 'completed') {
              contentRef.current = event.message
            }
            // Refresh the AgentPanel (sidebar tree) whenever a sub-agent's
            // lifecycle changes server-side. Tool events fire too often to
            // invalidate on each one — completed is enough to catch token
            // counts + final status; spawned ensures the new node appears.
            if (event.type === 'sub_agent_spawned' || event.type === 'sub_agent_completed') {
              qc.invalidateQueries({ queryKey: ['agent-runs', sessionId] })
            }
            onEvent(event)
          },
          onDone: () => {
            setSending(false)
            qc.invalidateQueries({ queryKey: ['session', sessionId] })
            qc.invalidateQueries({ queryKey: ['agent-runs', sessionId] })
            onDone(contentRef.current)
          },
          onError: (err) => {
            setSending(false)
            setError(err)
          },
        },
      )

      abortRef.current = abort
    },
    [sending, sessionId, onEvent, onDone, qc],
  )

  const cancel = useCallback(() => {
    abortRef.current?.()
    setSending(false)
  }, [])

  return { send, cancel, sending, error }
}