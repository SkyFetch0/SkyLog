'use client'

import { useEffect, type ReactNode } from 'react'
import { useRouter } from 'next/navigation'
import { useAuthStore } from '@/lib/auth'
import { Sidebar } from '@/components/layout/sidebar'

export default function AppLayout({ children }: { children: ReactNode }) {
  const router = useRouter()
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated)
  const hasHydrated = useAuthStore((s) => s._hasHydrated)

  useEffect(() => {
    // Wait for Zustand to rehydrate from localStorage before redirecting.
    // Without this guard, authenticated users get briefly redirected to /login.
    if (!hasHydrated) return
    if (!isAuthenticated()) {
      router.replace('/login')
    }
  }, [hasHydrated, isAuthenticated, router])

  // Show nothing until hydration is complete to prevent flash
  if (!hasHydrated) return null

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <Sidebar />
      <main className="flex-1 flex flex-col overflow-hidden">{children}</main>
    </div>
  )
}