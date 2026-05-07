'use client'

import { useQuery } from '@tanstack/react-query'
import { agentRunsApi } from '@/lib/api'
import type { AgentRun } from '@/lib/types'

export function useAgentRuns(sessionId: string, active: boolean) {
  return useQuery<AgentRun[]>({
    queryKey: ['agent-runs', sessionId],
    queryFn: () => agentRunsApi.tree(sessionId),
    enabled: !!sessionId,
    // Poll every 2s while a run is active
    refetchInterval: active ? 2000 : false,
    staleTime: 1000,
  })
}