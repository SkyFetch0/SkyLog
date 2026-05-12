'use client'

import { useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { CheckCircle2, XCircle, Clock, Loader2, ChevronRight, ChevronDown, Wrench, Cpu, RefreshCw } from 'lucide-react'
import { cn } from '@/lib/utils'
import { ScrollArea } from '@/components/ui/scroll-area'
import { useAgentRuns } from '@/hooks/use-agent-runs'
import type { AgentRun } from '@/lib/types'

interface Props {
  sessionId: string
  hasActiveRun: boolean
}

export function AgentPanel({ sessionId, hasActiveRun }: Props) {
  const qc = useQueryClient()
  const { data: runs = [], isLoading } = useAgentRuns(sessionId, hasActiveRun)
  const [collapsed, setCollapsed] = useState(false)

  if (collapsed) {
    return (
      <button
        onClick={() => setCollapsed(false)}
        className="w-10 shrink-0 flex flex-col items-center justify-center border-l border-[hsl(var(--glass-border))] bg-sidebar text-muted-foreground/70 hover:text-foreground transition-colors gap-1"
        aria-label="Expand agent activity panel"
      >
        <Cpu className="h-4 w-4" />
        {runs.length > 0 && (
          <span className="text-[10px] font-mono">{runs.length}</span>
        )}
      </button>
    )
  }

  return (
    <aside className="w-[300px] shrink-0 flex flex-col border-l border-[hsl(var(--glass-border))] bg-sidebar">
      {/* Header */}
      <div className="flex items-center justify-between h-16 px-4 border-b border-[hsl(var(--glass-border))]">
        <div className="flex items-center gap-2">
          <div className="w-5 h-5 rounded-md bg-primary/10 border border-primary/20 flex items-center justify-center">
            <Cpu className="h-3 w-3 text-primary" />
          </div>
          <span className="text-xs font-semibold text-foreground/85 tracking-wide">Agent Activity</span>
          {hasActiveRun && (
            <span className="flex gap-0.5">
              {[0,1,2].map(i => (
                <span key={i} className="w-1 h-1 rounded-full bg-primary animate-bounce" style={{ animationDelay: `${i * 150}ms` }} />
              ))}
            </span>
          )}
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => qc.invalidateQueries({ queryKey: ['agent-runs', sessionId] })}
            className="p-1.5 rounded-lg text-muted-foreground/70 hover:text-foreground hover:bg-[hsl(var(--glass-bg))] transition-all"
            title="Refresh"
            aria-label="Refresh agent runs"
          >
            <RefreshCw className="h-3 w-3" />
          </button>
          <button
            onClick={() => setCollapsed(true)}
            className="p-1.5 rounded-lg text-muted-foreground/70 hover:text-foreground hover:bg-[hsl(var(--glass-bg))] transition-all"
            title="Collapse panel"
            aria-label="Collapse panel"
          >
            <ChevronRight className="h-3 w-3" />
          </button>
        </div>
      </div>

      <ScrollArea className="flex-1">
        <div className="p-3 space-y-2">
          {isLoading && (
            <div className="flex items-center justify-center py-10">
              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground/60" />
            </div>
          )}
          {!isLoading && runs.length === 0 && (
            <div className="flex flex-col items-center justify-center py-12 gap-3 text-center">
              <div className="w-10 h-10 rounded-xl bg-[hsl(var(--glass-bg))] border border-[hsl(var(--glass-border))] flex items-center justify-center">
                <Cpu className="h-4 w-4 text-muted-foreground/60" />
              </div>
              <p className="text-xs text-muted-foreground/80 max-w-[160px] leading-relaxed">
                Agent activity will appear here when you start an analysis.
              </p>
            </div>
          )}
          {runs.map((run) => (
            <AgentRunNode key={run.id} run={run} depth={0} />
          ))}
        </div>
      </ScrollArea>
    </aside>
  )
}

const MAX_AGENT_DEPTH = 10

function AgentRunNode({ run, depth }: { run: AgentRun; depth: number }) {
  const [expanded, setExpanded] = useState(depth === 0)
  const hasChildren = (run.children?.length ?? 0) > 0

  if (depth > MAX_AGENT_DEPTH) {
    return <div className="ml-4 text-xs text-muted-foreground/50 py-1 px-3">…max depth reached</div>
  }

  const duration =
    run.startedAt && run.completedAt
      ? `${((new Date(run.completedAt).getTime() - new Date(run.startedAt).getTime()) / 1000).toFixed(1)}s`
      : run.status === 'running' ? 'running…' : null

  const isOrchestrator = depth === 0

  return (
    <div className={cn(
      'rounded-xl overflow-hidden border transition-all',
      isOrchestrator
        ? 'border-[hsl(var(--glass-border))] bg-[hsl(var(--glass-bg))]'
        : 'ml-3 border-[hsl(var(--glass-border))] bg-[hsl(var(--glass-bg))]',
    )}>
      <button
        className="w-full flex items-center gap-2 px-3 py-2.5 text-left hover:bg-[hsl(var(--glass-bg))] transition-colors"
        onClick={() => setExpanded((v) => !v)}
        aria-expanded={expanded}
        aria-label={`${expanded ? 'Collapse' : 'Expand'} agent: ${run.role}`}
      >
        <StatusIcon status={run.status} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-[11px] font-medium text-foreground/85 truncate">{run.role}</span>
            {isOrchestrator && (
              <span className="text-[9px] px-1.5 py-0.5 rounded-md bg-primary/10 border border-primary/20 text-primary font-semibold uppercase tracking-wider">
                orchestrator
              </span>
            )}
          </div>
          <div className="flex items-center gap-2 mt-0.5">
            {duration && (
              <span className="text-[10px] text-muted-foreground/70 flex items-center gap-0.5">
                <Clock className="h-2.5 w-2.5" /> {duration}
              </span>
            )}
            {run.tokensUsed > 0 && (
              <span className="text-[10px] text-muted-foreground/60">{run.tokensUsed.toLocaleString()} tok</span>
            )}
          </div>
        </div>
        {hasChildren && (
          expanded
            ? <ChevronDown className="h-3 w-3 text-muted-foreground/70 shrink-0" />
            : <ChevronRight className="h-3 w-3 text-muted-foreground/70 shrink-0" />
        )}
      </button>

      {expanded && (
        <>
          {run.task && (
            <div className="px-3 pb-2.5 border-t border-[hsl(var(--glass-border))]">
              <p className="text-[10px] text-muted-foreground/80 mt-2 leading-relaxed line-clamp-3">{run.task}</p>
            </div>
          )}
          {hasChildren && (
            <div className="px-2 pb-2 space-y-1.5 border-t border-[hsl(var(--glass-border))] pt-2">
              {run.children?.map((child) => (
                <AgentRunNode key={child.id} run={child} depth={depth + 1} />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  )
}

function StatusIcon({ status }: { status: AgentRun['status'] }) {
  switch (status) {
    case 'running':   return <Loader2 className="h-3 w-3 animate-spin text-primary shrink-0" />
    case 'completed': return <CheckCircle2 className="h-3 w-3 text-success shrink-0" />
    case 'failed':    return <XCircle className="h-3 w-3 text-destructive shrink-0" />
    default:          return <Wrench className="h-3 w-3 text-muted-foreground/60 shrink-0" />
  }
}