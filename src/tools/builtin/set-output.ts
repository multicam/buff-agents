/**
 * set_output tool
 * 
 * Set the agent's output value. This is passed back to parent agents
 * or returned as the final result.
 */

import { defineTool } from '@/tools'

export interface SetOutputInput {
    output: Record<string, unknown>
}

export const setOutputTool = defineTool<SetOutputInput>({
    name: 'set_output',
    description: 'Set the agent output value to be returned to the caller.',
    inputSchema: {
        type: 'object',
        properties: {
            output: {
                type: 'object',
                description: 'JSON object to set as the agent output',
            },
        },
        required: ['output'],
    },

    async execute(context) {
        const { input, logger } = context
        const { output } = input

        logger.debug({ output }, 'Setting agent output')

        return {
            success: true,
            output,
        }
    },
})
