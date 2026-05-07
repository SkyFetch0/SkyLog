'use client'

import { useState } from 'react'
import ReactMarkdown from 'react-markdown'
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter'
import { oneDark } from 'react-syntax-highlighter/dist/esm/styles/prism'
import { ChevronRight, ChevronDown, CheckCircle2, XCircle, Loader2, Wrench, Brain } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { Message as MsgType } from '@/lib/types'
import type { LocalToolCall } from '@/hooks/use-messages'

// ── Tool call collapsible ────────────────────────────────────────────────────

function ToolCallCard({ tc }: { tc: LocalToolCall }) {
  const [open, setOpen] = useState(false)

  return (
    <div className="my-2 rounded-xl border border-white/[0.07] bg-white/[0.03] text-xs overflow-hidden">
      <button
        className="w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-white/[0.04] transition-colors"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
      >
        {tc.pending ? (
          <Loader2 className="h-3 w-3 animate-spin text-blue-400 shrink-0" />
        ) : tc.success ? (
          <CheckCircle2 className="h-3 w-3 text-emerald-400 shrink-0" />
        ) : (
          <XCircle className="h-3 w-3 text-red-400 shrink-0" />
        )}
        <Wrench className="h-3 w-3 text-zinc-600 shrink-0" />
        <span className="font-mono text-zinc-400 text-[11px] truncate">{tc.toolName}</span>
        {tc.pending && (
          <span className="text-zinc-600 text-[10px] animate-pulse">running…</span>
        )}
        <span className="ml-auto">
          {open
            ? <ChevronDown className="h-3 w-3 text-zinc-600" />
            : <ChevronRight className="h-3 w-3 text-zinc-600" />
          }
        </span>
      </button>

      {open && (
        <div className="border-t border-white/[0.06] divide-y divide-white/[0.05]">
          <div className="px-3 py-2">
            <p className="text-[10px] text-zinc-600 mb-1.5 uppercase tracking-widest font-semibold">Input</p>
            <pre className="text-zinc-400 font-mono text-[11px] whitespace-pre-wrap break-all leading-relaxed">
              {JSON.stringify(tc.input, null, 2)}
            </pre>
          </div>
          {tc.output !== undefined && (
            <div className="px-3 py-2">
              <p className="text-[10px] text-zinc-600 mb-1.5 uppercase tracking-widest font-semibold">Output</p>
              <pre className="text-zinc-400 font-mono text-[11px] whitespace-pre-wrap break-all leading-relaxed max-h-56 overflow-y-auto">
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
      className="prose prose-sm prose-invert max-w-none
        prose-p:leading-relaxed prose-p:my-1.5
        prose-headings:text-white prose-headings:font-semibold
        prose-strong:text-white prose-strong:font-semibold
        prose-li:my-0.5 prose-ul:my-2 prose-ol:my-2
        prose-code:text-blue-300 prose-code:bg-blue-500/10 prose-code:px-1.5 prose-code:py-0.5 prose-code:rounded-md prose-code:text-[12px] prose-code:font-mono prose-code:border-none
        prose-pre:p-0 prose-pre:bg-transparent prose-pre:my-2"
      components={{
        code({ className, children, ...props }) {
          const match = /language-(\w+)/.exec(className ?? '')
          const isBlock = !!match
          return isBlock ? (
            <SyntaxHighlighter
              style={oneDark as never}
              language={match[1]}
              PreTag="div"
              className="!rounded-xl !text-[12px] !my-2 !bg-[#0d1117] border border-white/[0.06]"
            >
              {String(children).replace(/\n$/, '')}
            </SyntaxHighlighter>
          ) : (
            <code className="bg-blue-500/10 text-blue-300 px-1.5 py-0.5 rounded-md text-[12px] font-mono not-prose" {...props}>
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

// ── Thinking block (kalıcı — tamamlanmış mesajlar için) ──────────────────────

function ThinkingBlock({ content }: { content: string }) {
  const [open, setOpen] = useState(false)
  if (!content) return null

  return (
    <div className="mb-2 rounded-xl border border-violet-500/20 bg-violet-500/5 overflow-hidden">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-violet-500/[0.08] transition-colors"
      >
        <Brain className="h-3.5 w-3.5 shrink-0 text-violet-400" />
        <span className="text-xs text-violet-300 font-medium flex-1">Reasoning complete</span>
        <span className="text-[10px] text-violet-500">{content.length} chars</span>
        {open
          ? <ChevronDown className="h-3 w-3 text-violet-500 shrink-0" />
          : <ChevronRight className="h-3 w-3 text-violet-500 shrink-0" />}
      </button>
      {open && (
        <div className="px-3 pb-3 border-t border-violet-500/15">
          <pre className="mt-2 text-[11px] text-violet-300/70 font-mono whitespace-pre-wrap break-words leading-relaxed max-h-60 overflow-y-auto">
            {content}
          </pre>
        </div>
      )}
    </div>
  )
}

// ── User message ──────────────────────────────────────────────────────────────

export function UserMessage({ message }: { message: MsgType }) {
  return (
    <div className="flex justify-end mb-5 msg-enter">
      <div className="max-w-[78%] rounded-2xl rounded-tr-sm bg-gradient-to-br from-blue-600 to-blue-700 px-4 py-3 text-sm text-white shadow-lg shadow-blue-500/10">
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
    <div className="flex justify-start mb-5 gap-3 msg-enter">
      {/* Avatar */}
      <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-blue-500/20 to-cyan-500/10 border border-blue-500/20 flex items-center justify-center shrink-0 mt-0.5">
        <span className="text-[11px]">✦</span>
      </div>
      <div className="flex-1 min-w-0 space-y-1.5">
        {message.thinkingContent && (
          <ThinkingBlock content={message.thinkingContent} />
        )}
        <div className="rounded-2xl rounded-tl-sm bg-white/[0.04] border border-white/[0.07] px-4 py-3.5 text-sm text-zinc-200">
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

export { ToolCallCard, MarkdownContent }