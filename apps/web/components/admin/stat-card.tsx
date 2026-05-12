'use client'

import type { ComponentType, ReactNode } from 'react'
import { cn } from '@/lib/utils'

interface Props {
  label: string
  value: string | number
  icon?: ComponentType<{ className?: string }>
  trend?: ReactNode
  accent?: 'primary' | 'success' | 'warning' | 'destructive' | 'muted'
  className?: string
}

const ACCENT_CLASSES: Record<NonNullable<Props['accent']>, string> = {
  primary:     'text-primary bg-primary/10 border-primary/20',
  success:     'text-success bg-success/10 border-success/20',
  warning:     'text-warning bg-warning/10 border-warning/20',
  destructive: 'text-destructive bg-destructive/10 border-destructive/20',
  muted:       'text-muted-foreground bg-[hsl(var(--glass-bg-strong))] border-[hsl(var(--glass-border))]',
}

export function StatCard({ label, value, icon: Icon, trend, accent = 'primary', className }: Props) {
  return (
    <div
      className={cn(
        'rounded-2xl border bg-[hsl(var(--surface-1))] p-5',
        'border-[hsl(var(--glass-border))] hover-lift',
        className,
      )}
    >
      <div className="flex items-start justify-between gap-3 mb-3">
        <p className="text-[10px] uppercase tracking-widest font-semibold text-muted-foreground">
          {label}
        </p>
        {Icon && (
          <div className={cn('w-8 h-8 rounded-lg border flex items-center justify-center shrink-0', ACCENT_CLASSES[accent])}>
            <Icon className="h-4 w-4" />
          </div>
        )}
      </div>
      <p className="text-2xl font-bold tracking-tight text-foreground tabular-nums">
        {typeof value === 'number' ? value.toLocaleString() : value}
      </p>
      {trend && <div className="mt-2">{trend}</div>}
    </div>
  )
}
