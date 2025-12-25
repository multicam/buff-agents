/**
 * str_replace tool
 * 
 * Find and replace strings in a file.
 */

import { readFile, writeFile } from 'fs/promises'
import { join, isAbsolute } from 'path'
import { defineTool } from '../types'

export interface StrReplaceInput {
    path: string
    replacements: Array<{
        old: string
        new: string
        allowMultiple?: boolean
    }>
}

export const strReplaceTool = defineTool<StrReplaceInput>({
    name: 'str_replace',
    description: 'Replace strings in a file with new strings.',
    inputSchema: {
        type: 'object',
        properties: {
            path: {
                type: 'string',
                description: 'Path to the file to edit (relative to project root)',
            },
            replacements: {
                type: 'array',
                items: {
                    type: 'object',
                    properties: {
                        old: {
                            type: 'string',
                            description: 'The exact string to replace',
                        },
                        new: {
                            type: 'string',
                            description: 'The string to replace it with',
                        },
                        allowMultiple: {
                            type: 'boolean',
                            description: 'Whether to allow multiple replacements',
                        },
                    },
                    required: ['old', 'new'],
                },
                description: 'Array of replacements to make',
            },
        },
        required: ['path', 'replacements'],
    },
    permissions: {
        fileSystem: 'write',
    },

    async execute(context) {
        const { input, projectContext, logger, emit } = context
        const { path, replacements } = input
        const { projectRoot } = projectContext

        const fullPath = isAbsolute(path) ? path : join(projectRoot, path)

        try {
            let content = await readFile(fullPath, 'utf-8')
            const results: Array<{ old: string; count: number; error?: string }> = []

            for (const replacement of replacements) {
                const { old: oldStr, new: newStr, allowMultiple = false } = replacement

                const occurrences = content.split(oldStr).length - 1

                if (occurrences === 0) {
                    results.push({
                        old: oldStr.slice(0, 50) + (oldStr.length > 50 ? '...' : ''),
                        count: 0,
                        error: 'String not found in file',
                    })
                    continue
                }

                if (occurrences > 1 && !allowMultiple) {
                    results.push({
                        old: oldStr.slice(0, 50) + (oldStr.length > 50 ? '...' : ''),
                        count: occurrences,
                        error: `Found ${occurrences} occurrences, but allowMultiple is false`,
                    })
                    continue
                }

                if (allowMultiple) {
                    content = content.split(oldStr).join(newStr)
                } else {
                    content = content.replace(oldStr, newStr)
                }

                results.push({
                    old: oldStr.slice(0, 50) + (oldStr.length > 50 ? '...' : ''),
                    count: allowMultiple ? occurrences : 1,
                })
            }

            await writeFile(fullPath, content, 'utf-8')

            emit({
                type: 'file_changed',
                path,
                action: 'modified',
            })

            logger.debug({ path: fullPath, results }, `Modified file: ${path}`)

            const hasErrors = results.some(r => r.error)
            return {
                success: !hasErrors,
                path,
                replacements: results,
            }
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error)
            logger.error({ path: fullPath, error }, `Failed to modify file: ${path}`)
            return { error: message }
        }
    },
})
