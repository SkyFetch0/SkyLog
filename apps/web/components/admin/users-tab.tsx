'use client'

import { useEffect, useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import {
  Search, Loader2, ShieldCheck, ShieldOff, Trash2, MoreVertical, User as UserIcon,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { adminApi, type AdminUser } from '@/lib/api'
import { useAuthStore } from '@/lib/auth'

export function UsersTab() {
  const qc = useQueryClient()
  const meId = useAuthStore((s) => s.user?.id)
  const [search, setSearch] = useState('')

  const { data, isLoading } = useQuery({
    queryKey: ['admin', 'users', search],
    queryFn: () => adminApi.users({ search: search || undefined, limit: 100 }),
  })

  const promoteMut = useMutation({
    mutationFn: ({ id, role }: { id: string; role: 'user' | 'admin' }) =>
      adminApi.updateRole(id, role),
    onSuccess: (_, vars) => {
      toast.success(vars.role === 'admin' ? 'User promoted to admin' : 'User demoted')
      qc.invalidateQueries({ queryKey: ['admin', 'users'] })
      qc.invalidateQueries({ queryKey: ['admin', 'stats'] })
    },
    onError: (err) => {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error
      toast.error(msg ?? 'Failed to update role')
    },
  })

  const deleteMut = useMutation({
    mutationFn: (id: string) => adminApi.deleteUser(id),
    onSuccess: () => {
      toast.success('User deleted')
      qc.invalidateQueries({ queryKey: ['admin', 'users'] })
      qc.invalidateQueries({ queryKey: ['admin', 'stats'] })
    },
    onError: (err) => {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error
      toast.error(msg ?? 'Failed to delete user')
    },
  })

  return (
    <div className="space-y-4">
      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/60" />
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by email…"
          className={cn(
            'w-full pl-10 pr-3.5 py-2.5 rounded-xl bg-[hsl(var(--glass-bg))] border text-sm',
            'text-foreground placeholder:text-muted-foreground/60',
            'focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary/50',
            'border-[hsl(var(--glass-border))]',
          )}
        />
      </div>

      {/* Table */}
      <div className="rounded-2xl border border-[hsl(var(--glass-border))] bg-[hsl(var(--surface-1))] overflow-hidden">
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : !data?.users.length ? (
          <div className="px-4 py-12 text-center text-sm text-muted-foreground">
            {search ? 'No users match your search.' : 'No users yet.'}
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-[hsl(var(--glass-bg))] border-b border-[hsl(var(--glass-border))]">
              <tr>
                <th className="text-left px-4 py-2.5 font-semibold text-[10px] uppercase tracking-widest text-muted-foreground">User</th>
                <th className="text-left px-4 py-2.5 font-semibold text-[10px] uppercase tracking-widest text-muted-foreground">Role</th>
                <th className="text-right px-4 py-2.5 font-semibold text-[10px] uppercase tracking-widest text-muted-foreground">Sessions</th>
                <th className="text-left px-4 py-2.5 font-semibold text-[10px] uppercase tracking-widest text-muted-foreground">Joined</th>
                <th className="text-right px-4 py-2.5 font-semibold text-[10px] uppercase tracking-widest text-muted-foreground">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[hsl(var(--glass-border))]">
              {data.users.map((u) => (
                <UserRow
                  key={u.id}
                  user={u}
                  isMe={u.id === meId}
                  promoting={promoteMut.isPending && promoteMut.variables?.id === u.id}
                  deleting={deleteMut.isPending && deleteMut.variables === u.id}
                  onPromote={() => promoteMut.mutate({ id: u.id, role: u.role === 'admin' ? 'user' : 'admin' })}
                  onDelete={() => {
                    if (confirm(`Delete user ${u.email}? This cannot be undone.`)) {
                      deleteMut.mutate(u.id)
                    }
                  }}
                />
              ))}
            </tbody>
          </table>
        )}

        {data && data.total > data.users.length && (
          <div className="px-4 py-3 border-t border-[hsl(var(--glass-border))] text-xs text-muted-foreground text-center">
            Showing {data.users.length} of {data.total} users
          </div>
        )}
      </div>
    </div>
  )
}

function UserRow({
  user, isMe, promoting, deleting, onPromote, onDelete,
}: {
  user: AdminUser
  isMe: boolean
  promoting: boolean
  deleting: boolean
  onPromote: () => void
  onDelete: () => void
}) {
  const [menuOpen, setMenuOpen] = useState(false)

  // Escape ile menüyü kapat
  useEffect(() => {
    if (!menuOpen) return
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMenuOpen(false)
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [menuOpen])

  return (
    <tr className="hover:bg-[hsl(var(--glass-bg))] transition-colors">
      <td className="px-4 py-3">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-[hsl(var(--surface-2))] border border-[hsl(var(--glass-border))] flex items-center justify-center shrink-0">
            <UserIcon className="h-3.5 w-3.5 text-muted-foreground" />
          </div>
          <div className="min-w-0">
            <p className="text-foreground text-sm truncate flex items-center gap-1.5">
              {user.email}
              {isMe && (
                <span className="text-[9px] px-1.5 py-0.5 rounded bg-primary/10 text-primary border border-primary/20 uppercase font-bold tracking-wider">
                  you
                </span>
              )}
            </p>
            <p className="text-[11px] font-mono text-muted-foreground/60 truncate">{user.id}</p>
          </div>
        </div>
      </td>
      <td className="px-4 py-3">
        <span
          className={cn(
            'inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider border',
            user.role === 'admin'
              ? 'text-primary bg-primary/10 border-primary/20'
              : 'text-muted-foreground bg-[hsl(var(--glass-bg))] border-[hsl(var(--glass-border))]',
          )}
        >
          {user.role === 'admin' && <ShieldCheck className="h-2.5 w-2.5" />}
          {user.role}
        </span>
      </td>
      <td className="px-4 py-3 text-right text-foreground tabular-nums">{user.sessionCount}</td>
      <td className="px-4 py-3 text-muted-foreground text-xs">
        {new Date(user.createdAt).toLocaleDateString()}
      </td>
      <td className="px-4 py-3">
        <div className="flex items-center justify-end gap-1 relative">
          {!isMe ? (
            <>
              <Button
                variant="ghost"
                size="icon-xs"
                onClick={() => setMenuOpen((v) => !v)}
                aria-label={`Actions for ${user.email}`}
                aria-haspopup="menu"
                aria-expanded={menuOpen}
              >
                <MoreVertical />
              </Button>
              {menuOpen && (
                <>
                  {/* Backdrop to close menu */}
                  <div
                    className="fixed inset-0 z-10"
                    onClick={() => setMenuOpen(false)}
                    aria-hidden="true"
                  />
                  <div
                    role="menu"
                    aria-label={`Actions for ${user.email}`}
                    className="absolute right-0 top-7 z-20 w-44 rounded-xl border border-[hsl(var(--glass-border))] bg-[hsl(var(--surface-3))] shadow-xl p-1"
                  >
                    <button
                      role="menuitem"
                      onClick={() => { setMenuOpen(false); onPromote() }}
                      disabled={promoting}
                      className="w-full flex items-center gap-2 px-2.5 py-2 rounded-md text-xs text-foreground hover:bg-[hsl(var(--glass-bg))] transition-colors disabled:opacity-50 focus-visible:bg-[hsl(var(--glass-bg-strong))]"
                    >
                      {user.role === 'admin' ? <ShieldOff className="h-3.5 w-3.5" /> : <ShieldCheck className="h-3.5 w-3.5" />}
                      {user.role === 'admin' ? 'Demote to user' : 'Promote to admin'}
                    </button>
                    <button
                      role="menuitem"
                      onClick={() => { setMenuOpen(false); onDelete() }}
                      disabled={deleting}
                      className="w-full flex items-center gap-2 px-2.5 py-2 rounded-md text-xs text-destructive hover:bg-destructive/10 transition-colors disabled:opacity-50 focus-visible:bg-destructive/10"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      Delete user
                    </button>
                  </div>
                </>
              )}
            </>
          ) : (
            <span className="text-[10px] text-muted-foreground/60">—</span>
          )}
        </div>
      </td>
    </tr>
  )
}
