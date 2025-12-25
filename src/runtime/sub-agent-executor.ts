/**
 * Sub-Agent Executor
 * 
 * Handles spawning and running sub-agents from the spawn_agents tool.
 */

import type { AgentState } from '@/core'
import type { LLMRegistry } from '@/llm'
import type { ToolRegistry } from '@/tools'
import type { ProjectContext } from '@/tools'
import type { Logger } from '@/utils'
import type { AgentRegistry } from './agent-registry'
import { runStepLoop } from './step-loop'
import { createInitialState } from '@/core'
import type { RuntimeEvent } from './events'

export interface SubAgentExecutorConfig {
    readonly llmRegistry: LLMRegistry
    readonly toolRegistry: ToolRegistry
    readonly agentRegistry: AgentRegistry
    readonly projectContext: ProjectContext
    readonly logger: Logger
    readonly maxConcurrentAgents: number
    readonly maxAgentDepth: number
    readonly emit: (event: RuntimeEvent) => void
}

export interface SpawnRequest {
    readonly agentId: string
    readonly prompt: string
    readonly params?: Record<string, unknown>
}

export interface SpawnResult {
    readonly agentId: string
    readonly success: boolean
    readonly output?: unknown
    readonly error?: string
    readonly cost: number
}

export async function executeSubAgents(
    config: SubAgentExecutorConfig,
    requests: SpawnRequest[],
    parentState: AgentState,
    currentDepth: number
): Promise<SpawnResult[]> {
    const { maxConcurrentAgents, maxAgentDepth } = config

    if (currentDepth >= maxAgentDepth) {
        return requests.map(r => ({
            agentId: r.agentId,
            success: false,
            error: `Max agent depth (${maxAgentDepth}) exceeded`,
            cost: 0,
        }))
    }

    const results: SpawnResult[] = []

    // Process in batches to respect maxConcurrentAgents
    for (let i = 0; i < requests.length; i += maxConcurrentAgents) {
        const batch = requests.slice(i, i + maxConcurrentAgents)

        const batchResults = await Promise.all(
            batch.map(request => executeSubAgent(
                config,
                request,
                parentState,
                currentDepth
            ))
        )

        results.push(...batchResults)
    }

    return results
}

async function executeSubAgent(
    config: SubAgentExecutorConfig,
    request: SpawnRequest,
    parentState: AgentState,
    currentDepth: number
): Promise<SpawnResult> {
    const {
        llmRegistry,
        toolRegistry,
        agentRegistry,
        projectContext,
        logger,
        emit,
    } = config

    const agent = agentRegistry.get(request.agentId)
    if (!agent) {
        return {
            agentId: request.agentId,
            success: false,
            error: `Unknown agent: ${request.agentId}`,
            cost: 0,
        }
    }

    const subLogger = logger.child({ 
        subAgent: request.agentId, 
        depth: currentDepth + 1 
    })

    const runId = `${parentState.runId}-${request.agentId}-${Date.now()}`
    const initialState = createInitialState(agent, {
        runId,
        maxSteps: 20, // Sub-agents get fewer steps
        systemPrompt: agent.systemPrompt,
        toolDefinitions: Object.fromEntries(
            toolRegistry.toLLMFormat(agent.tools ?? []).map(t => [
                t.name,
                { description: t.description, inputSchema: t.input_schema },
            ])
        ),
    })

    try {
        emit({
            type: 'step_start',
            stepNumber: 0,
            agentId: request.agentId,
        })

        const result = await runStepLoop(
            {
                llmRegistry,
                toolRegistry,
                projectContext,
                logger: subLogger,
                emit,
            },
            {
                definition: agent,
                initialState,
                prompt: request.prompt,
                params: request.params,
            }
        )

        return {
            agentId: request.agentId,
            success: result.output.type === 'success',
            output: result.output.type === 'success' ? result.output.data ?? result.output.message : undefined,
            error: result.output.type === 'error' ? result.output.message : undefined,
            cost: result.totalCost,
        }
    } catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        subLogger.error({ error }, `Sub-agent ${request.agentId} failed`)

        return {
            agentId: request.agentId,
            success: false,
            error: message,
            cost: 0,
        }
    }
}
