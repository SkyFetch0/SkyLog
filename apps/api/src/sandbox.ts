import { spawn } from 'child_process'
import type { SandboxManager, SandboxExecOptions } from './agents/types.js'

const SANDBOX_CONTAINER = process.env.SANDBOX_CONTAINER ?? 'skylog-sandbox-1'
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const CONTAINER_NAME_RE = /^[a-zA-Z0-9][a-zA-Z0-9_.-]+$/

// Validate container name at startup to prevent injection
if (!CONTAINER_NAME_RE.test(SANDBOX_CONTAINER)) {
  throw new Error(`Invalid SANDBOX_CONTAINER name: "${SANDBOX_CONTAINER}"`)
}

/**
 * Argv-based docker exec wrapper.
 *
 * Why argv (spawn with array) and not exec (single string)?
 * The previous implementation passed everything through `child_process.exec`
 * which spawns a host shell to parse the command line. On Windows, host shell
 * is cmd.exe — quoting rules differ from POSIX. Passing
 *   docker exec <container> timeout 30 sh -c "cat \"/path with quotes\""
 * caused a triple-escape problem (host-shell → docker → sh -c → app), and
 * tools like `read_file` failed with exit 1 because tırnaklar bozuluyordu.
 *
 * `spawn` with an argv array bypasses host shell entirely — each argument
 * goes to docker as-is, then docker passes them as-is to the container.
 * Tools no longer need to JSON.stringify their paths defensively.
 */
async function spawnDockerExec(
  args: string[],
  timeoutMs: number,
): Promise<{ stdout: string; stderr: string; exitCode: number }> {
  return new Promise((resolve) => {
    let stdout = ''
    let stderr = ''
    let resolved = false

    const child = spawn('docker', args, {
      windowsHide: true,
    })

    const timer = setTimeout(() => {
      if (!resolved) {
        resolved = true
        try { child.kill('SIGKILL') } catch { /* noop */ }
        resolve({ stdout, stderr: stderr || `Host-side timeout after ${timeoutMs}ms`, exitCode: 124 })
      }
    }, timeoutMs + 2_000)

    child.stdout.on('data', (d) => { stdout += d.toString('utf8') })
    child.stderr.on('data', (d) => { stderr += d.toString('utf8') })

    child.on('error', (err) => {
      if (resolved) return
      resolved = true
      clearTimeout(timer)
      resolve({ stdout, stderr: stderr || err.message, exitCode: 1 })
    })

    child.on('close', (code) => {
      if (resolved) return
      resolved = true
      clearTimeout(timer)
      resolve({
        stdout,
        stderr,
        exitCode: typeof code === 'number' ? code : 1,
      })
    })
  })
}

export class DockerSandboxManager implements SandboxManager {
  /**
   * Execute a shell command inside the sandbox.
   *
   * The `command` parameter is a complete shell command string — it will be
   * passed to `sh -c "<command>"` inside the container, so usual shell
   * features (pipes, redirections, $(...), etc.) work. The string is delivered
   * to the container as a SINGLE argv element, which means we don't double-
   * escape on Windows / PowerShell hosts.
   *
   * For tools, this means: build your command as a normal POSIX shell string
   * (use single-arg JSON.stringify for paths with spaces/quotes), and don't
   * worry about host-shell quoting. The host never sees a shell.
   */
  async exec(
    command: string,
    options: SandboxExecOptions = {},
  ): Promise<{ stdout: string; stderr: string; exitCode: number }> {
    const { timeoutMs = 30_000, cwd } = options
    const timeoutSecs = Math.max(1, Math.floor(timeoutMs / 1000))

    const args = ['exec']
    if (cwd) {
      args.push('-w', cwd)
    }
    args.push(SANDBOX_CONTAINER)
    // `timeout` ensures the process inside the container is killed at the
    // deadline (not just the host-side Node child). `sh -c` lets us run
    // a full shell command including pipes / substitutions.
    args.push('timeout', String(timeoutSecs), 'sh', '-c', command)

    return spawnDockerExec(args, timeoutMs)
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
    // Safe — sessionId is UUID-validated above.
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