'use client'

import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { toast } from 'sonner'
import { Eye, EyeOff, Check, Mail, Calendar } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { useAuthStore } from '@/lib/auth'
import { authApi } from '@/lib/api'
import { SectionCard, Field } from './section-card'

const passwordSchema = z
  .object({
    currentPassword: z.string().min(1, 'Required'),
    newPassword: z.string().min(8, 'Minimum 8 characters'),
    confirm: z.string(),
  })
  .refine((d) => d.newPassword === d.confirm, {
    message: 'Passwords do not match',
    path: ['confirm'],
  })
  .refine((d) => d.newPassword !== d.currentPassword, {
    message: 'New password must differ from current',
    path: ['newPassword'],
  })

type PasswordForm = z.infer<typeof passwordSchema>

export function ProfileTab() {
  const user = useAuthStore((s) => s.user)
  const [showPw, setShowPw] = useState(false)
  const [success, setSuccess] = useState(false)

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<PasswordForm>({ resolver: zodResolver(passwordSchema) })

  const onSubmit = async (data: PasswordForm) => {
    try {
      await authApi.changePassword(data.currentPassword, data.newPassword)
      toast.success('Password updated')
      setSuccess(true)
      reset()
      setTimeout(() => setSuccess(false), 2500)
    } catch (err) {
      const msg =
        (err as { response?: { data?: { error?: string } } })?.response?.data?.error ??
        'Failed to update password'
      toast.error(msg)
    }
  }

  const inputCls = (hasError?: boolean) =>
    cn(
      'w-full px-3.5 py-2.5 rounded-xl bg-[hsl(var(--glass-bg))] border text-sm',
      'text-foreground placeholder:text-muted-foreground/60',
      'focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary/50 transition-all',
      hasError ? 'border-destructive/50' : 'border-[hsl(var(--glass-border))]',
    )

  return (
    <div className="space-y-5">
      {/* ── Account Info ─────────────────────────────────────────── */}
      <SectionCard title="Account Information" description="Your registered email and account creation date.">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="flex items-center gap-3 p-3 rounded-xl bg-[hsl(var(--glass-bg))] border border-[hsl(var(--glass-bg-strong))]">
            <div className="w-8 h-8 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0">
              <Mail className="h-3.5 w-3.5 text-primary" />
            </div>
            <div className="min-w-0">
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground/70 font-medium">Email</p>
              <p className="text-sm text-foreground truncate">{user?.email ?? '—'}</p>
            </div>
          </div>

          <div className="flex items-center gap-3 p-3 rounded-xl bg-[hsl(var(--glass-bg))] border border-[hsl(var(--glass-bg-strong))]">
            <div className="w-8 h-8 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0">
              <Calendar className="h-3.5 w-3.5 text-primary" />
            </div>
            <div className="min-w-0">
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground/70 font-medium">Member since</p>
              <p className="text-sm text-foreground">
                {user?.createdAt ? new Date(user.createdAt).toLocaleDateString() : '—'}
              </p>
            </div>
          </div>
        </div>
      </SectionCard>

      {/* ── Change Password ──────────────────────────────────────── */}
      <SectionCard
        title="Change Password"
        description="Use a strong password with at least 8 characters. You will not be logged out."
      >
        <form id="change-password-form" onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <Field label="Current Password" htmlFor="cur-pw" error={errors.currentPassword?.message}>
            <div className="relative">
              <input
                id="cur-pw"
                type={showPw ? 'text' : 'password'}
                autoComplete="current-password"
                placeholder="••••••••"
                className={inputCls(!!errors.currentPassword)}
                {...register('currentPassword')}
              />
              <button
                type="button"
                onClick={() => setShowPw((v) => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                aria-label={showPw ? 'Hide passwords' : 'Show passwords'}
              >
                {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </Field>

          <Field
            label="New Password"
            htmlFor="new-pw"
            error={errors.newPassword?.message}
            hint="Min. 8 characters"
          >
            <input
              id="new-pw"
              type={showPw ? 'text' : 'password'}
              autoComplete="new-password"
              placeholder="••••••••"
              className={inputCls(!!errors.newPassword)}
              {...register('newPassword')}
            />
          </Field>

          <Field label="Confirm New Password" htmlFor="confirm-pw" error={errors.confirm?.message}>
            <input
              id="confirm-pw"
              type={showPw ? 'text' : 'password'}
              autoComplete="new-password"
              placeholder="••••••••"
              className={inputCls(!!errors.confirm)}
              {...register('confirm')}
            />
          </Field>
        </form>

        <div className="flex items-center justify-end gap-2 mt-5 pt-4 border-t border-[hsl(var(--glass-border))]">
          {success && (
            <span className="text-xs text-success flex items-center gap-1.5 mr-1">
              <Check className="h-3.5 w-3.5" />
              Updated
            </span>
          )}
          <Button
            type="submit"
            form="change-password-form"
            variant="primary"
            size="sm"
            loading={isSubmitting}
          >
            Update Password
          </Button>
        </div>
      </SectionCard>
    </div>
  )
}
