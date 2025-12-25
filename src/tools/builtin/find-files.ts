/**
 * find_files tool
 * 
 * Find files matching a glob pattern using fd.
 */

import { spawn } from 'child_process'
import { join, isAbsolute } from 'path'
import { defineTool } from '@/tools'

export interface FindFilesInput {
    pattern: string
    path?: string
    type?: 'file' | 'directory' | 'any'
    maxDepth?: number
    excludes?: string[]
}

export const findFilesTool = defineTool<FindFilesInput>({
    name: 'find_files',
    description: 'Find files and directories matching a glob pattern.',
    inputSchema: {
        type: 'object',
        properties: {
            pattern: {
                type: 'string',
                description: 'Glob pattern to match (e.g., "*.ts", "**/*.json")',
            },
            path: {
                type: 'string',
                description: 'Directory to search in (relative to project root)',
            },
            type: {
                type: 'string',
                enum: ['file', 'directory', 'any'],
                description: 'Type of entries to find',
            },
            maxDepth: {
                type: 'number',
                description: 'Maximum depth to search',
            },
            excludes: {
                type: 'array',
                items: { type: 'string' },
                description: 'Patterns to exclude',
            },
        },
        required: ['pattern'],
    },
    permissions: {
        fileSystem: 'read',
    },

    async execute(context) {
        const { input, projectContext, logger, signal } = context
        const { pattern, path = '.', type = 'any', maxDepth, excludes = [] } = input
        const { projectRoot } = projectContext

        const searchPath = isAbsolute(path) ? path : join(projectRoot, path)

        const args = ['--glob', pattern]

        if (type === 'file') {
            args.push('--type', 'f')
        } else if (type === 'directory') {
            args.push('--type', 'd')
        }

        if (maxDepth !== undefined) {
            args.push('--max-depth', String(maxDepth))
        }

        for (const exclude of excludes) {
            args.push('--exclude', exclude)
        }

        args.push(searchPath)

        return new Promise((resolve) => {
            const child = spawn('fd', args, {
                cwd: projectRoot,
            })

            let stdout = ''
            let stderr = ''

            child.stdout?.on('data', (data: Buffer) => {
                stdout += data.toString()
            })

            child.stderr?.on('data', (data: Buffer) => {
                stderr += data.toString()
            })

            const abortHandler = () => child.kill('SIGTERM')
            signal.addEventListener('abort', abortHandler)

            child.on('close', (code) => {
                signal.removeEventListener('abort', abortHandler)

                if (code !== 0 && stderr) {
                    logger.warn({ stderr, code }, 'fd command failed')
                }

                const files = stdout
                    .trim()
                    .split('\n')
                    .filter(Boolean)
                    .slice(0, 100) // Limit results

                logger.debug({ pattern, path: searchPath, count: files.length }, 'Found files')

                resolve({
                    files,
                    count: files.length,
                    truncated: stdout.trim().split('\n').length > 100,
                })
            })

            child.on('error', (error) => {
                signal.removeEventListener('abort', abortHandler)
                logger.error({ error }, 'fd command error')
                resolve({ error: error.message, files: [] })
            })
        })
    },
})
