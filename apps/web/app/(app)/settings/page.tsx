'use client'

import { useState } from 'react'
import { User, Palette, ShieldAlert } from 'lucide-react'
import { cn } from '@/lib/utils'
import { ProfileTab } from '@/components/settings/profile-tab'
import { AppearanceTab } from '@/components/settings/appearance-tab'
import { AccountTab } from '@/components/settings/account-tab'

type TabId = 'profile' | 'appearance' | 'account'

const TABS: Array<{ id: TabId; label: string; icon: typeof User; desc: string }> = [
  { id: 'profile',    label: 'Profile',    icon: User,        desc: 'Your account information and password' },
  { id: 'appearance', label: 'Appearance', icon: Palette,     desc: 'Theme, color palette, and visual preferences' },
  { id: 'account',    label: 'Account',    icon: ShieldAlert, desc: 'Danger zone — delete account and data' },
]

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState<TabId>('profile')

  return (
    <div className="flex-1 overflow-y-auto bg-background">
      <div className="max-w-4xl mx-auto px-6 py-10">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-2xl font-semibold text-foreground tracking-tight">Settings</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Manage your account, preferences, and SkyLog experience.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-[220px_1fr] gap-8">
          {/* ── Tab list (sidebar style) ──────────────────────────────── */}
          <nav className="space-y-1">
            {TABS.map((tab) => {
              const Icon = tab.icon
              const active = activeTab === tab.id
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={cn(
                    'w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm transition-all',
                    active
                      ? 'bg-primary/10 text-foreground border border-primary/20'
                      : 'text-muted-foreground hover:text-foreground hover:bg-[hsl(0_0%_100%/0.04)] border border-transparent',
                  )}
                >
                  <Icon className={cn('h-4 w-4 shrink-0', active && 'text-primary')} />
                  <span className="font-medium">{tab.label}</span>
                </button>
              )
            })}
          </nav>

          {/* ── Active tab content ────────────────────────────────────── */}
          <div className="min-w-0">
            <div className="mb-6">
              {TABS.filter((t) => t.id === activeTab).map((t) => (
                <div key={t.id}>
                  <h2 className="text-lg font-semibold text-foreground">{t.label}</h2>
                  <p className="text-sm text-muted-foreground mt-1">{t.desc}</p>
                </div>
              ))}
            </div>

            {activeTab === 'profile'    && <ProfileTab />}
            {activeTab === 'appearance' && <AppearanceTab />}
            {activeTab === 'account'    && <AccountTab />}
          </div>
        </div>
      </div>
    </div>
  )
}
