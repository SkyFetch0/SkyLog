'use client'

import { useState } from 'react'
import { useParams } from 'next/navigation'
import { Loader2 } from 'lucide-react'
import { useSession } from '@/hooks/use-session'
import { ChatArea } from '@/components/chat/chat-area'
import { AgentPanel } from '@/components/chat/agent-panel'

export default function SessionPage() {
  const { id } = useParams<{ id: string }>()
  const { data, isLoading, error } = useSession(id)
  const [hasActiveRun, setHasActiveRun] = useState(false)

  if (isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center bg-zinc-950">
        <Loader2 className="h-5 w-5 animate-spin text-zinc-600" />
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="flex-1 flex items-center justify-center bg-zinc-950">
        <p className="text-sm text-red-400">Failed to load session.</p>
      </div>
    )
  }

  return (
    <div className="flex h-full overflow-hidden">
      <ChatArea
        session={data}
        onAgentActivity={() => setHasActiveRun(true)}
      />
      <AgentPanel sessionId={id} hasActiveRun={hasActiveRun} />
    </div>
  )
}