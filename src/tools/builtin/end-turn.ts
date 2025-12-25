/**
 * end_turn tool
 * 
 * Explicitly end the agent's turn.
 */

import { defineTool } from '@/tools'

export interface EndTurnInput {
    message?: string
}

export const endTurnTool = defineTool<EndTurnInput>({
    name: 'end_turn',
    description: 'End your turn and allow the user to respond.',
    inputSchema: {
        type: 'object',
        properties: {
            message: {
                type: 'string',
                description: 'Optional final message',
            },
        },
    },
    endsAgentStep: true,

    async execute(context) {
        const { input, logger } = context
        logger.debug({ message: input.message }, 'Ending turn')
        return { ended: true, message: input.message }
    },
})
