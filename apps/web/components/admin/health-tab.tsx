'use client'

import { useQuery, useQueryClient } from '@tanstack/react-query'
import { CheckCircle2, XCircle, Database, Box, Wrench, Clock, RefreshCw, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { adminApi } from '@/lib/api'

export function HealthTab() {
  const qc = useQueryClient()
  const { data, isLoading, error, isFetching } = useQuery({
    queryKey: ['admin', 'health'],
    queryFn: adminApi.health,
    refetchInterval: 15_000,
  })

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="rounded-2xl border border-destructive/30 bg-destructive/[0.04] p-6 text-sm text-destructive">
        Failed to fetch health status.
      </div>
    )
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <p className="text-xs text-muted-foreground">
          Last checked: {new Date(data.timestamp).toLocaleTimeString()}
        </p>
        <Button
          variant="outline"
          size="sm"
          loading={isFetching}
          leftIcon={<RefreshCw />}
          onClick={() => qc.invalidateQueries({ queryKey: ['admin', 'health'] })}
        >
          Refresh
        </Button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <ServiceCard
          name="Database (PostgreSQL)"
          status={data.database}
          icon={Database}
          description="Drizzle ORM connection pool"
        />
        <ServiceCard
          name="Sandbox (Docker)"
          status={data.sandbox}
          icon={Box}
          description="Tool execution environment"
        />
      </div>

      <div className="rounded-2xl border border-[hsl(var(--glass-border))] bg-[hsl(var(--surface-1))] p-5">
        <h3 className="text-sm font-semibold text-foreground mb-4">Tool Execution Stats</h3>
        <div className="grid grid-cols-2 gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0">
              <Wrench className="h-4 w-4 text-primary" />
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold">Total tool calls</p>
              <p className="text-2xl font-bold text-foreground tabular-nums">{data.toolCalls.toLocaleString()}</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-warning/10 border border-warning/20 flex items-center justify-center shrink-0">
              <Clock className="h-4 w-4 text-warning" />
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold">Avg duration</p>
              <p className="text-2xl font-bold text-foreground tabular-nums">{data.avgToolDurationMs}<span className="text-sm text-muted-foreground ml-1">ms</span></p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function ServiceCard({
  name, status, icon: Icon, description,
}: {
  name: string
  status: 'ok' | 'error'
  icon: React.ComponentType<{ className?: string }>
  description: string
}) {
  const ok = status === 'ok'
  return (
    <div
      className={cn(
        'rounded-2xl border p-4 flex items-center gap-4',
        ok
          ? 'border-success/25 bg-success/[0.04]'
          : 'border-destructive/30 bg-destructive/[0.04]',
      )}
    >
      <div className={cn(
        'w-11 h-11 rounded-xl border flex items-center justify-center shrink-0',
        ok ? 'border-success/30 bg-success/10 text-success' : 'border-destructive/30 bg-destructive/10 text-destructive',
      )}>
        <Icon className="h-5 w-5" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <p className="text-sm font-semibold text-foreground">{name}</p>
          {ok
            ? <CheckCircle2 className="h-4 w-4 text-success" />
            : <XCircle className="h-4 w-4 text-destructive" />}
        </div>
        <p className="text-xs text-muted-foreground mt-0.5">{description}</p>
      </div>
      <span className={cn(
        'text-[10px] font-bold uppercase tracking-widest px-2 py-1 rounded-md border shrink-0',
        ok
          ? 'text-success bg-success/10 border-success/30'
          : 'text-destructive bg-destructive/10 border-destructive/30',
      )}>
        {status}
      </span>
    </div>
  )
}
