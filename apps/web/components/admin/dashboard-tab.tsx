'use client'

import { useQuery } from '@tanstack/react-query'
import {
  Users, MessageSquare, Activity, Coins, FileText, Zap, AlertTriangle, Clock,
  CheckCircle2, XCircle, Loader2, Hash,
} from 'lucide-react'
import { adminApi, type AdminAgentRun } from '@/lib/api'
import { cn } from '@/lib/utils'
import { StatCard } from './stat-card'

function formatTokens(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`
  return n.toString()
}

function formatDuration(start: string | null, end: string | null): string {
  if (!start) return '—'
  const endTs = end ? new Date(end).getTime() : Date.now()
  const ms = endTs - new Date(start).getTime()
  if (ms < 1000) return `${ms}ms`
  if (ms < 60_000) return `${(ms / 1000).toFixed(1)}s`
  return `${Math.floor(ms / 60_000)}m ${Math.floor((ms % 60_000) / 1000)}s`
}

function StatusIcon({ status }: { status: AdminAgentRun['status'] }) {
  switch (status) {
    case 'running':   return <Loader2 className="h-3 w-3 animate-spin text-primary shrink-0" />
    case 'completed': return <CheckCircle2 className="h-3 w-3 text-success shrink-0" />
    case 'failed':    return <XCircle className="h-3 w-3 text-destructive shrink-0" />
    default:          return <Clock className="h-3 w-3 text-muted-foreground shrink-0" />
  }
}

export function DashboardTab() {
  const stats = useQuery({
    queryKey: ['admin', 'stats'],
    queryFn: adminApi.stats,
    refetchInterval: 30_000,
  })

  const recent = useQuery({
    queryKey: ['admin', 'recent-runs'],
    queryFn: adminApi.recentRuns,
    refetchInterval: 10_000,
  })

  if (stats.isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (stats.error || !stats.data) {
    return (
      <div className="rounded-2xl border border-destructive/30 bg-destructive/[0.04] p-6 text-sm text-destructive">
        Failed to load admin stats. Make sure your account has admin privileges.
      </div>
    )
  }

  const s = stats.data

  return (
    <div className="space-y-6">
      {/* ¦¦ Primary stats grid ¦¦¦¦¦¦¦¦¦¦¦¦¦¦¦¦¦¦¦¦¦¦¦¦¦¦¦¦¦¦¦¦¦¦¦¦¦¦¦¦ */}
      <div>
        <h3 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-3">
          Overview
        </h3>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <StatCard label="Users"    value={s.users}    icon={Users}          accent="primary" />
          <StatCard label="Sessions" value={s.sessions} icon={MessageSquare}  accent="primary" />
          <StatCard label="Messages" value={s.messages} icon={Hash}           accent="muted" />
          <StatCard label="Files"    value={s.files}    icon={FileText}       accent="muted" />
        </div>
      </div>

      {/* ¦¦ Activity stats ¦¦¦¦¦¦¦¦¦¦¦¦¦¦¦¦¦¦¦¦¦¦¦¦¦¦¦¦¦¦¦¦¦¦¦¦¦¦¦¦¦¦¦¦¦ */}
      <div>
        <h3 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-3">
          Activity
        </h3>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <StatCard
            label="Active users (7d)"
            value={s.activeUsers7d}
            icon={Activity}
            accent="success"
          />
          <StatCard
            label="Running agents"
            value={s.activeRuns}
            icon={Zap}
            accent={s.activeRuns > 0 ? 'primary' : 'muted'}
            trend={
              s.activeRuns > 0 && (
                <span className="text-[11px] text-primary flex items-center gap-1">
                  <span className="flex gap-0.5">
                    {[0,1,2].map(i => (
                      <span key={i} className="w-1 h-1 rounded-full bg-primary animate-bounce" style={{ animationDelay: `${i*150}ms` }} />
                    ))}
                  </span>
                  in progress
                </span>
              )
            }
          />
          <StatCard
            label="Failed (24h)"
            value={s.failedRuns24h}
            icon={AlertTriangle}
            accent={s.failedRuns24h > 0 ? 'destructive' : 'muted'}
          />
          <StatCard
            label="Tokens (24h)"
            value={formatTokens(s.tokens24h)}
            icon={Coins}
            accent="warning"
            trend={
              <span className="text-[11px] text-muted-foreground">
                Total: {formatTokens(s.tokensTotal)}
              </span>
            }
          />
        </div>
      </div>

      {/* ¦¦ Recent agent runs ¦¦¦¦¦¦¦¦¦¦¦¦¦¦¦¦¦¦¦¦¦¦¦¦¦¦¦¦¦¦¦¦¦¦¦¦¦¦¦¦¦¦ */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
            Recent Agent Runs
          </h3>
          {recent.isFetching && <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />}
        </div>
        <div className="rounded-2xl border border-[hsl(var(--glass-border))] bg-[hsl(var(--surface-1))] overflow-hidden">
          {recent.data && recent.data.length > 0 ? (
            <ul className="divide-y divide-[hsl(var(--glass-border))]">
              {recent.data.map((r) => (
                <li
                  key={r.id}
                  className={cn(
                    'flex items-center gap-3 px-4 py-2.5 text-xs transition-colors',
                    'hover:bg-[hsl(var(--glass-bg))]',
                  )}
                >
                  <StatusIcon status={r.status} />
                  <span className="font-mono text-foreground/90 shrink-0 w-32 truncate">
                    {r.role}
                  </span>
                  <span className="text-muted-foreground shrink-0 w-44 truncate">{r.userEmail}</span>
                  <span className="text-muted-foreground/70 flex-1 truncate min-w-0">{r.task}</span>
                  <span className="text-muted-foreground/80 tabular-nums shrink-0">
                    {r.tokensUsed > 0 ? `${formatTokens(r.tokensUsed)} tok` : '—'}
                  </span>
                  <span className="text-muted-foreground/70 tabular-nums shrink-0 w-16 text-right">
                    {formatDuration(r.startedAt, r.completedAt)}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <div className="px-4 py-12 text-center text-xs text-muted-foreground">
              No agent runs yet.
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
