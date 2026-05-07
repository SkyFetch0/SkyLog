'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { ArrowUp, Square, Paperclip, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Message } from './message'
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
  const scrollRef = useRef<HTMLDivElement>(null)
  const [input, setInput] = useState('')
  const [attachedFiles, setAttachedFiles] = useState<FileRecord[]>([])
  const [showUpload, setShowUpload] = useState(false)
  const [autoScroll, setAutoScroll] = useState(true)

  const {
    messages,
    streamingMsg,
    addUserMessage,
    startStreaming,
    applyEvent,
    finalizeStreaming,
  } = useMessages(session.messages as MsgType[])

  const handleEvent = useCallback((event: SseEvent) => {
    applyEvent(event)
    if (event.type === 'sub_agent_spawned') onAgentActivity()
  }, [applyEvent, onAgentActivity])

  const handleDone = useCallback((finalContent: string) => {
    finalizeStreaming(finalContent)
  }, [finalizeStreaming])

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
    setShowUpload(false)
    setAutoScroll(true)
    send(content, attachedFiles.map((f) => f.id))
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSubmit() }
    if (e.key === 'Escape' && sending) cancel()
  }

  // Auto-scroll to bottom on new messages, unless user scrolled up
  useEffect(() => {
    if (!autoScroll) return
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages.length, streamingMsg?.content, streamingMsg?.thinkingContent, streamingMsg?.toolCalls.length, autoScroll])

  // Detect user scrolling up to pause auto-scroll
  const handleScroll = () => {
    const el = scrollRef.current
    if (!el) return
    const nearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 80
    setAutoScroll(nearBottom)
  }

  // Resize textarea
  useEffect(() => {
    const ta = textareaRef.current
    if (!ta) return
    ta.style.height = 'auto'
    ta.style.height = `${Math.min(ta.scrollHeight, 160)}px`
  }, [input])

  const isEmpty = messages.length === 0 && !streamingMsg

  return (
    /*
     * CRITICAL LAYOUT: h-full + flex-col ensures this fills its parent slot
     * exactly. The scroll area takes flex-1 and overflow-y-auto, keeping the
     * input pinned at the bottom regardless of message count or length.
     */
    <div className="flex flex-col h-full min-h-0 bg-[#070b14]">

      {/* ── Header ─────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between h-14 px-6 border-b border-white/[0.06] shrink-0">
        <h1 className="font-semibold text-sm text-white/90 truncate max-w-[60%]">{session.title}</h1>
        {sending && (
          <div className="flex items-center gap-2 text-xs text-blue-400 animate-pulse">
            <span className="flex gap-1">
              {[0,1,2].map(i => (
                <span key={i} className="w-1 h-1 rounded-full bg-blue-400 animate-bounce" style={{ animationDelay: `${i*150}ms` }} />
              ))}
            </span>
            Analyzing…
          </div>
        )}
      </div>

      {/* ── Messages (fills all remaining vertical space) ────────────── */}
      <div
        ref={scrollRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto"
      >
        <div className="px-4 pt-6 pb-2 max-w-2xl mx-auto w-full">
          {isEmpty ? (
            <div className="flex flex-col items-center justify-center py-20 text-center gap-5 select-none">
              <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-blue-500/15 to-cyan-500/10 border border-blue-500/20 flex items-center justify-center">
                <span className="text-2xl">🔍</span>
              </div>
              <div className="space-y-1.5">
                <p className="text-zinc-300 text-sm font-medium">Ready to analyze your logs</p>
                <p className="text-zinc-600 text-xs max-w-xs leading-relaxed">
                  Upload a log file and ask a question to get AI-powered insights.
                </p>
              </div>
              <div className="flex flex-wrap gap-1.5 justify-center mt-1 max-w-sm">
                {['Find all errors in the last hour', 'Top IPs by request count', 'Slow queries over 1s', 'Suspicious login attempts'].map((hint) => (
                  <button
                    key={hint}
                    onClick={() => { setInput(hint); textareaRef.current?.focus() }}
                    className="px-2.5 py-1.5 text-[11px] rounded-xl border border-white/[0.07] text-zinc-500 hover:text-zinc-300 hover:border-white/[0.15] hover:bg-white/[0.03] transition-all"
                  >
                    {hint}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <>
              {messages.map((msg) => (
                <Message key={msg.id} message={msg} />
              ))}

              {/* Streaming message — always rendered while sending */}
              {streamingMsg
                ? <StreamingMessage msg={streamingMsg} />
                : sending && (
                  <div className="flex justify-start mb-5 gap-3 msg-enter">
                    <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-blue-500/30 to-violet-500/20 border border-blue-400/30 flex items-center justify-center shrink-0 mt-0.5">
                      <span className="text-[11px] text-blue-300 animate-pulse">✦</span>
                    </div>
                    <div className="flex items-center gap-2 px-4 py-3 rounded-2xl rounded-tl-sm bg-white/[0.04] border border-white/[0.07]">
                      <span className="flex gap-1">
                        {[0,1,2].map(i => (
                          <span key={i} className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-bounce" style={{ animationDelay: `${i*150}ms` }} />
                        ))}
                      </span>
                      <span className="text-xs text-zinc-500">Thinking…</span>
                    </div>
                  </div>
                )
              }
            </>
          )}
          <div ref={bottomRef} className="h-4" />
        </div>
      </div>

      {/* ── Input (always pinned to bottom) ────────────────────────────── */}
      <div className="shrink-0 px-4 pb-4 pt-2 border-t border-white/[0.05]">
        <div className="max-w-2xl mx-auto space-y-2">

          {/* File upload panel */}
          {showUpload && (
            <div className="rounded-xl bg-white/[0.02] border border-white/[0.07] p-3">
              <FileUpload
                sessionId={session.id}
                attachedFiles={attachedFiles}
                onAttach={(f) => setAttachedFiles((p) => [...p, f])}
                onDetach={(id) => setAttachedFiles((p) => p.filter((f) => f.id !== id))}
              />
            </div>
          )}

          {/* Attached files quick view when panel is closed */}
          {!showUpload && attachedFiles.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {attachedFiles.map((f) => (
                <span
                  key={f.id}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-blue-500/10 border border-blue-500/20 text-[11px] text-blue-400 max-w-[200px]"
                >
                  <span className="truncate">{f.originalName}</span>
                  <button
                    onClick={() => setAttachedFiles((p) => p.filter((x) => x.id !== f.id))}
                    className="shrink-0 hover:text-white transition-colors"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </span>
              ))}
            </div>
          )}

          {/* Input box */}
          <div className={cn(
            'relative rounded-2xl border transition-colors duration-150',
            sending
              ? 'bg-white/[0.02] border-blue-500/25'
              : 'bg-white/[0.035] border-white/[0.08] hover:border-white/[0.13] focus-within:border-blue-500/40 focus-within:bg-white/[0.05]',
          )}>
            <label htmlFor="chat-input" className="sr-only">Message</label>
            <textarea
              id="chat-input"
              ref={textareaRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              disabled={sending}
              placeholder={sending ? 'Working on it…' : 'Ask about your logs…'}
              rows={1}
              className={cn(
                'w-full resize-none bg-transparent px-4 pt-3.5 pb-11',
                'text-sm text-zinc-100 placeholder:text-zinc-600',
                'focus:outline-none leading-relaxed min-h-[50px] max-h-[160px]',
                sending && 'opacity-40 cursor-not-allowed',
              )}
            />

            {/* Bottom bar */}
            <div className="absolute bottom-0 left-0 right-0 flex items-center justify-between px-3 pb-2.5 pointer-events-none">
              {/* Left: attach */}
              <div className="pointer-events-auto">
                <button
                  type="button"
                  onClick={() => setShowUpload((v) => !v)}
                  disabled={sending}
                  className={cn(
                    'p-1.5 rounded-lg transition-all',
                    showUpload
                      ? 'text-blue-400 bg-blue-500/10'
                      : 'text-zinc-600 hover:text-zinc-300 hover:bg-white/[0.06]',
                    sending && 'opacity-30 cursor-not-allowed',
                  )}
                  title="Attach log file"
                >
                  <Paperclip className="h-3.5 w-3.5" />
                </button>
                {attachedFiles.length > 0 && !showUpload && (
                  <span className="text-[10px] text-blue-400 font-medium ml-1.5 align-middle">
                    {attachedFiles.length}
                  </span>
                )}
              </div>

              {/* Right: hint + send/stop */}
              <div className="flex items-center gap-2 pointer-events-auto">
                {sending ? (
                  <button
                    onClick={cancel}
                    className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs text-zinc-400 hover:text-red-400 hover:bg-red-500/10 transition-all"
                  >
                    <Square className="h-3 w-3 fill-current" />
                    Stop
                  </button>
                ) : (
                  <>
                    <span className="text-[10px] text-zinc-700 hidden sm:block select-none">
                      ⏎ Send&nbsp;&nbsp;⇧⏎ Newline
                    </span>
                    <button
                      onClick={handleSubmit}
                      disabled={!input.trim() || sending}
                      className={cn(
                        'flex items-center justify-center w-7 h-7 rounded-xl transition-all duration-150',
                        input.trim()
                          ? 'bg-gradient-to-br from-blue-500 to-blue-600 hover:from-blue-400 hover:to-cyan-500 text-white shadow-md shadow-blue-500/25'
                          : 'bg-white/[0.04] text-zinc-700 cursor-not-allowed',
                      )}
                    >
                      <ArrowUp className="h-3.5 w-3.5" />
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}