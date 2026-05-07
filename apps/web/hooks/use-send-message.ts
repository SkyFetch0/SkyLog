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
            if (event.type === 'thinking') {
              contentRef.current += event.content
            }
            if (event.type === 'completed') {
              contentRef.current = event.message
            }
            if (event.type === 'sub_agent_spawned') {
              // Trigger agent-runs refetch
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