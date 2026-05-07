'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Zap, Plus, MessageSquare, Trash2, LogOut, ChevronLeft, ChevronRight, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { sessionsApi } from '@/lib/api'
import { useAuthStore } from '@/lib/auth'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import type { Session } from '@/lib/types'

export function Sidebar() {
  const pathname = usePathname()
  const router = useRouter()
  const qc = useQueryClient()
  const { user, logout } = useAuthStore()
  const [collapsed, setCollapsed] = useState(false)

  const { data: sessions = [], isLoading } = useQuery({
    queryKey: ['sessions'],
    queryFn: sessionsApi.list,
  })

  const createMut = useMutation({
    mutationFn: () => sessionsApi.create(),
    onSuccess: (session) => {
      qc.invalidateQueries({ queryKey: ['sessions'] })
      router.push(`/chat/${session.id}`)
    },
    onError: () => toast.error('Failed to create session'),
  })

  const deleteMut = useMutation({
    mutationFn: (id: string) => sessionsApi.delete(id),
    onSuccess: (_, id) => {
      qc.invalidateQueries({ queryKey: ['sessions'] })
      if (pathname === `/chat/${id}`) router.push('/chat')
    },
    onError: () => toast.error('Failed to delete session'),
  })

  const handleLogout = () => {
    logout()
    router.replace('/login')
  }

  return (
    <TooltipProvider delayDuration={200}>
      <aside
        className={cn(
          'flex flex-col h-screen bg-[#080c16] border-r border-white/[0.06] transition-all duration-300 shrink-0 relative',
          collapsed ? 'w-[58px]' : 'w-[240px]',
        )}
      >
        {/* Toggle button */}
        <button
          onClick={() => setCollapsed((v) => !v)}
          className="absolute -right-3 top-[22px] z-10 w-6 h-6 rounded-full bg-[#0d1321] border border-white/[0.1] flex items-center justify-center text-zinc-500 hover:text-zinc-300 hover:border-white/20 transition-all shadow-lg"
        >
          {collapsed ? <ChevronRight className="h-3 w-3" /> : <ChevronLeft className="h-3 w-3" />}
        </button>

        {/* Logo */}
        <div className={cn('flex items-center h-14 px-3 border-b border-white/[0.06]', collapsed ? 'justify-center' : 'gap-2.5 px-4')}>
          <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center shrink-0 shadow-md shadow-blue-500/20">
            <Zap className="w-3.5 h-3.5 text-white" />
          </div>
          {!collapsed && (
            <Link href="/chat" className="font-bold text-sm text-white tracking-tight truncate">
              SkyLog
            </Link>
          )}
        </div>

        {/* New Analysis Button */}
        <div className={cn('p-3', collapsed ? 'flex justify-center' : '')}>
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                onClick={() => createMut.mutate()}
                disabled={createMut.isPending}
                className={cn(
                  'flex items-center gap-2.5 rounded-xl text-sm font-medium transition-all duration-200',
                  'bg-gradient-to-r from-blue-600/90 to-blue-500/90 hover:from-blue-500 hover:to-cyan-500',
                  'text-white shadow-md shadow-blue-500/20 hover:shadow-blue-500/30',
                  'disabled:opacity-50 disabled:cursor-not-allowed',
                  collapsed ? 'w-9 h-9 justify-center' : 'w-full px-3 py-2.5',
                )}
              >
                {createMut.isPending
                  ? <Loader2 className="h-4 w-4 animate-spin shrink-0" />
                  : <Plus className="h-4 w-4 shrink-0" />
                }
                {!collapsed && <span>New Analysis</span>}
              </button>
            </TooltipTrigger>
            {collapsed && <TooltipContent side="right">New Analysis</TooltipContent>}
          </Tooltip>
        </div>

        {/* Session list */}
        <ScrollArea className="flex-1 px-2">
          {!collapsed && (
            <p className="px-2 py-2 text-[10px] font-semibold uppercase tracking-widest text-zinc-600">
              Recent Sessions
            </p>
          )}

          {isLoading ? (
            <div className="flex justify-center py-6">
              <Loader2 className="h-4 w-4 animate-spin text-zinc-600" />
            </div>
          ) : sessions.length === 0 ? (
            !collapsed && (
              <p className="px-2 py-3 text-xs text-zinc-600 text-center leading-relaxed">
                No sessions yet.{' '}
                <button onClick={() => createMut.mutate()} className="text-blue-400 hover:text-blue-300 transition-colors">
                  Start one
                </button>
              </p>
            )
          ) : (
            <div className="space-y-0.5 pb-2">
              {sessions.map((session: Session) => (
                <SessionItem
                  key={session.id}
                  session={session}
                  active={pathname === `/chat/${session.id}`}
                  collapsed={collapsed}
                  onDelete={() => deleteMut.mutate(session.id)}
                  isDeleting={deleteMut.isPending && deleteMut.variables === session.id}
                />
              ))}
            </div>
          )}
        </ScrollArea>

        {/* Footer */}
        <div className="p-3 border-t border-white/[0.06]">
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                onClick={handleLogout}
                className={cn(
                  'flex items-center gap-2.5 w-full rounded-xl text-xs text-zinc-500 hover:text-red-400 hover:bg-red-500/8 transition-all px-2 py-2',
                  collapsed && 'justify-center px-0',
                )}
              >
                <LogOut className="h-3.5 w-3.5 shrink-0" />
                {!collapsed && <span className="truncate">{user?.email ?? 'Sign out'}</span>}
              </button>
            </TooltipTrigger>
            {collapsed && <TooltipContent side="right">Sign out</TooltipContent>}
          </Tooltip>
        </div>
      </aside>
    </TooltipProvider>
  )
}

function SessionItem({
  session, active, collapsed, onDelete, isDeleting,
}: {
  session: Session
  active: boolean
  collapsed: boolean
  onDelete: () => void
  isDeleting: boolean
}) {
  const [hovered, setHovered] = useState(false)

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <div
          className={cn(
            'group flex items-center gap-2 rounded-xl px-2 py-2 cursor-pointer transition-all duration-150',
            active
              ? 'bg-blue-500/12 text-white'
              : 'text-zinc-500 hover:bg-white/[0.04] hover:text-zinc-300',
            collapsed && 'justify-center px-0 w-9 h-9 mx-auto',
          )}
          onMouseEnter={() => setHovered(true)}
          onMouseLeave={() => setHovered(false)}
        >
          <MessageSquare className={cn('h-3.5 w-3.5 shrink-0', active && 'text-blue-400')} />
          {!collapsed && (
            <>
              <Link
                href={`/chat/${session.id}`}
                className="flex-1 min-w-0 text-xs leading-tight"
              >
                <span className="block truncate">{session.title}</span>
              </Link>
              {hovered && (
                <button
                  onClick={(e) => { e.preventDefault(); onDelete() }}
                  disabled={isDeleting}
                  aria-label={`Delete session: ${session.title}`}
                  className="shrink-0 text-zinc-600 hover:text-red-400 transition-colors p-0.5 rounded-lg hover:bg-red-500/10"
                >
                  {isDeleting ? <Loader2 className="h-3 w-3 animate-spin" /> : <Trash2 className="h-3 w-3" />}
                </button>
              )}
            </>
          )}
        </div>
      </TooltipTrigger>
      {collapsed && <TooltipContent side="right">{session.title}</TooltipContent>}
    </Tooltip>
  )
}