/**
 * grep_search tool
 * 
 * Search for text patterns in files using ripgrep.
 */

import { spawn } from 'child_process'
import { join, isAbsolute } from 'path'
import { defineTool } from '@/tools'

export interface GrepSearchInput {
    query: string
    path?: string
    includes?: string[]
    caseSensitive?: boolean
    fixedStrings?: boolean
    maxResults?: number
}

export const grepSearchTool = defineTool<GrepSearchInput>({
    name: 'grep_search',
    description: 'Search for text patterns in files using ripgrep.',
    inputSchema: {
        type: 'object',
        properties: {
            query: {
                type: 'string',
                description: 'Search pattern (regex by default)',
            },
            path: {
                type: 'string',
                description: 'Directory or file to search (relative to project root)',
            },
            includes: {
                type: 'array',
                items: { type: 'string' },
                description: 'Glob patterns to include (e.g., "*.ts")',
            },
            caseSensitive: {
                type: 'boolean',
                description: 'Case-sensitive search (default: false)',
            },
            fixedStrings: {
                type: 'boolean',
                description: 'Treat query as literal string, not regex',
            },
            maxResults: {
                type: 'number',
                description: 'Maximum number of results (default: 50)',
            },
        },
        required: ['query'],
    },
    permissions: {
        fileSystem: 'read',
    },

    async execute(context) {
        const { input, projectContext, logger, signal } = context
        const {
            query,
            path = '.',
            includes = [],
            caseSensitive = false,
            fixedStrings = false,
            maxResults = 50,
        } = input
        const { projectRoot } = projectContext

        const searchPath = isAbsolute(path) ? path : join(projectRoot, path)

        const args = ['--json', '--max-count', String(maxResults)]

        if (!caseSensitive) {
            args.push('--ignore-case')
        }

        if (fixedStrings) {
            args.push('--fixed-strings')
        }

        for (const include of includes) {
            args.push('--glob', include)
        }

        args.push(query, searchPath)

        return new Promise((resolve) => {
            const child = spawn('rg', args, {
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

                if (code !== 0 && code !== 1 && stderr) {
                    logger.warn({ stderr, code }, 'rg command failed')
                }

                const matches = parseRipgrepOutput(stdout)

                logger.debug({ query, path: searchPath, count: matches.length }, 'Search complete')

                resolve({
                    matches,
                    count: matches.length,
                    truncated: matches.length >= maxResults,
                })
            })

            child.on('error', (error) => {
                signal.removeEventListener('abort', abortHandler)
                logger.error({ error }, 'rg command error')
                resolve({ error: error.message, matches: [] })
            })
        })
    },
})

interface RipgrepMatch {
    file: string
    line: number
    text: string
}

function parseRipgrepOutput(output: string): RipgrepMatch[] {
    const matches: RipgrepMatch[] = []

    for (const line of output.trim().split('\n')) {
        if (!line) continue

        try {
            const parsed = JSON.parse(line)
            if (parsed.type === 'match') {
                matches.push({
                    file: parsed.data.path.text,
                    line: parsed.data.line_number,
                    text: parsed.data.lines.text.trim(),
                })
            }
        } catch {
            // Skip malformed lines
        }
    }

    return matches
}
