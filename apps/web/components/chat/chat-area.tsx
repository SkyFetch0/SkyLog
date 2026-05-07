'use client'

import { useEffect, useRef, useState } from 'react'
import { ArrowUp, StopCircle } from 'lucide-react'
import { cn } from '@/lib/utils'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Message, AssistantMessage } from './message'
import { StreamingMessage } from './streaming-message'
import { FileUpload } from './file-upload'
import { useMessages } from '@/hooks/use-messages'
import { useSendMessage } from '@/hooks/use-send-message'
import type { Message as MsgType, SessionDetail, FileRecord } from '@/lib/types'
import type { SseEvent } from '@/lib/types'

interface Props {
  session: SessionDetail
  onAgentActivity: () => void
}

export function ChatArea({ session, onAgentActivity }: Props) {
  const bottomRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const [input, setInput] = useState('')
  const [attachedFiles, setAttachedFiles] = useState<FileRecord[]>([])

  const {
    messages,
    streamingMsg,
    addUserMessage,
    startStreaming,
    applyEvent,
    finalizeStreaming,
    resetStreaming,
  } = useMessages(session.messages as MsgType[])

  const handleEvent = (event: SseEvent) => {
    applyEvent(event)
    if (event.type === 'sub_agent_spawned') onAgentActivity()
  }

  const handleDone = (finalContent: string) => {
    finalizeStreaming(finalContent)
  }

  const { send, cancel, sending } = useSendMessage({
    sessionId: session.id,
    onEvent: handleEvent,
    onDone: handleDone,
  })

  const handleSubmit = () => {
    const content = input.trim()
    if (!content || sending) return

    addUserMessage(content)
    startStreaming(crypto.randomUUID())
    setInput('')
    setAttachedFiles([])

    send(
      content,
      attachedFiles.map((f) => f.id),
    )
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSubmit()
    }
  }

  // Auto-scroll on new content
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages.length, streamingMsg?.content, streamingMsg?.toolCalls.length])

  // Auto-resize textarea
  useEffect(() => {
    const ta = textareaRef.current
    if (!ta) return
    ta.style.height = 'auto'
    ta.style.height = `${Math.min(ta.scrollHeight, 200)}px`
  }, [input])

  return (
    <div className="flex flex-col h-full bg-zinc-950">
      {/* Header */}
      <div className="flex items-center h-14 px-5 border-b border-zinc-800 shrink-0">
        <h1 className="font-medium text-sm text-zinc-200 truncate">{session.title}</h1>
      </div>

      {/* Messages */}
      <ScrollArea className="flex-1">
        <div className="px-4 py-6 max-w-3xl mx-auto">
          {messages.length === 0 && !streamingMsg && (
            <div className="flex flex-col items-center justify-center py-20 text-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-zinc-800 flex items-center justify-center">
                <span className="text-2xl">🔍</span>
              </div>
              <p className="text-zinc-500 text-sm max-w-xs">
                Upload a log file and ask a question to start the analysis.
              </p>
            </div>
          )}

          {messages.map((msg) => (
            <Message key={msg.id} message={msg} />
          ))}

          {streamingMsg && <StreamingMessage msg={streamingMsg} />}

          <div ref={bottomRef} />
        </div>
      </ScrollArea>

      {/* Input */}
      <div className="shrink-0 px-4 pb-4 pt-2 border-t border-zinc-800">
        <div className="max-w-3xl mx-auto">
          <div
            className={cn(
              'rounded-2xl bg-zinc-900 border transition-colors',
              sending ? 'border-blue-500/40' : 'border-zinc-700 hover:border-zinc-600',
            )}
          >
            {/* Attached files row */}
            <div className="px-3 pt-2">
              <FileUpload
                sessionId={session.id}
                attachedFiles={attachedFiles}
                onAttach={(f) => setAttachedFiles((prev) => [...prev, f])}
                onDetach={(id) => setAttachedFiles((prev) => prev.filter((f) => f.id !== id))}
              />
            </div>

            {/* Textarea */}
            <textarea
              ref={textareaRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              disabled={sending}
              placeholder={sending ? 'Analyzing…' : 'Ask anything about the log…'}
              rows={1}
              className={cn(
                'w-full resize-none bg-transparent px-4 py-3 text-sm text-zinc-100 placeholder:text-zinc-600',
                'focus:outline-none min-h-[44px] max-h-[200px]',
                sending && 'opacity-50 cursor-not-allowed',
              )}
            />

            {/* Actions row */}
            <div className="flex items-center justify-between px-3 pb-2.5">
              <span className="text-[11px] text-zinc-600">
                {sending ? 'Press ESC to cancel' : 'Enter to send  ·  Shift+Enter for newline'}
              </span>
              {sending ? (
                <button
                  onClick={cancel}
                  className="flex items-center gap-1.5 text-xs text-zinc-400 hover:text-red-400 transition-colors"
                >
                  <StopCircle className="h-4 w-4" />
                  Stop
                </button>
              ) : (
                <button
                  onClick={handleSubmit}
                  disabled={!input.trim()}
                  className={cn(
                    'flex items-center justify-center w-8 h-8 rounded-lg transition-colors',
                    input.trim()
                      ? 'bg-blue-600 hover:bg-blue-500 text-white'
                      : 'bg-zinc-800 text-zinc-600 cursor-not-allowed',
                  )}
                >
                  <ArrowUp className="h-4 w-4" />
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}