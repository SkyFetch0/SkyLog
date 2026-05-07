import { exec } from 'child_process'
import { promisify } from 'util'
import type { SandboxManager, SandboxExecOptions } from './agents/types.js'

const execAsync = promisify(exec)

const SANDBOX_CONTAINER = process.env.SANDBOX_CONTAINER ?? 'skylog-sandbox-1'
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const CONTAINER_NAME_RE = /^[a-zA-Z0-9][a-zA-Z0-9_.-]+$/

// Validate container name at startup to prevent injection
if (!CONTAINER_NAME_RE.test(SANDBOX_CONTAINER)) {
  throw new Error(`Invalid SANDBOX_CONTAINER name: "${SANDBOX_CONTAINER}"`)
}

export class DockerSandboxManager implements SandboxManager {
  async exec(
    command: string,
    options: SandboxExecOptions = {},
  ): Promise<{ stdout: string; stderr: string; exitCode: number }> {
    const { timeoutMs = 30_000, cwd } = options

    const timeoutSecs = Math.max(1, Math.floor(timeoutMs / 1000))
    const cwdFlag = cwd ? `-w ${JSON.stringify(cwd)}` : ''

    // Wrap command with `timeout` inside the container so the sandbox process
    // is killed when the deadline expires (not just the host-side Node child).
    const wrappedCommand = `timeout ${timeoutSecs} sh -c ${JSON.stringify(command)}`
    const dockerCmd = `docker exec ${cwdFlag} ${SANDBOX_CONTAINER} ${wrappedCommand}`

    try {
      const { stdout, stderr } = await execAsync(dockerCmd, { timeout: timeoutMs + 2_000 })
      return { stdout, stderr, exitCode: 0 }
    } catch (err: unknown) {
      const e = err as { stdout?: string; stderr?: string; code?: number | null }
      return {
        stdout: e.stdout ?? '',
        stderr: e.stderr ?? String(err),
        exitCode: typeof e.code === 'number' ? e.code : 1,
      }
    }
  }

  agentUser(agentId: string): string {
    return `agent_${agentId.replace(/-/g, '').slice(0, 16)}`
  }

  agentWorkdir(sessionId: string, agentId: string): string {
    return `/workspace/sessions/${sessionId}/agents/${agentId}`
  }

  async ensureAgentUser(sessionId: string, agentId: string): Promise<void> {
    this.validateIds(sessionId, agentId)
    const shortId = agentId.replace(/-/g, '').slice(0, 16)
    await this.exec(`create-agent-user ${shortId} ${sessionId}`)
  }

  async ensureUploadsDir(sessionId: string): Promise<void> {
    this.validateIds(sessionId)
    await this.exec(`mkdir -p /workspace/sessions/${sessionId}/uploads`)
  }

  async removeSessionWorkspace(sessionId: string): Promise<void> {
    this.validateIds(sessionId)
    // Use safe path construction without JSON.stringify on sessionId
    await this.exec(`rm -rf /workspace/sessions/${sessionId}`)
  }

  async ping(): Promise<boolean> {
    const { exitCode } = await this.exec('echo ok')
    return exitCode === 0
  }

  /** Throw early if IDs are not valid UUIDs to prevent path traversal. */
  private validateIds(...ids: string[]): void {
    for (const id of ids) {
      if (!UUID_RE.test(id)) {
        throw new Error(`Invalid ID format: "${id}" — must be UUID`)
      }
    }
  }
}

export const sandbox = new DockerSandboxManager()