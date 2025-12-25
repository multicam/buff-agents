/**
 * read_files tool
 * 
 * Read multiple files from disk and return their contents.
 */

import { readFile } from 'fs/promises'
import { join, isAbsolute } from 'path'
import { defineTool } from '../types'

export interface ReadFilesInput {
    paths: string[]
}

export const readFilesTool = defineTool<ReadFilesInput>({
    name: 'read_files',
    description: 'Read multiple files from disk and return their contents.',
    inputSchema: {
        type: 'object',
        properties: {
            paths: {
                type: 'array',
                items: { type: 'string' },
                description: 'List of file paths to read (relative to project root)',
            },
        },
        required: ['paths'],
    },
    permissions: {
        fileSystem: 'read',
    },

    async execute(context) {
        const { input, projectContext, logger, signal } = context
        const { paths } = input
        const { projectRoot } = projectContext

        const results: Record<string, string | { error: string }> = {}

        for (const path of paths) {
            if (signal.aborted) break

            const fullPath = isAbsolute(path) ? path : join(projectRoot, path)

            try {
                const content = await readFile(fullPath, 'utf-8')
                results[path] = content
                logger.debug({ path: fullPath }, `Read file: ${path}`)
            } catch (error) {
                const message = error instanceof Error ? error.message : String(error)
                results[path] = { error: message }
                logger.warn({ path: fullPath, error }, `Failed to read file: ${path}`)
            }
        }

        return { files: results }
    },
})
