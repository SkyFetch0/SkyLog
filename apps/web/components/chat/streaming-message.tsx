'use client'

import { useState } from 'react'
import {
  ChevronDown, ChevronRight,
  Brain, CheckCircle2, XCircle, Loader2, Wrench, Zap, Clock,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { MarkdownContent } from './message'
import type { StreamingMessage as StreamingMsg, LocalToolCall } from '@/hooks/use-messages'

// ── Thinking block ────────────────────────────────────────────────────────────

function ThinkingBlock({ content, done }: { content: string; done: boolean }) {
  const [open, setOpen] = useState(false)
  if (!content) return null

  return (
    <div className="mb-2 rounded-xl border border-violet-500/20 bg-violet-500/5 overflow-hidden">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-violet-500/8 transition-colors"
      >
        <Brain className={cn('h-3.5 w-3.5 shrink-0', done ? 'text-violet-400' : 'text-violet-400 animate-pulse')} />
        <span className="text-xs text-violet-300 font-medium flex-1">
          {done ? 'Reasoning complete' : 'Thinking…'}
        </span>
        <span className="text-[10px] text-violet-500">{content.length} chars</span>
        {open
          ? <ChevronDown className="h-3 w-3 text-violet-500 shrink-0" />
          : <ChevronRight className="h-3 w-3 text-violet-500 shrink-0" />}
      </button>

      {open && (
        <div className="px-3 pb-3 border-t border-violet-500/15">
          <pre className="mt-2 text-[11px] text-violet-300/70 font-mono whitespace-pre-wrap break-words leading-relaxed max-h-60 overflow-y-auto">
            {content}
          </pre>
        </div>
      )}
    </div>
  )
}

// ── Tool call row ─────────────────────────────────────────────────────────────

function ToolCallRow({ tc }: { tc: LocalToolCall }) {
  const [open, setOpen] = useState(false)

  const statusColor = tc.pending
    ? 'text-blue-400 border-blue-500/20 bg-blue-500/5'
    : tc.success
    ? 'text-emerald-400 border-emerald-500/20 bg-emerald-500/5'
    : 'text-red-400 border-red-500/20 bg-red-500/5'

  return (
    <div className={cn('rounded-xl border overflow-hidden transition-all', statusColor)}>
      <button
        className="w-full flex items-center gap-2 px-3 py-2 text-left hover:brightness-110 transition-all"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
      >
        {tc.pending
          ? <Loader2 className="h-3 w-3 animate-spin shrink-0" />
          : tc.success
          ? <CheckCircle2 className="h-3 w-3 shrink-0" />
          : <XCircle className="h-3 w-3 shrink-0" />}
        <Wrench className="h-3 w-3 text-current/50 shrink-0" />
        <span className="font-mono text-[11px] font-medium flex-1 text-left truncate">{tc.toolName}</span>
        {tc.pending && (
          <span className="text-[10px] opacity-60 animate-pulse">running…</span>
        )}
        {!tc.pending && tc.durationMs !== undefined && (
          <span className="flex items-center gap-0.5 text-[10px] opacity-60">
            <Clock className="h-2.5 w-2.5" />{tc.durationMs}ms
          </span>
        )}
        {open
          ? <ChevronDown className="h-3 w-3 opacity-50 shrink-0" />
          : <ChevronRight className="h-3 w-3 opacity-50 shrink-0" />}
      </button>

      {open && (
        <div className="border-t border-current/10 divide-y divide-current/10">
          <div className="px-3 py-2">
            <p className="text-[9px] uppercase tracking-widest font-semibold opacity-50 mb-1.5">Input</p>
            <pre className="text-[11px] font-mono whitespace-pre-wrap break-all leading-relaxed opacity-80">
              {JSON.stringify(tc.input, null, 2)}
            </pre>
          </div>
          {tc.output !== undefined && (
            <div className="px-3 py-2">
              <p className="text-[9px] uppercase tracking-widest font-semibold opacity-50 mb-1.5">Output</p>
              <pre className="text-[11px] font-mono whitespace-pre-wrap break-all leading-relaxed opacity-80 max-h-52 overflow-y-auto">
                {tc.output}
              </pre>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ── Phase indicator ───────────────────────────────────────────────────────────

function PhaseIndicator({ phase }: { phase: StreamingMsg['phase'] }) {
  if (phase === 'done') return null
  const labels: Record<string, string> = {
    thinking: 'Reasoning…',
    tool: 'Executing tool…',
    responding: 'Writing response…',
  }
  return (
    <div className="flex items-center gap-2 py-2">
      <span className="flex gap-1">
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            className={cn(
              'w-1.5 h-1.5 rounded-full animate-bounce',
              phase === 'thinking' ? 'bg-violet-400' :
              phase === 'tool' ? 'bg-blue-400' : 'bg-emerald-400',
            )}
            style={{ animationDelay: `${i * 150}ms` }}
          />
        ))}
      </span>
      <span className="text-xs text-zinc-500">{labels[phase]}</span>
    </div>
  )
}

// ── Main streaming component ──────────────────────────────────────────────────

export function StreamingMessage({ msg }: { msg: StreamingMsg }) {
  const hasTools = msg.toolCalls.length > 0
  const hasThinking = msg.thinkingContent.length > 0
  const hasContent = msg.content.length > 0
  const isActive = msg.streaming

  return (
    <div className="flex justify-start mb-5 gap-3 msg-enter">
      {/* AI avatar */}
      <div className={cn(
        'w-7 h-7 rounded-lg flex items-center justify-center shrink-0 mt-0.5 transition-all',
        isActive
          ? 'bg-gradient-to-br from-blue-500/30 to-violet-500/20 border border-blue-400/30 shadow-md shadow-blue-500/10'
          : 'bg-gradient-to-br from-blue-500/20 to-cyan-500/10 border border-blue-500/20',
      )}>
        {isActive
          ? <Zap className="w-3.5 h-3.5 text-blue-300 animate-pulse" />
          : <span className="text-[11px]">✦</span>}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0 space-y-2">
        {/* Thinking block */}
        {hasThinking && (
          <ThinkingBlock
            content={msg.thinkingContent}
            done={!isActive || hasContent}
          />
        )}

        {/* Tool calls */}
        {hasTools && (
          <div className="space-y-1.5">
            {msg.toolCalls.map((tc) => (
              <ToolCallRow key={tc.id} tc={tc} />
            ))}
          </div>
        )}

        {/* Phase indicator (shown when nothing else visible yet) */}
        {isActive && !hasContent && !hasThinking && !hasTools && (
          <PhaseIndicator phase={msg.phase} />
        )}

        {/* Phase indicator between tools and response */}
        {isActive && !hasContent && (hasThinking || hasTools) && (
          <PhaseIndicator phase={msg.phase} />
        )}

        {/* Final answer */}
        {hasContent && (
          <div className="rounded-2xl rounded-tl-sm bg-white/[0.04] border border-white/[0.07] px-4 py-3.5 text-sm text-zinc-200">
            <MarkdownContent content={msg.content} />
            {isActive && <span className="cursor-blink" />}
          </div>
        )}
      </div>
    </div>
  )
}