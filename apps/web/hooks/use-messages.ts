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

export interface LocalSubAgent {
  id: string
  agentId: string
  role: string
  task: string
  spawnedAt: number
}

export interface StreamingMessage {
  id: string
  role: 'assistant'
  thinkingContent: string
  content: string
  toolCalls: LocalToolCall[]
  subAgents: LocalSubAgent[]
  streaming: boolean
  phase: 'thinking' | 'tool' | 'responding' | 'done'
  serverMessageId?: string
}

export function useMessages(initialMessages: Message[]) {
  const [messages, setMessages] = useState<Message[]>(initialMessages)
  const [streamingMsg, setStreamingMsg] = useState<StreamingMessage | null>(null)

  const prevInitialRef = React.useRef(initialMessages)
  React.useEffect(() => {
    if (prevInitialRef.current !== initialMessages) {
      prevInitialRef.current = initialMessages
      // Merge server messages with locally-enriched state.
      // The server returns plain Message objects without thinkingContent /
      // toolCalls / subAgents — those fields only exist in client memory.
      // We preserve them when the server refreshes the message list so that
      // tool call / thinking panels don't disappear after invalidateQueries.
      setMessages((prev) => {
        const localById = new Map(prev.map((m) => [m.id, m]))
        return initialMessages.map((serverMsg) => {
          const local = localById.get(serverMsg.id)
          if (!local) return serverMsg
          return {
            ...serverMsg,
            thinkingContent: local.thinkingContent ?? serverMsg.thinkingContent,
            toolCalls: local.toolCalls ?? serverMsg.toolCalls,
            subAgents: local.subAgents ?? serverMsg.subAgents,
          }
        })
      })
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
      subAgents: [],
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

        case 'sub_agent_spawned':
          return {
            ...prev,
            subAgents: [
              ...prev.subAgents,
              {
                id: crypto.randomUUID(),
                agentId: event.agentId,
                role: event.role,
                task: event.task,
                spawnedAt: Date.now(),
              },
            ],
          }

        case 'completed':
          return {
            ...prev,
            content: event.message,
            streaming: false,
            phase: 'done',
            serverMessageId: event.messageId,
          }

        default:
          return prev
      }
    })
  }, [])

  const finalizeStreaming = useCallback((content: string) => {
    setStreamingMsg((current) => {
      // Use the server-assigned ID when available so the merge logic in the
      // useEffect below can match this local message to the refetched server
      // message and preserve thinkingContent / toolCalls / subAgents.
      const final: Message = {
        id: current?.serverMessageId ?? crypto.randomUUID(),
        sessionId: '',
        role: 'assistant',
        content,
        thinkingContent: current?.thinkingContent ?? '',
        toolCalls: current?.toolCalls ?? [],
        subAgents: current?.subAgents ?? [],
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