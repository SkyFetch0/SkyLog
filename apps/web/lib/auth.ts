// NOTE: No 'use client' here — Zustand stores are plain JS modules.
// They work fine on the server side too. The 'use client' directive would
// prevent server-side imports and cause hydration mismatches.

import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { User } from './types'

interface AuthState {
  token: string | null
  user: User | null
  _hasHydrated: boolean
  setAuth: (token: string, user: User) => void
  logout: () => void
  isAuthenticated: () => boolean
  setHasHydrated: (v: boolean) => void
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      token: null,
      user: null,
      _hasHydrated: false,
      setAuth: (token, user) => set({ token, user }),
      logout: () => set({ token: null, user: null }),
      isAuthenticated: () => !!get().token,
      setHasHydrated: (v) => set({ _hasHydrated: v }),
    }),
    {
      name: 'skylog-auth',
      partialize: (s) => ({ token: s.token, user: s.user }),
      onRehydrateStorage: () => (state) => {
        state?.setHasHydrated(true)
      },
    },
  ),
)