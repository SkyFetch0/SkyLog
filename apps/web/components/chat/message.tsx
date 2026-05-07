'use client'

import { useState } from 'react'
import ReactMarkdown from 'react-markdown'
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter'
import { oneDark } from 'react-syntax-highlighter/dist/esm/styles/prism'
import { ChevronRight, ChevronDown, CheckCircle2, XCircle, Loader2, Terminal } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'
import type { Message as MsgType } from '@/lib/types'
import type { LocalToolCall } from '@/hooks/use-messages'

// ── Tool call collapsible ────────────────────────────────────────────────────

function ToolCallCard({ tc }: { tc: LocalToolCall }) {
  const [open, setOpen] = useState(false)

  return (
    <div className="my-1.5 rounded-lg border border-zinc-700/60 bg-zinc-900 text-xs overflow-hidden">
      <button
        className="w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-zinc-800/60 transition-colors"
        onClick={() => setOpen((v) => !v)}
      >
        {tc.pending ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin text-blue-400 shrink-0" />
        ) : tc.success ? (
          <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400 shrink-0" />
        ) : (
          <XCircle className="h-3.5 w-3.5 text-red-400 shrink-0" />
        )}
        <Terminal className="h-3 w-3 text-zinc-500 shrink-0" />
        <span className="font-mono text-zinc-300 truncate">{tc.toolName}</span>
        {tc.pending && (
          <span className="ml-auto text-zinc-500 text-[10px] animate-pulse">running…</span>
        )}
        <span className="ml-auto">
          {open ? (
            <ChevronDown className="h-3.5 w-3.5 text-zinc-500" />
          ) : (
            <ChevronRight className="h-3.5 w-3.5 text-zinc-500" />
          )}
        </span>
      </button>

      {open && (
        <div className="border-t border-zinc-700/60 divide-y divide-zinc-700/40">
          <div className="px-3 py-2">
            <p className="text-[10px] text-zinc-500 mb-1 uppercase tracking-wide">Input</p>
            <pre className="text-zinc-300 font-mono text-[11px] whitespace-pre-wrap break-all leading-relaxed">
              {JSON.stringify(tc.input, null, 2)}
            </pre>
          </div>
          {tc.output !== undefined && (
            <div className="px-3 py-2">
              <p className="text-[10px] text-zinc-500 mb-1 uppercase tracking-wide">Output</p>
              <pre className="text-zinc-300 font-mono text-[11px] whitespace-pre-wrap break-all leading-relaxed max-h-64 overflow-y-auto">
                {tc.output}
              </pre>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ── Markdown renderer ─────────────────────────────────────────────────────────

function MarkdownContent({ content }: { content: string }) {
  return (
    <ReactMarkdown
      className="prose prose-sm prose-invert max-w-none prose-pre:p-0 prose-pre:bg-transparent"
      components={{
        code({ className, children, ...props }) {
          const match = /language-(\w+)/.exec(className ?? '')
          const isBlock = !!match
          return isBlock ? (
            <SyntaxHighlighter
              style={oneDark as never}
              language={match[1]}
              PreTag="div"
              className="!rounded-lg !text-[12px] !my-2"
            >
              {String(children).replace(/\n$/, '')}
            </SyntaxHighlighter>
          ) : (
            <code
              className="bg-zinc-800 text-blue-300 px-1 py-0.5 rounded text-[12px] font-mono"
              {...props}
            >
              {children}
            </code>
          )
        },
      }}
    >
      {content}
    </ReactMarkdown>
  )
}

// ── User message ──────────────────────────────────────────────────────────────

export function UserMessage({ message }: { message: MsgType }) {
  return (
    <div className="flex justify-end mb-4">
      <div className="max-w-[75%] rounded-2xl rounded-tr-sm bg-blue-600 px-4 py-3 text-sm text-white">
        <p className="whitespace-pre-wrap break-words leading-relaxed">{message.content}</p>
      </div>
    </div>
  )
}

// ── Assistant message ─────────────────────────────────────────────────────────

export function AssistantMessage({
  message,
  toolCalls = [],
}: {
  message: MsgType
  toolCalls?: LocalToolCall[]
}) {
  return (
    <div className="flex justify-start mb-4">
      <div className="max-w-[85%] space-y-1">
        <div className="rounded-2xl rounded-tl-sm bg-zinc-800 px-4 py-3 text-sm text-zinc-100">
          <MarkdownContent content={message.content} />
        </div>
        {toolCalls.map((tc) => (
          <ToolCallCard key={tc.id} tc={tc} />
        ))}
      </div>
    </div>
  )
}

// ── Generic message dispatcher ────────────────────────────────────────────────

export function Message({ message }: { message: MsgType }) {
  if (message.role === 'user') return <UserMessage message={message} />
  return <AssistantMessage message={message} />
}

// ── Badge re-export for use in streaming ─────────────────────────────────────

export { ToolCallCard, MarkdownContent }