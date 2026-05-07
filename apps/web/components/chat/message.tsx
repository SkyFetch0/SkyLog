'use client'

import { useState } from 'react'
import ReactMarkdown from 'react-markdown'
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter'
import { oneDark } from 'react-syntax-highlighter/dist/esm/styles/prism'
import {
  ChevronRight, ChevronDown,
  Brain, CheckCircle2, XCircle, Loader2, Wrench,
  Clock, Terminal, Bot, GitBranch,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import type { Message as MsgType } from '@/lib/types'
import type { LocalToolCall, LocalSubAgent } from '@/hooks/use-messages'

// ── Markdown renderer ─────────────────────────────────────────────────────────

export function MarkdownContent({ content }: { content: string }) {
  return (
    <ReactMarkdown
      className="prose prose-sm prose-invert max-w-none
        prose-p:leading-relaxed prose-p:my-1.5
        prose-headings:text-white prose-headings:font-semibold
        prose-strong:text-white prose-strong:font-semibold
        prose-li:my-0.5 prose-ul:my-2 prose-ol:my-2
        prose-code:text-blue-300 prose-code:bg-blue-500/10 prose-code:px-1.5 prose-code:py-0.5 prose-code:rounded-md prose-code:text-[12px] prose-code:font-mono prose-code:border-none
        prose-pre:p-0 prose-pre:bg-transparent prose-pre:my-2"
      components={{
        code({ className, children, ...props }) {
          const match = /language-(\w+)/.exec(className ?? '')
          const isBlock = !!match
          return isBlock ? (
            <SyntaxHighlighter
              style={oneDark as never}
              language={match[1]}
              PreTag="div"
              className="!rounded-xl !text-[12px] !my-2 !bg-[#0d1117] border border-white/[0.06]"
            >
              {String(children).replace(/\n$/, '')}
            </SyntaxHighlighter>
          ) : (
            <code className="bg-blue-500/10 text-blue-300 px-1.5 py-0.5 rounded-md text-[12px] font-mono not-prose" {...props}>
              {children}
            </code>
          )
        },
      }}
    >
      {content}
    </ReactMarkdown>
  )
}

// ── Thinking block (kalıcı) ───────────────────────────────────────────────────

function ThinkingBlock({ content }: { content: string }) {
  const [open, setOpen] = useState(false)
  if (!content) return null

  return (
    <div className="rounded-xl border border-violet-500/20 bg-violet-500/[0.04] overflow-hidden">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center gap-2.5 px-3.5 py-2.5 text-left hover:bg-violet-500/[0.06] transition-colors"
      >
        <Brain className="h-3.5 w-3.5 shrink-0 text-violet-400" />
        <span className="text-xs text-violet-300 font-medium flex-1">Reasoning complete</span>
        <span className="text-[10px] text-violet-600 font-mono">{content.length} chars</span>
        {open
          ? <ChevronDown className="h-3 w-3 text-violet-500 shrink-0" />
          : <ChevronRight className="h-3 w-3 text-violet-500 shrink-0" />}
      </button>
      {open && (
        <div className="px-3.5 pb-3 border-t border-violet-500/15 pt-2.5">
          <pre className="text-[11px] text-violet-300/60 font-mono whitespace-pre-wrap break-words leading-relaxed max-h-64 overflow-y-auto">
            {content}
          </pre>
        </div>
      )}
    </div>
  )
}

// ── Tool call card (kalıcı) ───────────────────────────────────────────────────

const TOOL_ICONS: Record<string, string> = {
  log_stats:    '📊',
  log_sample:   '🔎',
  log_grep:     '🔍',
  read_file:    '📄',
  write_file:   '✏️',
  list_files:   '📁',
  bash_execute: '⚡',
  spawn_agent:  '🤖',
}

export function ToolCallCard({ tc, index }: { tc: LocalToolCall; index: number }) {
  const [open, setOpen] = useState(false)
  const icon = TOOL_ICONS[tc.toolName] ?? '🔧'

  const statusClass = tc.success === false
    ? 'border-red-500/20 bg-red-500/[0.03]'
    : 'border-emerald-500/20 bg-emerald-500/[0.03]'

  return (
    <div className={cn('rounded-xl border overflow-hidden', statusClass)}>
      <button
        className="w-full flex items-center gap-2.5 px-3.5 py-2.5 text-left hover:brightness-110 transition-all"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
      >
        <span className="text-[9px] font-mono text-zinc-700 w-4 shrink-0 text-right">{(index ?? 0) + 1}</span>

        {tc.success === false
          ? <XCircle className="h-3 w-3 text-red-400 shrink-0" />
          : <CheckCircle2 className="h-3 w-3 text-emerald-400 shrink-0" />}

        <span className="text-[11px] shrink-0">{icon}</span>
        <span className={cn(
          'font-mono text-[11px] font-medium flex-1 truncate',
          tc.success === false ? 'text-red-300' : 'text-emerald-300',
        )}>
          {tc.toolName}
        </span>

        {tc.durationMs !== undefined && (
          <span className="flex items-center gap-0.5 text-[10px] text-zinc-600 shrink-0">
            <Clock className="h-2.5 w-2.5" />{tc.durationMs}ms
          </span>
        )}

        {open
          ? <ChevronDown className="h-3 w-3 text-zinc-600 shrink-0" />
          : <ChevronRight className="h-3 w-3 text-zinc-600 shrink-0" />}
      </button>

      {open && (
        <div className="border-t border-white/[0.05] divide-y divide-white/[0.04]">
          <div className="px-3.5 py-2.5">
            <p className="text-[9px] uppercase tracking-widest font-semibold text-zinc-600 mb-1.5 flex items-center gap-1">
              <Terminal className="h-2.5 w-2.5" /> Input
            </p>
            <pre className="text-[11px] font-mono text-zinc-400 whitespace-pre-wrap break-all leading-relaxed">
              {JSON.stringify(tc.input, null, 2)}
            </pre>
          </div>
          {tc.output !== undefined && (
            <div className="px-3.5 py-2.5">
              <p className="text-[9px] uppercase tracking-widest font-semibold text-zinc-600 mb-1.5 flex items-center gap-1">
                {tc.success === false
                  ? <XCircle className="h-2.5 w-2.5 text-red-500" />
                  : <CheckCircle2 className="h-2.5 w-2.5 text-emerald-500" />}
                Output
              </p>
              <pre className="text-[11px] font-mono text-zinc-400 whitespace-pre-wrap break-all leading-relaxed max-h-48 overflow-y-auto">
                {tc.output}
              </pre>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ── Sub-agent card (kalıcı) ───────────────────────────────────────────────────

function SubAgentCard({ agent, index }: { agent: LocalSubAgent; index: number }) {
  const [open, setOpen] = useState(false)

  return (
    <div className="rounded-xl border border-amber-500/20 bg-amber-500/[0.03] overflow-hidden">
      <button
        className="w-full flex items-center gap-2.5 px-3.5 py-2.5 text-left hover:bg-amber-500/[0.05] transition-colors"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
      >
        <GitBranch className="h-3 w-3 text-amber-400 shrink-0" />
        <Bot className="h-3 w-3 text-amber-400/70 shrink-0" />
        <span className="text-[11px] font-medium text-amber-300 flex-1 truncate">{agent.role}</span>
        <span className="text-[9px] px-1.5 py-0.5 rounded-md bg-amber-500/10 border border-amber-500/20 text-amber-500 font-semibold uppercase tracking-wider shrink-0">
          sub-agent #{index + 1}
        </span>
        {open
          ? <ChevronDown className="h-3 w-3 text-amber-600 shrink-0" />
          : <ChevronRight className="h-3 w-3 text-amber-600 shrink-0" />}
      </button>
      {open && (
        <div className="px-3.5 pb-3 border-t border-amber-500/10 pt-2.5">
          <p className="text-[9px] uppercase tracking-widest font-semibold text-amber-700 mb-1.5">Task</p>
          <p className="text-[11px] text-amber-300/70 leading-relaxed font-mono whitespace-pre-wrap break-words">
            {agent.task}
          </p>
        </div>
      )}
    </div>
  )
}

// ── Activity summary header ───────────────────────────────────────────────────

function ActivitySummary({
  toolCalls,
  subAgents,
}: {
  toolCalls: LocalToolCall[]
  subAgents: LocalSubAgent[]
}) {
  const total = toolCalls.length + subAgents.length
  if (total === 0) return null

  const failed = toolCalls.filter((t) => t.success === false).length

  return (
    <div className="flex items-center gap-2 px-1 mb-1">
      <Wrench className="h-3 w-3 text-zinc-600 shrink-0" />
      <span className="text-[10px] text-zinc-600 font-medium">
        {total} action{total !== 1 ? 's' : ''}
      </span>
      {failed > 0 && (
        <span className="text-[10px] text-red-500">{failed} failed</span>
      )}
      {subAgents.length > 0 && (
        <span className="text-[10px] text-amber-500">
          {subAgents.length} sub-agent{subAgents.length !== 1 ? 's' : ''}
        </span>
      )}
    </div>
  )
}

// ── User message ──────────────────────────────────────────────────────────────

export function UserMessage({ message }: { message: MsgType }) {
  return (
    <div className="flex justify-end mb-5 msg-enter">
      <div className="max-w-[78%] rounded-2xl rounded-tr-sm bg-gradient-to-br from-blue-600 to-blue-700 px-4 py-3 text-sm text-white shadow-lg shadow-blue-500/10">
        <p className="whitespace-pre-wrap break-words leading-relaxed">{message.content}</p>
      </div>
    </div>
  )
}

// ── Assistant message (kalıcı — stream bitti) ─────────────────────────────────

export function AssistantMessage({ message }: { message: MsgType }) {
  const toolCalls = message.toolCalls ?? []
  const subAgents = message.subAgents ?? []

  // Chronological timeline of tools + sub-agents
  type TimelineEntry =
    | { kind: 'tool'; item: LocalToolCall; idx: number }
    | { kind: 'agent'; item: LocalSubAgent; idx: number }

  const timeline: TimelineEntry[] = [
    ...toolCalls.map((item, idx) => ({ kind: 'tool' as const, item, idx, ts: item.startedAt })),
    ...subAgents.map((item, idx) => ({ kind: 'agent' as const, item, idx, ts: item.spawnedAt })),
  ].sort((a, b) => a.ts - b.ts)

  const hasActivity = timeline.length > 0

  return (
    <div className="flex justify-start mb-6 gap-3 msg-enter">
      {/* Avatar */}
      <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-blue-500/20 to-cyan-500/10 border border-blue-500/20 flex items-center justify-center shrink-0 mt-0.5">
        <span className="text-[11px]">✦</span>
      </div>

      <div className="flex-1 min-w-0 space-y-2">
        {/* Thinking */}
        {message.thinkingContent && (
          <ThinkingBlock content={message.thinkingContent} />
        )}

        {/* Tool calls + sub-agents timeline */}
        {hasActivity && (
          <div className="space-y-1.5">
            <ActivitySummary toolCalls={toolCalls} subAgents={subAgents} />
            {timeline.map((entry) =>
              entry.kind === 'tool' ? (
                <ToolCallCard key={entry.item.id} tc={entry.item} index={entry.idx} />
              ) : (
                <SubAgentCard key={entry.item.id} agent={entry.item} index={entry.idx} />
              ),
            )}
          </div>
        )}

        {/* Final answer */}
        <div className="rounded-2xl rounded-tl-sm bg-white/[0.04] border border-white/[0.07] px-4 py-3.5 text-sm text-zinc-200">
          <MarkdownContent content={message.content} />
        </div>
      </div>
    </div>
  )
}

// ── Generic message dispatcher ────────────────────────────────────────────────

export function Message({ message }: { message: MsgType }) {
  if (message.role === 'user') return <UserMessage message={message} />
  return <AssistantMessage message={message} />
}