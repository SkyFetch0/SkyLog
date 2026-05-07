'use client'

import React, { useState, useCallback } from 'react'
import type { Message, SseEvent } from '@/lib/types'

export interface LocalToolCall {
  id: string
  toolName: string
  toolUseId: string
  input: unknown
  output?: string
  success?: boolean
  pending: boolean
  startedAt: number
  durationMs?: number
}

export interface StreamingMessage {
  id: string
  role: 'assistant'
  // Reasoning / thinking text streamed before the final answer
  thinkingContent: string
  // Final answer text
  content: string
  toolCalls: LocalToolCall[]
  streaming: boolean
  // Phase tracking for better UX
  phase: 'thinking' | 'tool' | 'responding' | 'done'
}

export function useMessages(initialMessages: Message[]) {
  const [messages, setMessages] = useState<Message[]>(initialMessages)
  const [streamingMsg, setStreamingMsg] = useState<StreamingMessage | null>(null)

  const prevInitialRef = React.useRef(initialMessages)
  React.useEffect(() => {
    if (prevInitialRef.current !== initialMessages) {
      prevInitialRef.current = initialMessages
      setMessages(initialMessages)
      // Only clear streaming message when NOT actively streaming.
      // During an SSE stream the session query is invalidated and
      // initialMessages changes — we must not wipe the in-progress state.
      setStreamingMsg((current) => (current?.streaming ? current : null))
    }
  }, [initialMessages])

  const addUserMessage = useCallback((content: string): Message => {
    const msg: Message = {
      id: crypto.randomUUID(),
      sessionId: '',
      role: 'user',
      content,
      createdAt: new Date().toISOString(),
    }
    setMessages((prev) => [...prev, msg])
    return msg
  }, [])

  const startStreaming = useCallback((id: string) => {
    setStreamingMsg({
      id,
      role: 'assistant',
      thinkingContent: '',
      content: '',
      toolCalls: [],
      streaming: true,
      phase: 'thinking',
    })
  }, [])

  const applyEvent = useCallback((event: SseEvent) => {
    setStreamingMsg((prev) => {
      if (!prev) return prev

      switch (event.type) {
        case 'thinking':
          return {
            ...prev,
            thinkingContent: prev.thinkingContent + event.content,
            phase: 'thinking',
          }

        case 'text_delta':
          return {
            ...prev,
            content: prev.content + event.content,
            phase: 'responding',
          }

        case 'tool_use':
          return {
            ...prev,
            phase: 'tool',
            toolCalls: [
              ...prev.toolCalls,
              {
                id: crypto.randomUUID(),
                toolName: event.tool,
                toolUseId: event.toolUseId,
                input: event.input,
                pending: true,
                startedAt: Date.now(),
              },
            ],
          }

        case 'tool_result': {
          const now = Date.now()
          const updated = prev.toolCalls.map((tc) =>
            tc.toolUseId === event.toolUseId
              ? {
                  ...tc,
                  output: event.output,
                  success: event.success,
                  pending: false,
                  durationMs: now - tc.startedAt,
                }
              : tc,
          )
          return { ...prev, toolCalls: updated }
        }

        case 'completed':
          return {
            ...prev,
            content: event.message,
            streaming: false,
            phase: 'done',
          }

        default:
          return prev
      }
    })
  }, [])

  const finalizeStreaming = useCallback((content: string) => {
    setStreamingMsg((current) => {
      const final: Message = {
        id: crypto.randomUUID(),
        sessionId: '',
        role: 'assistant',
        content,
        thinkingContent: current?.thinkingContent ?? '',
        createdAt: new Date().toISOString(),
      }
      setMessages((prev) => [...prev, final])
      return null
    })
  }, [])

  const resetStreaming = useCallback(() => setStreamingMsg(null), [])

  return {
    messages,
    streamingMsg,
    addUserMessage,
    startStreaming,
    applyEvent,
    finalizeStreaming,
    resetStreaming,
  }
}