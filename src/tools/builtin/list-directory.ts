/**
 * list_directory tool
 * 
 * List files and directories in a given path.
 */

import { readdir } from 'fs/promises'
import { join, isAbsolute } from 'path'
import { defineTool } from '../types'

export interface ListDirectoryInput {
    path: string
}

export const listDirectoryTool = defineTool<ListDirectoryInput>({
    name: 'list_directory',
    description: 'List files and directories in the specified path.',
    inputSchema: {
        type: 'object',
        properties: {
            path: {
                type: 'string',
                description: 'Directory path to list (relative to project root)',
            },
        },
        required: ['path'],
    },
    permissions: {
        fileSystem: 'read',
    },

    async execute(context) {
        const { input, projectContext, logger } = context
        const { path } = input
        const { projectRoot } = projectContext

        const fullPath = isAbsolute(path) ? path : join(projectRoot, path)

        try {
            const entries = await readdir(fullPath, { withFileTypes: true })

            const files: string[] = []
            const directories: string[] = []

            for (const entry of entries) {
                if (entry.isDirectory()) {
                    directories.push(entry.name)
                } else {
                    files.push(entry.name)
                }
            }

            logger.debug({ path: fullPath, fileCount: files.length, dirCount: directories.length }, `Listed directory: ${path}`)

            return {
                path,
                files: files.sort(),
                directories: directories.sort(),
            }
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error)
            logger.error({ path: fullPath, error }, `Failed to list directory: ${path}`)
            return { error: message }
        }
    },
})
