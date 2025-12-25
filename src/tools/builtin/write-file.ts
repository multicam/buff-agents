/**
 * write_file tool
 * 
 * Create or overwrite a file with the given content.
 */

import { writeFile, mkdir } from 'fs/promises'
import { join, isAbsolute, dirname } from 'path'
import { defineTool } from '../types'

export interface WriteFileInput {
    path: string
    content: string
    instructions?: string
}

export const writeFileTool = defineTool<WriteFileInput>({
    name: 'write_file',
    description: 'Create or overwrite a file with the given content.',
    inputSchema: {
        type: 'object',
        properties: {
            path: {
                type: 'string',
                description: 'Path to the file (relative to project root)',
            },
            content: {
                type: 'string',
                description: 'Content to write to the file',
            },
            instructions: {
                type: 'string',
                description: 'Brief description of what the change does',
            },
        },
        required: ['path', 'content'],
    },
    permissions: {
        fileSystem: 'write',
    },

    async execute(context) {
        const { input, projectContext, logger, emit } = context
        const { path, content, instructions } = input
        const { projectRoot } = projectContext

        const fullPath = isAbsolute(path) ? path : join(projectRoot, path)

        try {
            await mkdir(dirname(fullPath), { recursive: true })
            await writeFile(fullPath, content, 'utf-8')

            emit({
                type: 'file_changed',
                path,
                action: 'created',
            })

            logger.debug({ path: fullPath, instructions }, `Wrote file: ${path}`)

            return {
                success: true,
                path,
                bytesWritten: Buffer.byteLength(content, 'utf-8'),
            }
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error)
            logger.error({ path: fullPath, error }, `Failed to write file: ${path}`)
            return { error: message }
        }
    },
})
