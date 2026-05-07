'use client'

import { useQuery } from '@tanstack/react-query'
import { sessionsApi } from '@/lib/api'

export function useSession(id: string) {
  return useQuery({
    queryKey: ['session', id],
    queryFn: () => sessionsApi.get(id),
    enabled: !!id,
    staleTime: 30_000,
  })
}