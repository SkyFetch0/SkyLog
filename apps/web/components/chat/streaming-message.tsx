'use client'

import { useState } from 'react'
import {
  ChevronDown, ChevronRight,
  Brain, CheckCircle2, XCircle, Loader2, Wrench,
  Clock, Zap, Bot, GitBranch, Terminal,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { MarkdownContent } from './message'
import type { StreamingMessage as StreamingMsg, LocalToolCall, LocalSubAgent } from '@/hooks/use-messages'

// ── Thinking block ────────────────────────────────────────────────────────────

function ThinkingBlock({ content, done }: { content: string; done: boolean }) {
  const [open, setOpen] = useState(false)
  if (!content) return null

  return (
    <div className="rounded-xl border border-violet-500/20 bg-violet-500/[0.04] overflow-hidden">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center gap-2.5 px-3.5 py-2.5 text-left hover:bg-violet-500/[0.06] transition-colors"
      >
        <Brain className={cn('h-3.5 w-3.5 shrink-0 text-violet-400', !done && 'animate-pulse')} />
        <span className="text-xs text-violet-300 font-medium flex-1">
          {done ? 'Reasoning complete' : 'Thinking…'}
        </span>
        <span className="text-[10px] text-violet-600 font-mono">{content.length} chars</span>
        {open
          ? <ChevronDown className="h-3 w-3 text-violet-500 shrink-0" />
          : <ChevronRight className="h-3 w-3 text-violet-500 shrink-0" />}
      </button>
      {open && (
        <div className="px-3.5 pb-3 border-t border-violet-500/15 pt-2.5">
          <pre className="text-[11px] text-violet-300/60 font-mono whitespace-pre-wrap break-words leading-relaxed max-h-64 overflow-y-auto scrollbar-thin">
            {content}
          </pre>
        </div>
      )}
    </div>
  )
}

// ── Tool call row ─────────────────────────────────────────────────────────────

const TOOL_ICONS: Record<string, string> = {
  log_stats:     '📊',
  log_sample:    '🔎',
  log_grep:      '🔍',
  read_file:     '📄',
  write_file:    '✏️',
  list_files:    '📁',
  bash_execute:  '⚡',
  spawn_agent:   '🤖',
}

function ToolCallRow({ tc, index }: { tc: LocalToolCall; index: number }) {
  const [open, setOpen] = useState(false)
  const icon = TOOL_ICONS[tc.toolName] ?? '🔧'

  const statusClass = tc.pending
    ? 'border-blue-500/25 bg-blue-500/[0.04]'
    : tc.success
    ? 'border-emerald-500/20 bg-emerald-500/[0.03]'
    : 'border-red-500/20 bg-red-500/[0.03]'

  return (
    <div className={cn('rounded-xl border overflow-hidden transition-all duration-200', statusClass)}>
      <button
        className="w-full flex items-center gap-2.5 px-3.5 py-2.5 text-left hover:brightness-110 transition-all"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
      >
        {/* Step number */}
        <span className="text-[9px] font-mono text-muted-foreground/50 w-4 shrink-0 text-right">{index + 1}</span>

        {/* Status icon */}
        {tc.pending
          ? <Loader2 className="h-3 w-3 animate-spin text-blue-400 shrink-0" />
          : tc.success
          ? <CheckCircle2 className="h-3 w-3 text-emerald-400 shrink-0" />
          : <XCircle className="h-3 w-3 text-red-400 shrink-0" />}

        {/* Tool icon + name */}
        <span className="text-[11px] shrink-0">{icon}</span>
        <span className={cn(
          'font-mono text-[11px] font-medium flex-1 truncate',
          tc.pending ? 'text-blue-300' : tc.success ? 'text-emerald-300' : 'text-red-300'
        )}>
          {tc.toolName}
        </span>

        {/* Duration / running badge */}
        {tc.pending ? (
          <span className="text-[10px] text-blue-500 animate-pulse shrink-0">running…</span>
        ) : tc.durationMs !== undefined ? (
          <span className="flex items-center gap-0.5 text-[10px] text-muted-foreground/70 shrink-0">
            <Clock className="h-2.5 w-2.5" />{tc.durationMs}ms
          </span>
        ) : null}

        {open
          ? <ChevronDown className="h-3 w-3 text-muted-foreground/70 shrink-0" />
          : <ChevronRight className="h-3 w-3 text-muted-foreground/70 shrink-0" />}
      </button>

      {open && (
        <div className="border-t border-[hsl(var(--glass-border))] divide-y divide-[hsl(var(--glass-border))]">
          {/* Input */}
          <div className="px-3.5 py-2.5">
            <p className="text-[9px] uppercase tracking-widest font-semibold text-muted-foreground/70 mb-1.5 flex items-center gap-1">
              <Terminal className="h-2.5 w-2.5" /> Input
            </p>
            <pre className="text-[11px] font-mono text-muted-foreground whitespace-pre-wrap break-all leading-relaxed">
              {JSON.stringify(tc.input, null, 2)}
            </pre>
          </div>

          {/* Output */}
          {tc.output !== undefined && (
            <div className="px-3.5 py-2.5">
              <p className="text-[9px] uppercase tracking-widest font-semibold text-muted-foreground/70 mb-1.5 flex items-center gap-1">
                {tc.success
                  ? <CheckCircle2 className="h-2.5 w-2.5 text-success" />
                  : <XCircle className="h-2.5 w-2.5 text-destructive" />}
                Output
              </p>
              <pre className="text-[11px] font-mono text-muted-foreground whitespace-pre-wrap break-all leading-relaxed max-h-48 overflow-y-auto">
                {tc.output}
              </pre>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ── Sub-agent card with live nested "sub-task" view (Cursor-style) ────────────
//
// Click the card → expands into a compact "agent-inside-an-agent" panel:
//   1. Task description
//   2. Live thinking block
//   3. Tool call timeline (each tool the sub-agent fires, with input/output)
//   4. Streamed text response
//   5. Final result (after sub_agent_completed)
//
// All four sections stream in real-time as sub_agent_* SSE events arrive.

function SubAgentRow({ agent, index }: { agent: LocalSubAgent; index: number }) {
  const [open, setOpen] = useState(false)

  const running = agent.status === 'running'
  const failed = agent.status === 'failed'

  // Border + accent color tracks status
  const tone = failed
    ? 'border-red-500/25 bg-red-500/[0.03]'
    : running
    ? 'border-amber-500/25 bg-amber-500/[0.04]'
    : 'border-emerald-500/20 bg-emerald-500/[0.03]'

  const statusBadge = failed
    ? { label: 'failed',    cls: 'bg-red-500/10 text-red-400 border-red-500/20' }
    : running
    ? { label: 'running',   cls: 'bg-amber-500/10 text-amber-400 border-amber-500/20 animate-pulse' }
    : { label: 'done',      cls: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' }

  const toolCount   = agent.toolCalls.length
  const toolDone    = agent.toolCalls.filter((t) => !t.pending).length
  const toolPending = toolCount - toolDone

  return (
    <div className={cn('rounded-xl border overflow-hidden transition-all', tone)}>
      <button
        className="w-full flex items-center gap-2.5 px-3.5 py-2.5 text-left hover:brightness-110 transition-all"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
      >
        <GitBranch className={cn('h-3 w-3 shrink-0', failed ? 'text-red-400' : running ? 'text-amber-400' : 'text-emerald-400')} />
        <Bot className={cn('h-3 w-3 shrink-0', failed ? 'text-red-400/70' : running ? 'text-amber-400/70' : 'text-emerald-400/70')} />
        <span className={cn(
          'text-[11px] font-medium flex-1 truncate',
          failed ? 'text-red-300' : running ? 'text-amber-300' : 'text-emerald-300',
        )}>
          {agent.role}
        </span>

        {/* Live tool counter while running */}
        {toolCount > 0 && (
          <span className="text-[10px] text-muted-foreground/70 font-mono shrink-0">
            {toolDone}/{toolCount} tools
          </span>
        )}

        <span className={cn(
          'text-[9px] px-1.5 py-0.5 rounded-md border font-semibold uppercase tracking-wider shrink-0',
          statusBadge.cls,
        )}>
          {statusBadge.label}
        </span>

        <span className="text-[9px] px-1.5 py-0.5 rounded-md bg-muted/20 border border-[hsl(var(--glass-border))] text-muted-foreground font-mono shrink-0">
          #{index + 1}
        </span>

        {open
          ? <ChevronDown className="h-3 w-3 text-muted-foreground/70 shrink-0" />
          : <ChevronRight className="h-3 w-3 text-muted-foreground/70 shrink-0" />}
      </button>

      {open && (
        <SubAgentDetails agent={agent} live={running} toolPending={toolPending} />
      )}
    </div>
  )
}

function SubAgentDetails({
  agent,
  live,
  toolPending,
}: {
  agent: LocalSubAgent
  live: boolean
  toolPending: number
}) {
  return (
    <div className="border-t border-[hsl(var(--glass-border))] divide-y divide-[hsl(var(--glass-border))] bg-background/30">
      {/* Task */}
      <div className="px-3.5 py-2.5">
        <p className="text-[9px] uppercase tracking-widest font-semibold text-muted-foreground/70 mb-1.5">Task</p>
        <p className="text-[11px] text-foreground/80 leading-relaxed whitespace-pre-wrap break-words">
          {agent.task}
        </p>
      </div>

      {/* Sub-agent's own thinking */}
      {agent.thinkingContent && (
        <div className="px-3.5 py-2.5">
          <details>
            <summary className="cursor-pointer text-[9px] uppercase tracking-widest font-semibold text-violet-400/80 flex items-center gap-1 mb-1.5">
              <Brain className={cn('h-2.5 w-2.5', live && !agent.content && 'animate-pulse')} />
              Reasoning ({agent.thinkingContent.length} chars)
            </summary>
            <pre className="text-[10px] font-mono text-violet-300/50 whitespace-pre-wrap break-words leading-relaxed max-h-40 overflow-y-auto scrollbar-thin mt-1.5">
              {agent.thinkingContent}
            </pre>
          </details>
        </div>
      )}

      {/* Sub-agent's tool timeline */}
      {agent.toolCalls.length > 0 && (
        <div className="px-3.5 py-2.5">
          <div className="flex items-center gap-2 mb-1.5">
            <Wrench className="h-2.5 w-2.5 text-muted-foreground/70" />
            <p className="text-[9px] uppercase tracking-widest font-semibold text-muted-foreground/70">
              Tool activity
            </p>
            {toolPending > 0 && (
              <span className="text-[10px] text-blue-500 animate-pulse">{toolPending} running</span>
            )}
          </div>
          <div className="space-y-1">
            {agent.toolCalls.map((tc, idx) => (
              <SubAgentToolRow key={tc.id} tc={tc} index={idx} />
            ))}
          </div>
        </div>
      )}

      {/* Streamed text (response from the sub-agent) */}
      {agent.content && (
        <div className="px-3.5 py-2.5">
          <p className="text-[9px] uppercase tracking-widest font-semibold text-muted-foreground/70 mb-1.5">
            Response
          </p>
          <pre className="text-[11px] font-mono text-foreground/85 whitespace-pre-wrap break-words leading-relaxed max-h-64 overflow-y-auto scrollbar-thin">
            {agent.content}
            {live && <span className="cursor-blink" />}
          </pre>
        </div>
      )}

      {/* Final result (JSON or text) — only after sub_agent_completed */}
      {!live && agent.result && (
        <div className="px-3.5 py-2.5">
          <p className="text-[9px] uppercase tracking-widest font-semibold text-muted-foreground/70 mb-1.5 flex items-center gap-1">
            <CheckCircle2 className="h-2.5 w-2.5 text-success" />
            Final result
            {agent.tokensUsed !== undefined && (
              <span className="ml-2 text-muted-foreground/60 font-mono normal-case tracking-normal">
                {agent.tokensUsed.toLocaleString()} tok
              </span>
            )}
            {agent.durationMs !== undefined && (
              <span className="text-muted-foreground/60 font-mono normal-case tracking-normal">
                · {(agent.durationMs / 1000).toFixed(1)}s
              </span>
            )}
          </p>
          <pre className="text-[10px] font-mono text-foreground/75 whitespace-pre-wrap break-all leading-relaxed max-h-72 overflow-y-auto scrollbar-thin bg-[hsl(var(--surface-2))] rounded-lg p-2.5">
            {agent.result}
          </pre>
        </div>
      )}

      {/* Error */}
      {agent.error && (
        <div className="px-3.5 py-2.5 bg-red-500/[0.03]">
          <p className="text-[9px] uppercase tracking-widest font-semibold text-red-400 mb-1.5">Error</p>
          <p className="text-[11px] text-red-300/80 leading-relaxed whitespace-pre-wrap break-words font-mono">
            {agent.error}
          </p>
        </div>
      )}
    </div>
  )
}

// Compact tool row used INSIDE a sub-agent's detail panel. Smaller than the
// top-level ToolCallRow so the nested view doesn't dominate the chat.
function SubAgentToolRow({ tc, index }: { tc: LocalToolCall; index: number }) {
  const [open, setOpen] = useState(false)
  const icon = TOOL_ICONS[tc.toolName] ?? '🔧'

  const tone = tc.pending
    ? 'border-blue-500/25 bg-blue-500/[0.04]'
    : tc.success
    ? 'border-emerald-500/15 bg-emerald-500/[0.02]'
    : 'border-red-500/20 bg-red-500/[0.03]'

  return (
    <div className={cn('rounded-lg border overflow-hidden text-[10px]', tone)}>
      <button
        type="button"
        className="w-full flex items-center gap-2 px-2.5 py-1.5 text-left hover:brightness-110 transition-all"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
      >
        <span className="text-[9px] font-mono text-muted-foreground/50 w-3 shrink-0 text-right">{index + 1}</span>
        {tc.pending
          ? <Loader2 className="h-2.5 w-2.5 animate-spin text-blue-400 shrink-0" />
          : tc.success
          ? <CheckCircle2 className="h-2.5 w-2.5 text-emerald-400 shrink-0" />
          : <XCircle className="h-2.5 w-2.5 text-red-400 shrink-0" />}
        <span className="shrink-0 text-[10px]">{icon}</span>
        <span className={cn(
          'font-mono font-medium flex-1 truncate',
          tc.pending ? 'text-blue-300' : tc.success ? 'text-emerald-300/90' : 'text-red-300',
        )}>
          {tc.toolName}
        </span>
        {tc.pending ? (
          <span className="text-[9px] text-blue-500 animate-pulse shrink-0">…</span>
        ) : tc.durationMs !== undefined ? (
          <span className="text-[9px] text-muted-foreground/70 font-mono shrink-0">{tc.durationMs}ms</span>
        ) : null}
        {open
          ? <ChevronDown className="h-2.5 w-2.5 text-muted-foreground/70 shrink-0" />
          : <ChevronRight className="h-2.5 w-2.5 text-muted-foreground/70 shrink-0" />}
      </button>
      {open && (
        <div className="border-t border-[hsl(var(--glass-border))] divide-y divide-[hsl(var(--glass-border))]">
          <div className="px-2.5 py-2">
            <p className="text-[8px] uppercase tracking-widest font-semibold text-muted-foreground/60 mb-1">Input</p>
            <pre className="text-[10px] font-mono text-muted-foreground whitespace-pre-wrap break-all leading-relaxed max-h-32 overflow-y-auto">
              {JSON.stringify(tc.input, null, 2)}
            </pre>
          </div>
          {tc.output !== undefined && (
            <div className="px-2.5 py-2">
              <p className="text-[8px] uppercase tracking-widest font-semibold text-muted-foreground/60 mb-1">Output</p>
              <pre className="text-[10px] font-mono text-muted-foreground whitespace-pre-wrap break-all leading-relaxed max-h-32 overflow-y-auto">
                {tc.output}
              </pre>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ── Activity timeline header ──────────────────────────────────────────────────

function ActivityTimeline({
  toolCalls,
  subAgents,
  isActive,
}: {
  toolCalls: LocalToolCall[]
  subAgents: LocalSubAgent[]
  isActive: boolean
}) {
  const total = toolCalls.length + subAgents.length
  if (total === 0) return null

  const done = toolCalls.filter((t) => !t.pending).length
  const pending = toolCalls.filter((t) => t.pending).length
  const failed = toolCalls.filter((t) => !t.pending && !t.success).length

  return (
    <div className="flex items-center gap-2 px-1 mb-1">
      <Wrench className="h-3 w-3 text-muted-foreground/70 shrink-0" />
      <span className="text-[10px] text-muted-foreground/70 font-medium">
        {total} action{total !== 1 ? 's' : ''}
      </span>
      {done > 0 && (
        <span className="text-[10px] text-emerald-600">{done} done</span>
      )}
      {pending > 0 && (
        <span className="text-[10px] text-blue-500 animate-pulse">{pending} running</span>
      )}
      {failed > 0 && (
        <span className="text-[10px] text-red-500">{failed} failed</span>
      )}
      {subAgents.length > 0 && (
        <span className="text-[10px] text-amber-500">{subAgents.length} sub-agent{subAgents.length !== 1 ? 's' : ''}</span>
      )}
      {isActive && (
        <span className="ml-auto flex gap-0.5">
          {[0, 1, 2].map((i) => (
            <span
              key={i}
              className="w-1 h-1 rounded-full bg-blue-400 animate-bounce"
              style={{ animationDelay: `${i * 150}ms` }}
            />
          ))}
        </span>
      )}
    </div>
  )
}

// ── Phase indicator (no tools/thinking yet) ───────────────────────────────────

function PhaseIndicator({ phase }: { phase: StreamingMsg['phase'] }) {
  if (phase === 'done') return null

  const config: Record<string, { label: string; color: string }> = {
    thinking:   { label: 'Reasoning…',       color: 'bg-violet-400' },
    tool:       { label: 'Executing tool…',   color: 'bg-blue-400' },
    responding: { label: 'Writing response…', color: 'bg-emerald-400' },
  }
  const c = config[phase] ?? config.thinking

  return (
    <div className="flex items-center gap-2 py-1.5 px-1">
      <span className="flex gap-1">
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            className={cn('w-1.5 h-1.5 rounded-full animate-bounce', c.color)}
            style={{ animationDelay: `${i * 150}ms` }}
          />
        ))}
      </span>
      <span className="text-xs text-muted-foreground">{c.label}</span>
    </div>
  )
}

// ── Main streaming component ──────────────────────────────────────────────────

export function StreamingMessage({ msg }: { msg: StreamingMsg }) {
  const hasTools     = msg.toolCalls.length > 0
  const hasSubAgents = msg.subAgents.length > 0
  const hasThinking  = msg.thinkingContent.length > 0
  const hasContent   = msg.content.length > 0
  const isActive     = msg.streaming
  const hasActivity  = hasTools || hasSubAgents

  // Interleave tool calls and sub-agents in spawn order for a timeline view
  type TimelineItem =
    | { kind: 'tool'; item: LocalToolCall; idx: number }
    | { kind: 'agent'; item: LocalSubAgent; idx: number }

  const timeline: TimelineItem[] = [
    ...msg.toolCalls.map((item, idx) => ({ kind: 'tool' as const, item, idx, ts: item.startedAt })),
    ...msg.subAgents.map((item, idx) => ({ kind: 'agent' as const, item, idx, ts: item.spawnedAt })),
  ].sort((a, b) => a.ts - b.ts)

  return (
    <div className="flex justify-start mb-6 gap-3 msg-enter">
      {/* AI avatar */}
      <div className={cn(
        'w-7 h-7 rounded-lg flex items-center justify-center shrink-0 mt-0.5 transition-all duration-300',
        isActive
          ? 'bg-gradient-to-br from-blue-500/30 to-violet-500/20 border border-blue-400/30 shadow-md shadow-blue-500/10'
          : 'bg-gradient-to-br from-blue-500/20 to-cyan-500/10 border border-blue-500/20',
      )}>
        {isActive
          ? <Zap className="w-3.5 h-3.5 text-blue-300 animate-pulse" />
          : <span className="text-[11px]">✦</span>}
      </div>

      {/* Content column */}
      <div className="flex-1 min-w-0 space-y-2">

        {/* Thinking */}
        {hasThinking && (
          <ThinkingBlock
            content={msg.thinkingContent}
            done={!isActive || hasContent}
          />
        )}

        {/* Activity timeline */}
        {hasActivity && (
          <div className="space-y-1.5">
            <ActivityTimeline
              toolCalls={msg.toolCalls}
              subAgents={msg.subAgents}
              isActive={isActive && !hasContent}
            />
            {timeline.map((entry) =>
              entry.kind === 'tool' ? (
                <ToolCallRow key={entry.item.id} tc={entry.item} index={entry.idx} />
              ) : (
                <SubAgentRow key={entry.item.id} agent={entry.item} index={entry.idx} />
              ),
            )}
          </div>
        )}

        {/* Phase indicator — show while waiting and nothing else visible */}
        {isActive && !hasContent && !hasThinking && !hasActivity && (
          <PhaseIndicator phase={msg.phase} />
        )}

        {/* Transitional indicator — tools done, waiting for response text */}
        {isActive && !hasContent && hasActivity && (
          <PhaseIndicator phase="responding" />
        )}

        {/* Final answer */}
        {hasContent && (
          <div className="rounded-2xl rounded-tl-sm bg-[hsl(var(--surface-1))] border border-[hsl(var(--border))] px-4 py-3.5 text-sm text-foreground/90 shadow-[0_2px_12px_-6px_hsl(var(--foreground)/0.12)]">
            <MarkdownContent content={msg.content} />
            {isActive && <span className="cursor-blink" />}
          </div>
        )}
      </div>
    </div>
  )
}