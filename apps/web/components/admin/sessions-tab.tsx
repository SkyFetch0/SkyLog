'use client'

import { useQuery } from '@tanstack/react-query'
import Link from 'next/link'
import { Loader2, MessageSquare, ExternalLink } from 'lucide-react'
import { adminApi } from '@/lib/api'

function timeAgo(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime()
  if (ms < 60_000) return 'just now'
  if (ms < 3_600_000) return `${Math.floor(ms / 60_000)}m ago`
  if (ms < 86_400_000) return `${Math.floor(ms / 3_600_000)}h ago`
  return `${Math.floor(ms / 86_400_000)}d ago`
}

export function SessionsTab() {
  const { data, isLoading, error } = useQuery({
    queryKey: ['admin', 'sessions'],
    queryFn: () => adminApi.sessions({ limit: 100 }),
    refetchInterval: 30_000,
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
        Failed to load sessions.
      </div>
    )
  }

  return (
    <div className="rounded-2xl border border-[hsl(var(--glass-border))] bg-[hsl(var(--surface-1))] overflow-hidden">
      {data.sessions.length === 0 ? (
        <div className="px-4 py-12 text-center text-sm text-muted-foreground">
          No sessions yet.
        </div>
      ) : (
        <table className="w-full text-sm">
          <thead className="bg-[hsl(var(--glass-bg))] border-b border-[hsl(var(--glass-border))]">
            <tr>
              <th className="text-left px-4 py-2.5 font-semibold text-[10px] uppercase tracking-widest text-muted-foreground">Title</th>
              <th className="text-left px-4 py-2.5 font-semibold text-[10px] uppercase tracking-widest text-muted-foreground">Owner</th>
              <th className="text-right px-4 py-2.5 font-semibold text-[10px] uppercase tracking-widest text-muted-foreground">Messages</th>
              <th className="text-left px-4 py-2.5 font-semibold text-[10px] uppercase tracking-widest text-muted-foreground">Updated</th>
              <th className="text-right px-4 py-2.5 font-semibold text-[10px] uppercase tracking-widest text-muted-foreground">Open</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[hsl(var(--glass-border))]">
            {data.sessions.map((s) => (
              <tr key={s.id} className="hover:bg-[hsl(var(--glass-bg))] transition-colors">
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2.5">
                    <MessageSquare className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                    <span className="text-foreground truncate max-w-[260px]">{s.title}</span>
                  </div>
                </td>
                <td className="px-4 py-3 text-muted-foreground text-xs truncate max-w-[200px]">{s.userEmail}</td>
                <td className="px-4 py-3 text-right text-foreground tabular-nums">{s.messageCount}</td>
                <td className="px-4 py-3 text-muted-foreground text-xs">{timeAgo(s.updatedAt)}</td>
                <td className="px-4 py-3 text-right">
                  <Link
                    href={`/chat/${s.id}`}
                    className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-[11px] text-primary hover:bg-primary/10 transition-colors"
                  >
                    Open <ExternalLink className="h-3 w-3" />
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {data.total > data.sessions.length && (
        <div className="px-4 py-3 border-t border-[hsl(var(--glass-border))] text-xs text-muted-foreground text-center">
          Showing {data.sessions.length} of {data.total} sessions
        </div>
      )}
    </div>
  )
}
