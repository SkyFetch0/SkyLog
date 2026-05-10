'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { LayoutDashboard, Users, MessagesSquare, HeartPulse, Loader2, ShieldX } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useCurrentUser } from '@/hooks/use-current-user'
import { DashboardTab } from '@/components/admin/dashboard-tab'
import { UsersTab } from '@/components/admin/users-tab'
import { SessionsTab } from '@/components/admin/sessions-tab'
import { HealthTab } from '@/components/admin/health-tab'

type TabId = 'dashboard' | 'users' | 'sessions' | 'health'

const TABS: Array<{ id: TabId; label: string; icon: typeof Users; desc: string }> = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, desc: 'System-wide metrics and recent activity' },
  { id: 'users',     label: 'Users',     icon: Users,           desc: 'Manage users, roles, and access' },
  { id: 'sessions',  label: 'Sessions',  icon: MessagesSquare,  desc: 'Browse all chat sessions across users' },
  { id: 'health',    label: 'Health',    icon: HeartPulse,      desc: 'Database, sandbox, and tool-call diagnostics' },
]

export default function AdminPage() {
  const router = useRouter()
  const { user, isLoading } = useCurrentUser()
  const [activeTab, setActiveTab] = useState<TabId>('dashboard')

  // Admin guard — non-admin'leri /chat'e yönlendir
  useEffect(() => {
    if (isLoading) return
    if (!user) return
    if (user.role !== 'admin') router.replace('/chat')
  }, [user, isLoading, router])

  if (isLoading || !user) {
    return (
      <div className="flex-1 flex items-center justify-center bg-background">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (user.role !== 'admin') {
    return (
      <div className="flex-1 flex flex-col items-center justify-center bg-background gap-4 p-8 text-center">
        <div className="w-14 h-14 rounded-2xl bg-destructive/10 border border-destructive/20 flex items-center justify-center">
          <ShieldX className="h-6 w-6 text-destructive" />
        </div>
        <div>
          <h2 className="text-lg font-semibold text-foreground">Access denied</h2>
          <p className="text-sm text-muted-foreground mt-1">This area is for admins only.</p>
        </div>
      </div>
    )
  }

  const currentTab = TABS.find((t) => t.id === activeTab) ?? TABS[0]

  return (
    <div className="flex-1 overflow-y-auto bg-background">
      <div className="max-w-6xl mx-auto px-6 py-10">
        {/* Header */}
        <div className="mb-8 flex items-start justify-between gap-4 flex-wrap">
          <div>
            <div className="flex items-center gap-2.5 mb-1.5">
              <h1 className="text-2xl font-semibold text-foreground tracking-tight">Admin Panel</h1>
              <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-primary/10 text-primary border border-primary/20 uppercase font-bold tracking-wider">
                {user.email}
              </span>
            </div>
            <p className="text-sm text-muted-foreground">
              Manage users, monitor activity, and check system health.
            </p>
          </div>
        </div>

        {/* Tab nav */}
        <div className="border-b border-[hsl(var(--glass-border))] mb-6">
          <nav className="flex gap-1 -mb-px overflow-x-auto" aria-label="Admin sections">
            {TABS.map((tab) => {
              const Icon = tab.icon
              const active = activeTab === tab.id
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={cn(
                    'flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-all whitespace-nowrap',
                    active
                      ? 'border-primary text-foreground'
                      : 'border-transparent text-muted-foreground hover:text-foreground hover:border-[hsl(var(--border-strong))]',
                  )}
                >
                  <Icon className="h-4 w-4" />
                  {tab.label}
                </button>
              )
            })}
          </nav>
        </div>

        {/* Tab description */}
        <div className="mb-5">
          <p className="text-xs text-muted-foreground/80">{currentTab.desc}</p>
        </div>

        {/* Tab body */}
        <div>
          {activeTab === 'dashboard' && <DashboardTab />}
          {activeTab === 'users'     && <UsersTab />}
          {activeTab === 'sessions'  && <SessionsTab />}
          {activeTab === 'health'    && <HealthTab />}
        </div>
      </div>
    </div>
  )
}
