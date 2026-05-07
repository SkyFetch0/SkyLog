'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { ScanSearch, Plus, MessageSquare, Trash2, LogOut, ChevronLeft, ChevronRight, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { sessionsApi } from '@/lib/api'
import { useAuthStore } from '@/lib/auth'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
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
    <TooltipProvider delayDuration={300}>
      <aside
        className={cn(
          'flex flex-col h-screen bg-sidebar border-r border-sidebar-border transition-all duration-200 shrink-0',
          collapsed ? 'w-14' : 'w-[260px]',
        )}
      >
        {/* Header */}
        <div className="flex items-center h-14 px-3 border-b border-sidebar-border">
          {!collapsed && (
            <Link href="/chat" className="flex items-center gap-2 flex-1 min-w-0">
              <ScanSearch className="h-5 w-5 text-primary shrink-0" />
              <span className="font-semibold tracking-tight truncate">SkyLog</span>
            </Link>
          )}
          {collapsed && (
            <Link href="/chat" className="mx-auto">
              <ScanSearch className="h-5 w-5 text-primary" />
            </Link>
          )}
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 shrink-0 ml-auto"
            onClick={() => setCollapsed((v) => !v)}
          >
            {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
          </Button>
        </div>

        {/* New session button */}
        <div className="p-2">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="outline"
                size={collapsed ? 'icon' : 'default'}
                className={cn('w-full', collapsed && 'h-9 w-9 mx-auto')}
                onClick={() => createMut.mutate()}
                disabled={createMut.isPending}
              >
                {createMut.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Plus className="h-4 w-4" />
                )}
                {!collapsed && <span className="ml-2">New Analysis</span>}
              </Button>
            </TooltipTrigger>
            {collapsed && <TooltipContent side="right">New Analysis</TooltipContent>}
          </Tooltip>
        </div>

        <Separator />

        {/* Session list */}
        <ScrollArea className="flex-1 px-1 py-1">
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
            </div>
          ) : sessions.length === 0 ? (
            !collapsed && (
              <p className="text-xs text-muted-foreground text-center py-8 px-3">
                No sessions yet.{' '}
                <button
                  className="text-primary hover:underline"
                  onClick={() => createMut.mutate()}
                >
                  Start one
                </button>
              </p>
            )
          ) : (
            sessions.map((session: Session) => (
              <SessionItem
                key={session.id}
                session={session}
                active={pathname === `/chat/${session.id}`}
                collapsed={collapsed}
                onDelete={() => deleteMut.mutate(session.id)}
                isDeleting={deleteMut.isPending}
              />
            ))
          )}
        </ScrollArea>

        <Separator />

        {/* Footer */}
        <div className="p-2">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size={collapsed ? 'icon' : 'default'}
                className={cn(
                  'w-full justify-start text-muted-foreground hover:text-destructive',
                  collapsed && 'h-9 w-9 mx-auto justify-center',
                )}
                onClick={handleLogout}
              >
                <LogOut className="h-4 w-4 shrink-0" />
                {!collapsed && (
                  <span className="ml-2 truncate text-xs">{user?.email ?? 'Logout'}</span>
                )}
              </Button>
            </TooltipTrigger>
            {collapsed && <TooltipContent side="right">Sign out</TooltipContent>}
          </Tooltip>
        </div>
      </aside>
    </TooltipProvider>
  )
}

function SessionItem({
  session,
  active,
  collapsed,
  onDelete,
  isDeleting,
}: {
  session: Session
  active: boolean
  collapsed: boolean
  onDelete: () => void
  isDeleting: boolean
}) {
  const [hovered, setHovered] = useState(false)

  return (
    <TooltipProvider delayDuration={300}>
      <Tooltip>
        <TooltipTrigger asChild>
          <div
            className={cn(
              'group flex items-center gap-2 rounded-md px-2 py-1.5 cursor-pointer transition-colors',
              active
                ? 'bg-sidebar-accent text-sidebar-accent-foreground'
                : 'text-sidebar-foreground hover:bg-sidebar-accent/60',
              collapsed && 'justify-center',
            )}
            onMouseEnter={() => setHovered(true)}
            onMouseLeave={() => setHovered(false)}
          >
            <Link href={`/chat/${session.id}`} className="flex items-center gap-2 flex-1 min-w-0">
              <MessageSquare className="h-3.5 w-3.5 shrink-0" />
              {!collapsed && (
                <span className="text-sm truncate">{session.title}</span>
              )}
            </Link>
            {!collapsed && hovered && (
              <button
                className="shrink-0 opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive transition-opacity"
                onClick={(e) => {
                  e.preventDefault()
                  onDelete()
                }}
                disabled={isDeleting}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        </TooltipTrigger>
        {collapsed && <TooltipContent side="right">{session.title}</TooltipContent>}
      </Tooltip>
    </TooltipProvider>
  )
}