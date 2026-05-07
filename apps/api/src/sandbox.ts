import { exec } from 'child_process'
import { promisify } from 'util'
import type { SandboxManager, SandboxExecOptions } from './agents/types.js'

const execAsync = promisify(exec)

const SANDBOX_CONTAINER = process.env.SANDBOX_CONTAINER ?? 'skylog-sandbox-1'

export class DockerSandboxManager implements SandboxManager {
  async exec(
    command: string,
    options: SandboxExecOptions = {},
  ): Promise<{ stdout: string; stderr: string; exitCode: number }> {
    const { timeoutMs = 30_000, cwd } = options

    const cwdFlag = cwd ? `-w ${JSON.stringify(cwd)}` : ''
    const dockerCmd = `docker exec ${cwdFlag} ${SANDBOX_CONTAINER} sh -c ${JSON.stringify(command)}`

    try {
      const { stdout, stderr } = await execAsync(dockerCmd, { timeout: timeoutMs })
      return { stdout, stderr, exitCode: 0 }
    } catch (err: unknown) {
      const error = err as { stdout?: string; stderr?: string; code?: number }
      return {
        stdout: error.stdout ?? '',
        stderr: error.stderr ?? String(err),
        exitCode: error.code ?? 1,
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
    const shortId = agentId.replace(/-/g, '').slice(0, 16)
    await this.exec(`create-agent-user ${shortId} ${sessionId}`)
  }

  async ensureUploadsDir(sessionId: string): Promise<void> {
    await this.exec(`mkdir -p /workspace/sessions/${sessionId}/uploads`)
  }

  async removeSessionWorkspace(sessionId: string): Promise<void> {
    await this.exec(`rm -rf /workspace/sessions/${JSON.stringify(sessionId)}`)
  }

  async ping(): Promise<boolean> {
    const { exitCode } = await this.exec('echo ok')
    return exitCode === 0
  }
}

export const sandbox = new DockerSandboxManager()