'use client'

import { useEffect, useState } from 'react'
import { useTheme } from 'next-themes'
import { Check } from 'lucide-react'
import { cn } from '@/lib/utils'
import { SectionCard } from './section-card'

/**
 * Tema paleti tanımları. Hepsi gerçek çalışır — `data-theme` attribute'una
 * `next-themes` tarafından set ediliyor, globals.css'teki ilgili block aktif olur.
 *
 * Yeni palet eklemek için:
 *   1. apps/web/app/globals.css → [data-theme="<id>"] { ... } block'u
 *   2. providers.tsx → themes: array'ine ekle
 *   3. Buraya entry ekle
 */
const PALETTES = [
  {
    id: 'dark',
    name: 'Dark',
    description: 'Default — deep blue, calm at night',
    swatches: ['hsl(222 47% 4%)', 'hsl(222 40% 7%)', 'hsl(217 91% 60%)', 'hsl(199 89% 55%)'],
  },
  {
    id: 'light',
    name: 'Light',
    description: 'Daytime — high contrast, readable in sunlight',
    swatches: ['hsl(0 0% 100%)', 'hsl(215 28% 94%)', 'hsl(217 91% 55%)', 'hsl(199 89% 48%)'],
  },
  {
    id: 'purple',
    name: 'Purple',
    description: 'Violet accents on a dark base — moody, focused',
    swatches: ['hsl(270 35% 6%)', 'hsl(270 28% 12%)', 'hsl(270 91% 65%)', 'hsl(290 89% 65%)'],
  },
  {
    id: 'ocean',
    name: 'Ocean',
    description: 'Teal & cyan — fresh and energetic',
    swatches: ['hsl(200 50% 5%)', 'hsl(200 42% 11%)', 'hsl(180 85% 55%)', 'hsl(195 89% 60%)'],
  },
] as const

export function AppearanceTab() {
  const { theme, setTheme, resolvedTheme } = useTheme()
  // Hydration mismatch'i önle: server her zaman 'dark' default'u render eder,
  // client localStorage'dan farklı bir tema okuyabilir. mounted=false iken
  // active state göstermeyiz.
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])

  const currentTheme = mounted ? (theme ?? resolvedTheme) : undefined

  return (
    <div className="space-y-5">
      <SectionCard
        title="Color Palette"
        description="Pick the look that fits your workflow. Changes apply instantly across the app."
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {PALETTES.map((p) => {
            const active = currentTheme === p.id

            return (
              <button
                key={p.id}
                type="button"
                onClick={() => setTheme(p.id)}
                className={cn(
                  'group relative text-left p-4 rounded-xl border transition-all',
                  active
                    ? 'border-primary/50 bg-primary/[0.06] shadow-[0_0_0_3px_hsl(var(--primary)/0.12)]'
                    : 'border-[hsl(var(--glass-border))] bg-[hsl(0_0%_100%/0.02)] hover:border-[hsl(0_0%_100%/0.16)] hover:bg-[hsl(0_0%_100%/0.04)] hover-lift',
                )}
                aria-pressed={active}
              >
                {/* Swatches */}
                <div className="flex gap-1.5 mb-3">
                  {p.swatches.map((color, i) => (
                    <div
                      key={i}
                      className="h-8 flex-1 rounded-md border border-[hsl(0_0%_100%/0.08)]"
                      style={{ backgroundColor: color }}
                    />
                  ))}
                </div>

                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-foreground">
                      {p.name}
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">
                      {p.description}
                    </p>
                  </div>

                  {active && (
                    <div className="shrink-0 w-5 h-5 rounded-full bg-primary flex items-center justify-center">
                      <Check className="h-3 w-3 text-primary-foreground" strokeWidth={3} />
                    </div>
                  )}
                </div>
              </button>
            )
          })}
        </div>
      </SectionCard>

      <SectionCard
        title="Density"
        description="Comfortable, compact, and cozy spacing presets — coming in a future release."
      >
        <div className="text-xs text-muted-foreground italic">
          Density controls are not yet available.
        </div>
      </SectionCard>
    </div>
  )
}
