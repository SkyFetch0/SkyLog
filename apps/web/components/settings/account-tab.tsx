'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { AlertTriangle, Trash2, LogOut } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { useAuthStore } from '@/lib/auth'
import { authApi } from '@/lib/api'
import { SectionCard, Field } from './section-card'

export function AccountTab() {
  const router = useRouter()
  const logout = useAuthStore((s) => s.logout)
  const userEmail = useAuthStore((s) => s.user?.email ?? '')
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [password, setPassword] = useState('')
  const [confirmEmail, setConfirmEmail] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const canDelete = password.length > 0 && confirmEmail === userEmail

  const handleDelete = async () => {
    if (!canDelete) return
    setSubmitting(true)
    try {
      await authApi.deleteAccount(password)
      toast.success('Account deleted')
      logout()
      router.replace('/login')
    } catch (err) {
      const msg =
        (err as { response?: { data?: { error?: string } } })?.response?.data?.error ??
        'Failed to delete account'
      toast.error(msg)
      setSubmitting(false)
    }
  }

  const handleSignOut = () => {
    logout()
    router.replace('/login')
  }

  const inputCls = (hasError?: boolean) =>
    cn(
      'w-full px-3.5 py-2.5 rounded-xl bg-[hsl(var(--glass-bg))] border text-sm',
      'text-foreground placeholder:text-muted-foreground/60',
      'focus:outline-none focus:ring-1 focus:ring-destructive focus:border-destructive/50 transition-all',
      hasError ? 'border-destructive/50' : 'border-[hsl(var(--glass-border))]',
    )

  return (
    <div className="space-y-5">
      {/* ── Sign out ─────────────────────────────────────────────── */}
      <SectionCard
        title="Sign out"
        description="Log out of this device. You can sign back in any time."
        footer={
          <Button variant="outline" size="sm" onClick={handleSignOut} leftIcon={<LogOut />}>
            Sign out
          </Button>
        }
      >
        <p className="text-sm text-muted-foreground">
          Currently signed in as <span className="text-foreground font-medium">{userEmail}</span>.
        </p>
      </SectionCard>

      {/* ── Delete account (danger zone) ─────────────────────────── */}
      <SectionCard
        title="Delete account"
        description="Permanently remove your account, all sessions, files, and analysis history. This action cannot be undone."
        tone="danger"
      >
        {!confirmOpen ? (
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-start gap-3">
              <div className="w-9 h-9 rounded-lg bg-destructive/10 border border-destructive/20 flex items-center justify-center shrink-0">
                <AlertTriangle className="h-4 w-4 text-destructive" />
              </div>
              <div>
                <p className="text-sm text-foreground font-medium">This is permanent.</p>
                <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">
                  All your data will be removed from our servers. There is no recovery.
                </p>
              </div>
            </div>
            <Button
              variant="destructive"
              size="sm"
              leftIcon={<Trash2 />}
              onClick={() => setConfirmOpen(true)}
            >
              Delete account
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="p-3 rounded-xl bg-destructive/[0.06] border border-destructive/20 text-sm text-destructive">
              <p className="font-medium mb-1">This will permanently delete your account.</p>
              <p className="text-xs opacity-90">
                Type your email and password to confirm.
              </p>
            </div>

            <Field label={`Type "${userEmail}" to confirm`} htmlFor="confirm-email">
              <input
                id="confirm-email"
                type="email"
                autoComplete="off"
                value={confirmEmail}
                onChange={(e) => setConfirmEmail(e.target.value)}
                placeholder={userEmail}
                className={inputCls(!!confirmEmail && confirmEmail !== userEmail)}
              />
            </Field>

            <Field label="Password" htmlFor="confirm-pw">
              <input
                id="confirm-pw"
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className={inputCls(false)}
              />
            </Field>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-[hsl(var(--glass-border))]">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setConfirmOpen(false)
                  setPassword('')
                  setConfirmEmail('')
                }}
                disabled={submitting}
              >
                Cancel
              </Button>
              <Button
                variant="destructive"
                size="sm"
                disabled={!canDelete}
                loading={submitting}
                onClick={handleDelete}
                leftIcon={<Trash2 />}
              >
                Delete forever
              </Button>
            </div>
          </div>
        )}
      </SectionCard>
    </div>
  )
}
