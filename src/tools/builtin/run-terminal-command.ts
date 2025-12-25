/**
 * run_terminal_command tool
 * 
 * Execute CLI commands with support for blocking, background, and streaming modes.
 */

import { spawn } from 'child_process'
import { join, isAbsolute } from 'path'
import { defineTool } from '../types'

export interface RunTerminalCommandInput {
    command: string
    process_type?: 'SYNC' | 'BACKGROUND'
    cwd?: string
    timeout_seconds?: number
}

export const runTerminalCommandTool = defineTool<RunTerminalCommandInput>({
    name: 'run_terminal_command',
    description: 'Execute a CLI command from the project root.',
    inputSchema: {
        type: 'object',
        properties: {
            command: {
                type: 'string',
                description: 'CLI command to execute',
            },
            process_type: {
                type: 'string',
                enum: ['SYNC', 'BACKGROUND'],
                description: 'SYNC waits for completion, BACKGROUND runs in background',
                default: 'SYNC',
            },
            cwd: {
                type: 'string',
                description: 'Working directory (relative to project root)',
            },
            timeout_seconds: {
                type: 'number',
                description: 'Timeout in seconds (-1 for no timeout)',
                default: 30,
            },
        },
        required: ['command'],
    },
    permissions: {
        shell: true,
    },
    requiresSequential: true,

    async execute(context) {
        const { input, projectContext, logger, signal, emit } = context
        const {
            command,
            process_type = 'SYNC',
            cwd,
            timeout_seconds = 30,
        } = input
        const { projectRoot } = projectContext

        const workingDir = cwd
            ? (isAbsolute(cwd) ? cwd : join(projectRoot, cwd))
            : projectRoot

        logger.debug({ command, cwd: workingDir, process_type }, `Executing command`)

        if (process_type === 'BACKGROUND') {
            return executeBackground(command, workingDir, logger)
        }

        return executeSync(command, workingDir, timeout_seconds, signal, emit, logger)
    },
})

async function executeSync(
    command: string,
    cwd: string,
    timeoutSeconds: number,
    signal: AbortSignal,
    emit: (event: any) => void,
    logger: any
): Promise<Record<string, unknown>> {
    return new Promise((resolve) => {
        const child = spawn(command, {
            shell: true,
            cwd,
            env: { ...process.env, PAGER: 'cat' },
        })

        let stdout = ''
        let stderr = ''
        let timedOut = false

        const timeout = timeoutSeconds > 0
            ? setTimeout(() => {
                  timedOut = true
                  child.kill('SIGTERM')
              }, timeoutSeconds * 1000)
            : null

        const abortHandler = () => {
            child.kill('SIGTERM')
        }
        signal.addEventListener('abort', abortHandler)

        child.stdout?.on('data', (data: Buffer) => {
            const text = data.toString()
            stdout += text
            emit({ type: 'command_output', stream: 'stdout', data: text })
        })

        child.stderr?.on('data', (data: Buffer) => {
            const text = data.toString()
            stderr += text
            emit({ type: 'command_output', stream: 'stderr', data: text })
        })

        child.on('close', (code) => {
            if (timeout) clearTimeout(timeout)
            signal.removeEventListener('abort', abortHandler)

            logger.debug({ command, exitCode: code, timedOut }, `Command completed`)

            if (timedOut) {
                resolve({
                    error: `Command timed out after ${timeoutSeconds} seconds`,
                    stdout: stdout.slice(-10000),
                    stderr: stderr.slice(-10000),
                    exitCode: code,
                })
            } else if (signal.aborted) {
                resolve({
                    error: 'Command was cancelled',
                    stdout: stdout.slice(-10000),
                    stderr: stderr.slice(-10000),
                    exitCode: code,
                })
            } else {
                resolve({
                    stdout: stdout.slice(-50000),
                    stderr: stderr.slice(-10000),
                    exitCode: code ?? 0,
                })
            }
        })

        child.on('error', (error) => {
            if (timeout) clearTimeout(timeout)
            signal.removeEventListener('abort', abortHandler)

            logger.error({ command, error }, `Command failed`)
            resolve({
                error: error.message,
                stdout: stdout.slice(-10000),
                stderr: stderr.slice(-10000),
            })
        })
    })
}

function executeBackground(
    command: string,
    cwd: string,
    logger: any
): Record<string, unknown> {
    const child = spawn(command, {
        shell: true,
        cwd,
        detached: true,
        stdio: 'ignore',
        env: { ...process.env, PAGER: 'cat' },
    })

    child.unref()

    logger.debug({ command, pid: child.pid }, `Started background process`)

    return {
        status: 'started',
        pid: child.pid,
        message: `Background process started with PID ${child.pid}`,
    }
}
