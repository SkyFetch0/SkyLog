'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import Link from 'next/link'
import Image from 'next/image'
import { Eye, EyeOff } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { authApi } from '@/lib/api'
import { useAuthStore } from '@/lib/auth'
import { cn } from '@/lib/utils'

const schema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(1, 'Password is required'),
})
type Form = z.infer<typeof schema>

export default function LoginPage() {
  const router = useRouter()
  const setAuth = useAuthStore((s) => s.setAuth)
  const [showPw, setShowPw] = useState(false)
  const [serverErr, setServerErr] = useState('')

  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<Form>({
    resolver: zodResolver(schema),
  })

  const onSubmit = async (data: Form) => {
    setServerErr('')
    try {
      const res = await authApi.login(data.email, data.password)
      setAuth(res.token, res.user)
      router.replace('/chat')
    } catch {
      setServerErr('Invalid email or password.')
    }
  }

  const inputCls = (hasError?: boolean) =>
    cn(
      'w-full px-3.5 py-2.5 rounded-xl bg-[hsl(var(--surface-1))] border text-sm',
      'text-foreground placeholder:text-muted-foreground/60',
      'focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary/50 transition-all',
      hasError ? 'border-destructive/60' : 'border-[hsl(var(--border))]',
    )

  return (
    <div className="min-h-screen auth-bg flex flex-col">
      {/* Soft brand glows */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute -top-40 left-1/2 -translate-x-1/2 w-[800px] h-[800px] rounded-full bg-primary/10 blur-[120px]" />
        <div className="absolute top-1/2 -right-40 w-[500px] h-[500px] rounded-full bg-[hsl(199_89%_55%/0.08)] blur-[100px]" />
      </div>

      <div className="flex-1 flex items-center justify-center p-4 relative z-10">
        <div className="w-full max-w-sm">
          {/* Logo block */}
          <div className="flex flex-col items-center gap-4 mb-10">
            <div className="relative w-24 h-24 flex items-center justify-center">
              <div
                className="absolute inset-0 rounded-full bg-primary/15 blur-2xl"
                aria-hidden
              />
              <Image
                src="/images/SkyLogo.png"
                alt="SkyLog"
                width={96}
                height={96}
                className="relative object-contain drop-shadow-[0_0_28px_hsl(var(--primary)/0.45)]"
                priority
              />
            </div>
            <span className="text-2xl font-bold gradient-text tracking-tight">SkyLog</span>
          </div>

          {/* Card */}
          <div className="bg-[hsl(var(--card))] border border-[hsl(var(--border))] rounded-2xl p-8 shadow-[0_20px_50px_-20px_hsl(var(--primary)/0.20)]">
            <div className="mb-7">
              <h1 className="text-xl font-semibold text-foreground mb-1">Welcome back</h1>
              <p className="text-sm text-muted-foreground">Sign in to your SkyLog account</p>
            </div>

            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              {/* Email */}
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Email</label>
                <input
                  {...register('email')}
                  type="email"
                  autoComplete="email"
                  placeholder="you@example.com"
                  className={inputCls(!!errors.email)}
                />
                {errors.email && <p className="text-xs text-destructive">{errors.email.message}</p>}
              </div>

              {/* Password */}
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Password</label>
                <div className="relative">
                  <input
                    {...register('password')}
                    type={showPw ? 'text' : 'password'}
                    autoComplete="current-password"
                    placeholder="••••••••"
                    className={cn(inputCls(!!errors.password), 'pr-10')}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPw((v) => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                    aria-label={showPw ? 'Hide password' : 'Show password'}
                  >
                    {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                {errors.password && <p className="text-xs text-destructive">{errors.password.message}</p>}
              </div>

              {serverErr && (
                <div className="px-3.5 py-2.5 rounded-xl bg-destructive/10 border border-destructive/30 text-xs text-destructive">
                  {serverErr}
                </div>
              )}

              <Button
                type="submit"
                variant="primary"
                size="md"
                fullWidth
                loading={isSubmitting}
              >
                {isSubmitting ? 'Signing in…' : 'Sign in'}
              </Button>
            </form>
          </div>

          <p className="text-center text-sm text-muted-foreground mt-5">
            Don&apos;t have an account?{' '}
            <Link href="/register" className="text-primary hover:text-primary/80 font-medium transition-colors">
              Create one
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}
