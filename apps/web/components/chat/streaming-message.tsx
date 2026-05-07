'use client'

import { Loader2 } from 'lucide-react'
import { ToolCallCard, MarkdownContent } from './message'
import type { StreamingMessage as StreamingMsg } from '@/hooks/use-messages'

interface Props {
  msg: StreamingMsg
}

export function StreamingMessage({ msg }: Props) {
  return (
    <div className="flex justify-start mb-4">
      <div className="max-w-[85%] space-y-1">
        {/* Thinking indicator */}
        {msg.streaming && !msg.content && msg.toolCalls.length === 0 && (
          <div className="flex items-center gap-2 px-4 py-3 rounded-2xl rounded-tl-sm bg-zinc-800">
            <Loader2 className="h-3.5 w-3.5 animate-spin text-blue-400" />
            <span className="text-sm text-zinc-400">Orchestrator is thinking…</span>
          </div>
        )}

        {/* Streamed text */}
        {msg.content && (
          <div className="rounded-2xl rounded-tl-sm bg-zinc-800 px-4 py-3 text-sm text-zinc-100">
            <MarkdownContent content={msg.content} />
            {msg.streaming && (
              <span className="inline-block w-1.5 h-4 bg-blue-400 animate-pulse ml-0.5 align-text-bottom rounded-sm" />
            )}
          </div>
        )}

        {/* Tool calls */}
        {msg.toolCalls.map((tc) => (
          <ToolCallCard key={tc.id} tc={tc} />
        ))}
      </div>
    </div>
  )
}