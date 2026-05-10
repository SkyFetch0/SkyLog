'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import Image from 'next/image'
import { Plus, MessageSquare, Trash2, LogOut, ChevronLeft, ChevronRight, Loader2, Settings, ShieldCheck } from 'lucide-react'
import { Button } from '@/components/ui/button'
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
          'flex flex-col h-screen bg-sidebar border-r border-sidebar-border transition-all duration-300 shrink-0 relative',
          collapsed ? 'w-[58px]' : 'w-[240px]',
        )}
      >
        {/* Toggle button */}
        <button
          onClick={() => setCollapsed((v) => !v)}
          className="absolute -right-3 top-[22px] z-10 w-6 h-6 rounded-full bg-[hsl(var(--surface-2))] border border-[hsl(var(--border-strong))] flex items-center justify-center text-muted-foreground hover:text-foreground hover:border-primary/40 transition-all shadow-lg"
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {collapsed ? <ChevronRight className="h-3 w-3" /> : <ChevronLeft className="h-3 w-3" />}
        </button>

        {/* Logo */}
        <div className={cn('flex items-center h-14 border-b border-sidebar-border', collapsed ? 'justify-center px-3' : 'px-4')}>
          <Link href="/chat" className="flex items-center gap-2.5 shrink-0">
            <Image
              src="/images/SkyLogo.png"
              alt="SkyLog"
              width={28}
              height={28}
              className="rounded-lg object-contain shrink-0"
              priority
            />
            {!collapsed && (
              <span className="font-bold text-sm text-foreground tracking-tight truncate">SkyLog</span>
            )}
          </Link>
        </div>

        {/* New Analysis Button */}
        <div className={cn('p-3', collapsed ? 'flex justify-center' : '')}>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="primary"
                size={collapsed ? 'icon' : 'md'}
                onClick={() => createMut.mutate()}
                loading={createMut.isPending}
                fullWidth={!collapsed}
                leftIcon={!createMut.isPending ? <Plus /> : undefined}
                aria-label="New analysis session"
              >
                {!collapsed && 'New Analysis'}
              </Button>
            </TooltipTrigger>
            {collapsed && <TooltipContent side="right">New Analysis</TooltipContent>}
          </Tooltip>
        </div>

        {/* Session list */}
        <ScrollArea className="flex-1 px-2">
          {!collapsed && (
            <p className="px-2 py-2 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/70">
              Recent Sessions
            </p>
          )}

          {isLoading ? (
            <div className="flex justify-center py-6">
              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground/60" />
            </div>
          ) : sessions.length === 0 ? (
            !collapsed && (
              <p className="px-2 py-3 text-xs text-muted-foreground/70 text-center leading-relaxed">
                No sessions yet.{' '}
                <button onClick={() => createMut.mutate()} className="text-primary hover:text-primary/80 transition-colors">
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
        <div className="p-3 border-t border-white/[0.06] space-y-1">
          {/* Admin (only for admins) */}
          {user?.role === 'admin' && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Link
                  href="/admin"
                  aria-current={pathname.startsWith('/admin') ? 'page' : undefined}
                  className={cn(
                    'flex items-center gap-2.5 w-full rounded-xl text-xs transition-all px-2 py-2',
                    pathname.startsWith('/admin')
                      ? 'text-foreground bg-primary/10'
                      : 'text-muted-foreground hover:text-foreground hover:bg-[hsl(0_0%_100%/0.04)]',
                    collapsed && 'justify-center px-0',
                  )}
                >
                  <ShieldCheck className="h-3.5 w-3.5 shrink-0 text-primary" />
                  {!collapsed && (
                    <span className="truncate flex items-center gap-1.5">
                      Admin
                      <span className="text-[9px] px-1 py-0.5 rounded bg-primary/15 text-primary border border-primary/20 uppercase font-bold tracking-wider">
                        Pro
                      </span>
                    </span>
                  )}
                </Link>
              </TooltipTrigger>
              {collapsed && <TooltipContent side="right">Admin Panel</TooltipContent>}
            </Tooltip>
          )}

          {/* Settings */}
          <Tooltip>
            <TooltipTrigger asChild>
              <Link
                href="/settings"
                aria-current={pathname === '/settings' ? 'page' : undefined}
                className={cn(
                  'flex items-center gap-2.5 w-full rounded-xl text-xs transition-all px-2 py-2',
                  pathname === '/settings'
                    ? 'text-foreground bg-primary/10'
                    : 'text-muted-foreground hover:text-foreground hover:bg-[hsl(0_0%_100%/0.04)]',
                  collapsed && 'justify-center px-0',
                )}
              >
                <Settings className="h-3.5 w-3.5 shrink-0" />
                {!collapsed && <span className="truncate">Settings</span>}
              </Link>
            </TooltipTrigger>
            {collapsed && <TooltipContent side="right">Settings</TooltipContent>}
          </Tooltip>

          {/* User card with sign-out */}
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                onClick={handleLogout}
                className={cn(
                  'group flex items-center gap-2.5 w-full rounded-xl text-xs transition-all px-2 py-2 mt-1',
                  'border border-transparent hover:border-destructive/20 hover:bg-destructive/5',
                  collapsed && 'justify-center px-0',
                )}
                aria-label="Sign out"
              >
                {/* Avatar with first-letter initial */}
                <div className={cn(
                  'shrink-0 flex items-center justify-center rounded-full font-semibold uppercase transition-colors',
                  'bg-gradient-to-br from-primary/30 to-primary/10 border border-primary/25 text-primary',
                  'group-hover:from-destructive/20 group-hover:to-destructive/10 group-hover:border-destructive/30 group-hover:text-destructive',
                  collapsed ? 'w-7 h-7 text-[11px]' : 'w-7 h-7 text-[10px]',
                )}>
                  {user?.email?.[0]?.toUpperCase() ?? '?'}
                </div>
                {!collapsed && (
                  <>
                    <span className="truncate flex-1 text-left text-muted-foreground group-hover:text-foreground transition-colors">
                      {user?.email ?? 'Sign out'}
                    </span>
                    <LogOut className="h-3.5 w-3.5 shrink-0 text-muted-foreground/60 group-hover:text-destructive transition-colors" />
                  </>
                )}
              </button>
            </TooltipTrigger>
            {collapsed && <TooltipContent side="right">{user?.email ?? 'Sign out'}</TooltipContent>}
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
              ? 'bg-primary/12 text-foreground'
              : 'text-muted-foreground hover:bg-[hsl(0_0%_100%/0.04)] hover:text-foreground',
            collapsed && 'justify-center px-0 w-9 h-9 mx-auto',
          )}
          onMouseEnter={() => setHovered(true)}
          onMouseLeave={() => setHovered(false)}
        >
          <MessageSquare className={cn('h-3.5 w-3.5 shrink-0', active && 'text-primary')} />
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
                  className="shrink-0 text-muted-foreground/70 hover:text-destructive transition-colors p-0.5 rounded-lg hover:bg-destructive/10"
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