'use client'

import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

/**
 * SectionCard — Settings sekmelerinde kullanılan tutarlı bölüm kartı.
 * Başlık + açıklama + içerik yapısı, soft glass yüzey.
 */
export function SectionCard({
  title,
  description,
  children,
  footer,
  tone = 'default',
  className,
}: {
  title: string
  description?: string
  children: ReactNode
  footer?: ReactNode
  tone?: 'default' | 'danger'
  className?: string
}) {
  return (
    <section
      className={cn(
        'rounded-2xl border bg-[hsl(var(--surface-1))]',
        tone === 'danger'
          ? 'border-destructive/30 bg-destructive/[0.03]'
          : 'border-[hsl(var(--glass-border))]',
        className,
      )}
    >
      <div className="px-5 py-4 border-b border-[hsl(var(--glass-border))]">
        <h3
          className={cn(
            'text-sm font-semibold tracking-tight',
            tone === 'danger' ? 'text-destructive' : 'text-foreground',
          )}
        >
          {title}
        </h3>
        {description && (
          <p className="text-xs text-muted-foreground mt-1 leading-relaxed">{description}</p>
        )}
      </div>

      <div className="px-5 py-5">{children}</div>

      {footer && (
        <div className="px-5 py-3 border-t border-[hsl(var(--glass-border))] flex items-center justify-end gap-2">
          {footer}
        </div>
      )}
    </section>
  )
}

/**
 * Field — label + input wrapper, hata mesajıyla.
 */
export function Field({
  label,
  htmlFor,
  error,
  hint,
  children,
}: {
  label: string
  htmlFor?: string
  error?: string
  hint?: string
  children: ReactNode
}) {
  return (
    <div className="space-y-1.5">
      <label
        htmlFor={htmlFor}
        className="text-xs font-medium text-muted-foreground uppercase tracking-wide"
      >
        {label}
      </label>
      {children}
      {error && <p className="text-xs text-destructive">{error}</p>}
      {!error && hint && <p className="text-xs text-muted-foreground/80">{hint}</p>}
    </div>
  )
}
