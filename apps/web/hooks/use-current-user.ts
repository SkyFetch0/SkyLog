'use client'

import { useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { authApi } from '@/lib/api'
import { useAuthStore } from '@/lib/auth'

/**
 * useCurrentUser — Sayfa açıldığında /auth/me ile user bilgisini taze tutar.
 *
 * Eski oturumlardaki kullanıcıların `role` bilgisi token'da yok (login sonrası
 * Zustand'a yazılmış eski user objesinde role undefined olabilir).
 * Bu hook arka planda /auth/me çağırıp store'u günceller — admin guard ve
 * sidebar'daki /admin link'i için doğru role bilgisini garanti eder.
 */
export function useCurrentUser() {
  const token = useAuthStore((s) => s.token)
  const user = useAuthStore((s) => s.user)
  const setAuth = useAuthStore((s) => s.setAuth)

  const query = useQuery({
    queryKey: ['auth', 'me'],
    queryFn: () => authApi.me(),
    enabled: !!token,
    staleTime: 5 * 60_000,
    retry: false,
  })

  useEffect(() => {
    if (!query.data?.user || !token) return
    const fresh = query.data.user
    // Sadece bir şey değiştiyse store'u güncelle (gereksiz re-render önlenir)
    if (
      !user ||
      user.email !== fresh.email ||
      user.role !== fresh.role ||
      user.createdAt !== fresh.createdAt
    ) {
      setAuth(token, fresh)
    }
  }, [query.data, token, user, setAuth])

  return { user: query.data?.user ?? user, isLoading: query.isLoading }
}
