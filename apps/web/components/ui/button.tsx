import * as React from 'react'
import { Slot } from '@radix-ui/react-slot'
import { cva, type VariantProps } from 'class-variance-authority'
import { Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'

/**
 * SkyLog Button — Soft Glassmorphism
 *
 * Variants:
 *   primary       — gradient (brand), CTA için. Hover'da glow ve shimmer.
 *   secondary     — soft glass yüzey, temaya bağlı.
 *   ghost         — transparent, hover'da subtle accent.
 *   outline       — sadece kenarlıklı, minimal.
 *   destructive   — kırmızı (silme onayı, vb.)
 *   success       — yeşil (mention için, nadir kullanılır)
 *   link          — düz link görünümü
 *
 * Sizes:
 *   xs / sm / md (default) / lg / icon / icon-sm
 *
 * Features:
 *   - `loading` prop'u: spinner gösterir + tıklanmayı engeller
 *   - `leftIcon` / `rightIcon`: ikonlar için optimal spacing
 *   - `asChild`: Radix Slot (Link wrapping vb. için)
 *   - `fullWidth`: width: 100%
 */

const buttonVariants = cva(
  // ─── Base ─────────────────────────────────────────────────────────────────
  [
    'group/btn relative inline-flex items-center justify-center gap-2',
    'font-medium tracking-tight whitespace-nowrap select-none',
    'transition-[background,box-shadow,border-color,color,transform] duration-200',
    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background',
    'disabled:pointer-events-none disabled:opacity-45',
    'active:scale-[0.98]',
  ],
  {
    variants: {
      variant: {
        // Primary — brand gradient, CTA için
        primary: [
          'text-primary-foreground',
          'bg-gradient-to-br from-primary to-primary/80',
          'shadow-[0_4px_16px_-6px_hsl(var(--primary)/0.45)]',
          'hover:shadow-[0_6px_24px_-6px_hsl(var(--primary)/0.6)]',
          'hover:from-primary hover:to-[hsl(199_89%_55%)]',
          'border border-primary/20',
        ],

        // Secondary — soft glass yüzey
        secondary: [
          'text-foreground',
          'bg-[hsl(var(--glass-bg-strong))]',
          'border border-[hsl(var(--glass-border))]',
          'backdrop-blur-md',
          'hover:bg-[hsl(0_0%_100%/0.08)]',
          'hover:border-[hsl(0_0%_100%/0.14)]',
        ],

        // Ghost — transparent
        ghost: [
          'text-muted-foreground',
          'hover:text-foreground',
          'hover:bg-[hsl(0_0%_100%/0.05)]',
        ],

        // Outline — kenarlık only
        outline: [
          'text-foreground',
          'border border-border-strong',
          'bg-transparent',
          'hover:bg-[hsl(0_0%_100%/0.04)]',
          'hover:border-primary/40',
        ],

        // Destructive — kırmızı CTA
        destructive: [
          'text-destructive-foreground',
          'bg-destructive/90',
          'border border-destructive/30',
          'shadow-[0_4px_16px_-6px_hsl(var(--destructive)/0.5)]',
          'hover:bg-destructive',
          'hover:shadow-[0_6px_24px_-6px_hsl(var(--destructive)/0.7)]',
        ],

        // Success — yeşil
        success: [
          'text-success-foreground',
          'bg-success/90',
          'border border-success/30',
          'hover:bg-success',
        ],

        // Link
        link: [
          'text-primary underline-offset-4',
          'hover:underline',
          'h-auto p-0',
        ],
      },
      size: {
        xs:      'h-7  px-2.5 text-xs rounded-md gap-1.5 [&_svg]:size-3.5',
        sm:      'h-8  px-3   text-xs rounded-lg gap-1.5 [&_svg]:size-3.5',
        md:      'h-10 px-4   text-sm rounded-xl       [&_svg]:size-4',
        lg:      'h-12 px-6   text-sm rounded-xl       [&_svg]:size-4',
        xl:      'h-14 px-8   text-base rounded-2xl    [&_svg]:size-5',
        icon:    'h-10 w-10   rounded-xl               [&_svg]:size-4',
        'icon-sm': 'h-8  w-8   rounded-lg               [&_svg]:size-3.5',
        'icon-xs': 'h-7  w-7   rounded-md               [&_svg]:size-3',
      },
      fullWidth: {
        true: 'w-full',
      },
    },
    defaultVariants: { variant: 'secondary', size: 'md' },
  },
)

export interface ButtonProps
  extends Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, 'children'>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean
  loading?: boolean
  leftIcon?: React.ReactNode
  rightIcon?: React.ReactNode
  children?: React.ReactNode
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      className,
      variant,
      size,
      fullWidth,
      asChild = false,
      loading = false,
      disabled,
      leftIcon,
      rightIcon,
      children,
      ...props
    },
    ref,
  ) => {
    const isDisabled = disabled || loading

    // asChild durumunda Slot tek çocuk bekliyor — children'ı sarmalamayız.
    if (asChild) {
      return (
        <Slot
          className={cn(buttonVariants({ variant, size, fullWidth, className }))}
          ref={ref}
          {...props}
        >
          {children as React.ReactElement}
        </Slot>
      )
    }

    return (
      <button
        className={cn(buttonVariants({ variant, size, fullWidth, className }))}
        ref={ref}
        disabled={isDisabled}
        aria-busy={loading || undefined}
        {...props}
      >
        {loading ? (
          <Loader2 className="animate-spin" aria-hidden="true" />
        ) : (
          leftIcon && <span className="shrink-0 inline-flex">{leftIcon}</span>
        )}
        {children && <span className="truncate">{children}</span>}
        {!loading && rightIcon && <span className="shrink-0 inline-flex">{rightIcon}</span>}
      </button>
    )
  },
)
Button.displayName = 'Button'

export { Button, buttonVariants }
