/**
 * spawn_agents tool
 * 
 * Spawn sub-agents to handle specific tasks.
 * This is the core orchestration primitive for the layers pattern.
 */

import { defineTool } from '@/tools'

export interface SpawnAgentsInput {
    agents: Array<{
        agentId: string
        prompt: string
        params?: Record<string, unknown>
    }>
}

export interface SpawnAgentsContext {
    spawnAgent: (
        agentId: string,
        prompt: string,
        params?: Record<string, unknown>
    ) => Promise<SpawnResult>
}

export interface SpawnResult {
    agentId: string
    success: boolean
    output?: unknown
    error?: string
    cost: number
}

export const spawnAgentsTool = defineTool<SpawnAgentsInput>({
    name: 'spawn_agents',
    description: 'Spawn sub-agents to handle specific tasks. Each agent runs to completion and returns its output.',
    inputSchema: {
        type: 'object',
        properties: {
            agents: {
                type: 'array',
                items: {
                    type: 'object',
                    properties: {
                        agentId: {
                            type: 'string',
                            description: 'ID of the agent to spawn',
                        },
                        prompt: {
                            type: 'string',
                            description: 'Task description for the agent',
                        },
                        params: {
                            type: 'object',
                            description: 'Optional parameters to pass to the agent',
                        },
                    },
                    required: ['agentId', 'prompt'],
                },
                description: 'List of agents to spawn',
            },
        },
        required: ['agents'],
    },

    async execute(context) {
        const { input, logger } = context
        const { agents } = input

        // The actual spawning is handled by the runtime
        // This tool just validates and returns the spawn request
        // The runtime intercepts spawn_agents calls and handles them specially

        logger.debug({ agentCount: agents.length }, 'Spawn agents requested')

        // Return the spawn request for the runtime to process
        return {
            type: 'spawn_request',
            agents: agents.map(a => ({
                agentId: a.agentId,
                prompt: a.prompt,
                params: a.params,
            })),
        }
    },
})
