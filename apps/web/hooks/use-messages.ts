'use client'

import { useState, useCallback } from 'react'
import type { Message, SseEvent } from '@/lib/types'

export interface LocalToolCall {
  id: string
  toolName: string
  toolUseId: string
  input: unknown
  output?: string
  success?: boolean
  pending: boolean
}

export interface StreamingMessage {
  id: string
  role: 'assistant'
  content: string
  toolCalls: LocalToolCall[]
  streaming: boolean
}

export function useMessages(initialMessages: Message[]) {
  const [messages, setMessages] = useState<Message[]>(initialMessages)
  const [streamingMsg, setStreamingMsg] = useState<StreamingMessage | null>(null)

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
    setStreamingMsg({ id, role: 'assistant', content: '', toolCalls: [], streaming: true })
  }, [])

  const applyEvent = useCallback((event: SseEvent) => {
    setStreamingMsg((prev) => {
      if (!prev) return prev

      switch (event.type) {
        case 'thinking':
          return { ...prev, content: prev.content + event.content }

        case 'tool_use':
          return {
            ...prev,
            toolCalls: [
              ...prev.toolCalls,
              {
                id: crypto.randomUUID(),
                toolName: event.tool,
                toolUseId: event.toolUseId,
                input: event.input,
                pending: true,
              },
            ],
          }

        case 'tool_result': {
          const updated = prev.toolCalls.map((tc) =>
            tc.toolUseId === event.toolUseId
              ? { ...tc, output: event.output, success: event.success, pending: false }
              : tc,
          )
          return { ...prev, toolCalls: updated }
        }

        case 'completed':
          return { ...prev, content: event.message, streaming: false }

        default:
          return prev
      }
    })
  }, [])

  const finalizeStreaming = useCallback((content: string) => {
    const final: Message = {
      id: crypto.randomUUID(),
      sessionId: '',
      role: 'assistant',
      content,
      createdAt: new Date().toISOString(),
    }
    setMessages((prev) => [...prev, final])
    setStreamingMsg(null)
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