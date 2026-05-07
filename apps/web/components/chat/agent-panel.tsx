'use client'

import { useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import {
  Bot, CheckCircle2, XCircle, Clock, Loader2,
  ChevronRight, ChevronDown, Wrench, RefreshCw,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { useAgentRuns } from '@/hooks/use-agent-runs'
import type { AgentRun } from '@/lib/types'

interface Props {
  sessionId: string
  hasActiveRun: boolean
}

export function AgentPanel({ sessionId, hasActiveRun }: Props) {
  const qc = useQueryClient()
  const { data: runs = [], isLoading } = useAgentRuns(sessionId, hasActiveRun)

  return (
    <aside className="w-[340px] shrink-0 flex flex-col border-l border-zinc-800 bg-zinc-950">
      <div className="flex items-center justify-between h-14 px-4 border-b border-zinc-800">
        <div className="flex items-center gap-2">
          <Bot className="h-4 w-4 text-zinc-500" />
          <span className="text-sm font-medium text-zinc-300">Agent Activity</span>
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7 text-zinc-500 hover:text-zinc-300"
          onClick={() => qc.invalidateQueries({ queryKey: ['agent-runs', sessionId] })}
        >
          <RefreshCw className="h-3.5 w-3.5" />
        </Button>
      </div>

      <ScrollArea className="flex-1">
        <div className="p-3 space-y-2">
          {isLoading && (
            <div className="flex items-center justify-center py-10">
              <Loader2 className="h-4 w-4 animate-spin text-zinc-600" />
            </div>
          )}
          {!isLoading && runs.length === 0 && (
            <p className="text-xs text-zinc-600 text-center py-10">
              No agent runs yet.
            </p>
          )}
          {runs.map((run) => (
            <AgentRunNode key={run.id} run={run} depth={0} />
          ))}
        </div>
      </ScrollArea>
    </aside>
  )
}

function AgentRunNode({ run, depth }: { run: AgentRun; depth: number }) {
  const [expanded, setExpanded] = useState(depth === 0)
  const hasChildren = (run.children?.length ?? 0) > 0

  const duration =
    run.startedAt && run.completedAt
      ? `${((new Date(run.completedAt).getTime() - new Date(run.startedAt).getTime()) / 1000).toFixed(1)}s`
      : run.status === 'running'
      ? 'running…'
      : null

  return (
    <div className={cn('rounded-lg overflow-hidden', depth === 0 ? 'border border-zinc-800 bg-zinc-900' : 'ml-4 border border-zinc-800/50 bg-zinc-900/60')}>
      <button
        className="w-full flex items-center gap-2 px-3 py-2.5 text-left hover:bg-zinc-800/40 transition-colors"
        onClick={() => setExpanded((v) => !v)}
      >
        <StatusIcon status={run.status} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <span className="text-xs font-medium text-zinc-300 truncate">{run.role}</span>
            {depth === 0 && (
              <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4 border-zinc-700 text-zinc-500">
                orchestrator
              </Badge>
            )}
          </div>
          <div className="flex items-center gap-2 mt-0.5">
            {duration && (
              <span className="text-[10px] text-zinc-600 flex items-center gap-0.5">
                <Clock className="h-2.5 w-2.5" /> {duration}
              </span>
            )}
            {run.tokensUsed > 0 && (
              <span className="text-[10px] text-zinc-600">{run.tokensUsed.toLocaleString()} tok</span>
            )}
          </div>
        </div>
        {hasChildren && (
          expanded
            ? <ChevronDown className="h-3.5 w-3.5 text-zinc-600 shrink-0" />
            : <ChevronRight className="h-3.5 w-3.5 text-zinc-600 shrink-0" />
        )}
      </button>

      {expanded && (
        <>
          {run.task && (
            <div className="px-3 pb-2 border-t border-zinc-800/50">
              <p className="text-[11px] text-zinc-500 mt-2 line-clamp-2">{run.task}</p>
            </div>
          )}
          {hasChildren && (
            <div className="px-2 pb-2 space-y-1.5 border-t border-zinc-800/50 pt-2">
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
    case 'running':
      return <Loader2 className="h-3.5 w-3.5 animate-spin text-blue-400 shrink-0" />
    case 'completed':
      return <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400 shrink-0" />
    case 'failed':
      return <XCircle className="h-3.5 w-3.5 text-red-400 shrink-0" />
    default:
      return <Wrench className="h-3.5 w-3.5 text-zinc-600 shrink-0" />
  }
}