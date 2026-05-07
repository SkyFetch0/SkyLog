'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { Loader2 } from 'lucide-react'
import { useSession } from '@/hooks/use-session'
import { useAgentRuns } from '@/hooks/use-agent-runs'
import { ChatArea } from '@/components/chat/chat-area'
import { AgentPanel } from '@/components/chat/agent-panel'

export default function SessionPage() {
  const { id } = useParams<{ id: string }>()
  const { data, isLoading, error } = useSession(id)
  const [hasActiveRun, setHasActiveRun] = useState(false)

  const { data: runs } = useAgentRuns(id, hasActiveRun)

  useEffect(() => {
    if (!runs?.length) return
    const anyActive = runs.some(
      (r) => r.status === 'running' || r.status === 'pending',
    )
    if (!anyActive) setHasActiveRun(false)
  }, [runs])

  if (isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center bg-[#070b14]">
        <Loader2 className="h-5 w-5 animate-spin text-zinc-700" />
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="flex-1 flex items-center justify-center bg-[#070b14]">
        <p className="text-sm text-red-400">Failed to load session.</p>
      </div>
    )
  }

  return (
    /* min-h-0 is critical: without it flex children ignore h-full and grow
       unboundedly, causing the layout to shift as messages are added. */
    <div className="flex h-full overflow-hidden">
      <div className="flex-1 min-h-0 min-w-0 overflow-hidden flex flex-col">
        <ChatArea
          key={data.id}
          session={data}
          onAgentActivity={() => setHasActiveRun(true)}
        />
      </div>
      <AgentPanel sessionId={id} hasActiveRun={hasActiveRun} />
    </div>
  )
}