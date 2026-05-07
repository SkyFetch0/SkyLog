import type { z } from 'zod'
import type Anthropic from '@anthropic-ai/sdk'
import type { db } from '../db/index.js'

// ── Core result types ─────────────────────────────────────────────────────────

export interface ToolResult {
  success: boolean
  output: string
  error?: string
  metadata?: Record<string, unknown>
}

// ── Sandbox abstraction (implemented later in SandboxManager) ─────────────────

export interface SandboxExecOptions {
  timeoutMs?: number
  user?: string
  cwd?: string
}

export interface SandboxManager {
  exec(command: string, options?: SandboxExecOptions): Promise<{ stdout: string; stderr: string; exitCode: number }>
  agentUser(agentId: string): string
  agentWorkdir(sessionId: string, agentId: string): string
}

// ── Context passed to every tool.execute() ────────────────────────────────────

export interface AgentContext {
  sessionId: string
  agentId: string
  agentRole: string
  sandbox: SandboxManager
  db: typeof db
  isOrchestrator: boolean
}

// ── Tool interface ────────────────────────────────────────────────────────────

// Third generic param `any` decouples raw input from parsed output,
// allowing ZodDefault/ZodOptional fields to match their output types.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export interface AgentTool<TOutput = unknown> {
  name: string
  description: string
  inputSchema: z.ZodType<TOutput, z.ZodTypeDef, any>
  execute(input: TOutput, context: AgentContext): Promise<ToolResult>
}

// ── Path helper types ─────────────────────────────────────────────────────────

export interface PathValidationResult {
  allowed: boolean
  reason?: string
  resolvedPath?: string
}

// ── Anthropic conversion ──────────────────────────────────────────────────────

export type AnthropicTool = Anthropic.Tool