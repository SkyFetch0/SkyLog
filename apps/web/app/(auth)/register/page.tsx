'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import Link from 'next/link'
import { Loader2, Eye, EyeOff, Zap } from 'lucide-react'
import { authApi } from '@/lib/api'
import { useAuthStore } from '@/lib/auth'
import { cn } from '@/lib/utils'

const schema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(8, 'Minimum 8 characters'),
  confirm: z.string(),
}).refine((d) => d.password === d.confirm, {
  message: 'Passwords do not match',
  path: ['confirm'],
})
type Form = z.infer<typeof schema>

export default function RegisterPage() {
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
      const res = await authApi.register(data.email, data.password)
      setAuth(res.token, res.user)
      router.replace('/chat')
    } catch {
      setServerErr('Registration failed. Email may already be in use.')
    }
  }

  return (
    <div className="min-h-screen auth-bg flex flex-col">
      {/* Background glow (extra) */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute -top-40 left-1/2 -translate-x-1/2 w-[800px] h-[800px] rounded-full bg-primary/10 blur-[120px]" />
        <div className="absolute bottom-0 -left-40 w-[500px] h-[500px] rounded-full bg-[hsl(199_89%_55%/0.08)] blur-[100px]" />
      </div>

      <div className="flex-1 flex items-center justify-center p-4 relative z-10">
        <div className="w-full max-w-sm">
          {/* Logo */}
          <div className="flex items-center justify-center gap-2.5 mb-8">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center shadow-lg shadow-blue-500/25">
              <Zap className="w-5 h-5 text-white" />
            </div>
            <span className="text-xl font-bold text-white tracking-tight">SkyLog</span>
          </div>

          {/* Card */}
          <div className="bg-white/[0.04] border border-white/[0.08] rounded-2xl p-8 shadow-2xl shadow-black/50 backdrop-blur-sm">
            <div className="mb-7">
              <h1 className="text-xl font-semibold text-white mb-1">Create account</h1>
              <p className="text-sm text-zinc-500">Start analyzing logs with AI</p>
            </div>

            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-zinc-400 uppercase tracking-wide">Email</label>
                <input
                  {...register('email')}
                  type="email"
                  autoComplete="email"
                  placeholder="you@example.com"
                  className={cn(
                    'w-full px-3.5 py-2.5 rounded-xl bg-white/[0.06] border text-sm text-white placeholder:text-zinc-600',
                    'focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500/50 transition-all',
                    errors.email ? 'border-red-500/50' : 'border-white/[0.08]',
                  )}
                />
                {errors.email && <p className="text-xs text-red-400">{errors.email.message}</p>}
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-medium text-zinc-400 uppercase tracking-wide">Password</label>
                <div className="relative">
                  <input
                    {...register('password')}
                    type={showPw ? 'text' : 'password'}
                    autoComplete="new-password"
                    placeholder="Min. 8 characters"
                    className={cn(
                      'w-full px-3.5 py-2.5 pr-10 rounded-xl bg-white/[0.06] border text-sm text-white placeholder:text-zinc-600',
                      'focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500/50 transition-all',
                      errors.password ? 'border-red-500/50' : 'border-white/[0.08]',
                    )}
                  />
                  <button type="button" onClick={() => setShowPw((v) => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300 transition-colors">
                    {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                {errors.password && <p className="text-xs text-red-400">{errors.password.message}</p>}
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-medium text-zinc-400 uppercase tracking-wide">Confirm Password</label>
                <input
                  {...register('confirm')}
                  type={showPw ? 'text' : 'password'}
                  autoComplete="new-password"
                  placeholder="••••••••"
                  className={cn(
                    'w-full px-3.5 py-2.5 rounded-xl bg-white/[0.06] border text-sm text-white placeholder:text-zinc-600',
                    'focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500/50 transition-all',
                    errors.confirm ? 'border-red-500/50' : 'border-white/[0.08]',
                  )}
                />
                {errors.confirm && <p className="text-xs text-red-400">{errors.confirm.message}</p>}
              </div>

              {serverErr && (
                <div className="px-3.5 py-2.5 rounded-xl bg-red-500/10 border border-red-500/20 text-xs text-red-400">
                  {serverErr}
                </div>
              )}

              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full py-2.5 rounded-xl bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-500 hover:to-cyan-500 text-white text-sm font-medium transition-all duration-200 shadow-lg shadow-blue-500/20 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                {isSubmitting ? 'Creating account…' : 'Create Account'}
              </button>
            </form>
          </div>

          <p className="text-center text-sm text-zinc-600 mt-5">
            Already have an account?{' '}
            <Link href="/login" className="text-blue-400 hover:text-blue-300 font-medium transition-colors">
              Sign in
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}