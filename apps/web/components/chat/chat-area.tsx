'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { ArrowUp, Square, Paperclip, X, Shield, Zap, Search, BarChart3 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Message } from './message'
import { StreamingMessage } from './streaming-message'
import { FileUpload } from './file-upload'
import { Button } from '@/components/ui/button'
import { useMessages } from '@/hooks/use-messages'
import { useSendMessage } from '@/hooks/use-send-message'
import type { Message as MsgType, SessionDetail, FileRecord } from '@/lib/types'
import type { SseEvent } from '@/lib/types'

const SUGGESTED_PROMPTS = [
  {
    icon: Shield,
    label: 'Security audit',
    prompt: 'Run a full security audit on this log — brute force, SQL injection, suspicious IPs, scanner activity.',
    accent: 'text-red-400 bg-red-500/10 border-red-500/20',
  },
  {
    icon: Zap,
    label: 'Performance',
    prompt: 'Find the slowest queries and the worst performance bottlenecks in this log.',
    accent: 'text-amber-400 bg-amber-500/10 border-amber-500/20',
  },
  {
    icon: Search,
    label: 'Errors & crashes',
    prompt: 'Cluster all errors by pattern, list crashes, OOM events, and connectivity failures with timestamps.',
    accent: 'text-violet-400 bg-violet-500/10 border-violet-500/20',
  },
  {
    icon: BarChart3,
    label: 'Traffic analysis',
    prompt: 'Show top IPs, popular endpoints, peak hours, and traffic anomalies.',
    accent: 'text-cyan-400 bg-cyan-500/10 border-cyan-500/20',
  },
] as const

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
    <div className="flex flex-col h-full min-h-0 bg-background">

      {/* ── Header ─────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between h-16 px-6 border-b border-border shrink-0 bg-background/80 backdrop-blur-sm">
        <h1 className="font-semibold text-sm text-foreground/90 truncate max-w-[60%]">{session.title}</h1>
        {sending && (
          <div className="flex items-center gap-2 text-xs text-primary animate-pulse">
            <span className="flex gap-1">
              {[0,1,2].map(i => (
                <span key={i} className="w-1 h-1 rounded-full bg-primary animate-bounce" style={{ animationDelay: `${i*150}ms` }} />
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
            <div className="flex flex-col items-center justify-center py-16 text-center gap-6 select-none">
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-primary/20 to-[hsl(199_89%_55%/0.15)] border border-primary/25 flex items-center justify-center shadow-soft">
                <span className="text-3xl">✦</span>
              </div>
              <div className="space-y-1.5">
                <p className="gradient-text text-base font-semibold">Ready to analyze your logs</p>
                <p className="text-muted-foreground text-xs max-w-sm leading-relaxed">
                  Upload a log file and pick a starting question — or type your own below.
                </p>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 w-full max-w-md mt-2">
                {SUGGESTED_PROMPTS.map((p) => {
                  const Icon = p.icon
                  return (
                    <button
                      key={p.label}
                      onClick={() => { setInput(p.prompt); textareaRef.current?.focus() }}
                      className={cn(
                        'group flex items-start gap-3 p-3.5 rounded-xl text-left transition-all',
                        'border border-[hsl(var(--glass-border))] bg-[hsl(var(--glass-bg))]',
                        'hover:border-primary/30 hover:bg-[hsl(var(--glass-bg))] hover-lift',
                      )}
                    >
                      <div className={cn(
                        'shrink-0 w-8 h-8 rounded-lg border flex items-center justify-center',
                        p.accent,
                      )}>
                        <Icon className="w-4 h-4" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs font-semibold text-foreground">{p.label}</p>
                        <p className="text-[11px] text-muted-foreground mt-0.5 leading-snug line-clamp-2">
                          {p.prompt}
                        </p>
                      </div>
                    </button>
                  )
                })}
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
                    <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-primary/30 to-primary/10 border border-primary/30 flex items-center justify-center shrink-0 mt-0.5">
                      <span className="text-[11px] text-primary animate-pulse">✦</span>
                    </div>
                    <div className="flex items-center gap-2 px-4 py-3 rounded-2xl rounded-tl-sm bg-[hsl(var(--surface-1))] border border-[hsl(var(--border))] shadow-[0_2px_12px_-6px_hsl(var(--foreground)/0.10)]">
                      <span className="flex gap-1">
                        {[0,1,2].map(i => (
                          <span key={i} className="w-1.5 h-1.5 rounded-full bg-primary animate-bounce" style={{ animationDelay: `${i*150}ms` }} />
                        ))}
                      </span>
                      <span className="text-xs text-muted-foreground">Thinking…</span>
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
      <div className="shrink-0 px-4 pb-4 pt-2">
        <div className="max-w-2xl mx-auto space-y-2">

          {/* File upload panel */}
          {showUpload && (
            <div className="rounded-xl bg-[hsl(var(--glass-bg))] border border-[hsl(var(--glass-border))] p-3">
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
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-primary/10 border border-primary/20 text-[11px] text-primary max-w-[200px]"
                >
                  <span className="truncate">{f.originalName}</span>
                  <button
                    onClick={() => setAttachedFiles((p) => p.filter((x) => x.id !== f.id))}
                    className="shrink-0 hover:text-foreground transition-colors"
                    aria-label={`Remove ${f.originalName}`}
                  >
                    <X className="h-3 w-3" />
                  </button>
                </span>
              ))}
            </div>
          )}

          {/* Input box — modern card with soft shadow + glass */}
          <div className={cn(
            'relative rounded-2xl border transition-all duration-200',
            'bg-[hsl(var(--surface-1))] shadow-[0_8px_28px_-14px_hsl(var(--foreground)/0.18)]',
            sending
              ? 'border-primary/30'
              : 'border-[hsl(var(--border))] hover:border-[hsl(var(--border-strong))] focus-within:border-primary/45 focus-within:shadow-[0_0_0_3px_hsl(var(--primary)/0.12),0_12px_32px_-12px_hsl(var(--primary)/0.20)]',
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
                'w-full resize-none bg-transparent px-4 pt-3.5 pb-12',
                'text-sm text-foreground placeholder:text-muted-foreground/60',
                'focus:outline-none leading-relaxed min-h-[52px] max-h-[160px]',
                sending && 'opacity-40 cursor-not-allowed',
              )}
            />

            {/* Bottom bar */}
            <div className="absolute bottom-0 left-0 right-0 flex items-center justify-between px-2 pb-2 pointer-events-none">
              {/* Left: attach */}
              <div className="pointer-events-auto flex items-center gap-1">
                <Button
                  type="button"
                  variant={showUpload ? 'secondary' : 'ghost'}
                  size="icon-sm"
                  onClick={() => setShowUpload((v) => !v)}
                  disabled={sending}
                  className={cn(showUpload && 'text-primary border-primary/30 bg-primary/10')}
                  aria-label="Attach log file"
                  title="Attach log file"
                >
                  <Paperclip />
                </Button>
                {attachedFiles.length > 0 && !showUpload && (
                  <span className="text-[10px] text-primary font-semibold px-1.5 py-0.5 rounded-md bg-primary/10 border border-primary/20">
                    {attachedFiles.length}
                  </span>
                )}
              </div>

              {/* Right: hint + send/stop */}
              <div className="flex items-center gap-2 pointer-events-auto">
                {sending ? (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={cancel}
                    leftIcon={<Square className="fill-current" />}
                    className="text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                  >
                    Stop
                  </Button>
                ) : (
                  <>
                    <span className="text-[10px] text-muted-foreground/70 hidden sm:block select-none">
                      ⏎ Send&nbsp;&nbsp;⇧⏎ Newline
                    </span>
                    <Button
                      variant="primary"
                      size="icon-sm"
                      onClick={handleSubmit}
                      disabled={!input.trim() || sending}
                      aria-label="Send message"
                    >
                      <ArrowUp />
                    </Button>
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