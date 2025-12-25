/**
 * Agent Runtime
 * 
 * Main entry point for running agents.
 */

import type { AgentDefinition, AgentState } from '@/core'
import { createInitialState } from '@/core'
import type { LLMRegistry } from '@/llm'
import type { ToolRegistry } from '@/tools'
import type { ProjectContext } from '@/tools'
import type { Logger } from '@/utils'
import { defaultLogger } from '@/utils'
import type { RuntimeEvent } from './events'
import { runStepLoop, type AgentOutput } from './step-loop'

export interface AgentRuntimeConfig {
    readonly llmRegistry: LLMRegistry
    readonly toolRegistry: ToolRegistry
    readonly projectContext: ProjectContext
    readonly logger?: Logger
    readonly maxSteps?: number
    readonly maxConcurrentAgents?: number
    readonly maxAgentDepth?: number
    readonly onEvent?: (event: RuntimeEvent) => void
}

export interface RunParams {
    readonly agent: AgentDefinition
    readonly prompt: string
    readonly params?: Record<string, unknown>
    readonly signal?: AbortSignal
}

export interface RunResult {
    readonly state: AgentState
    readonly output: AgentOutput
    readonly totalCost: number
}

export class AgentRuntime {
    private config: Required<Omit<AgentRuntimeConfig, 'onEvent'>> & { onEvent?: (event: RuntimeEvent) => void }

    constructor(config: AgentRuntimeConfig) {
        this.config = {
            llmRegistry: config.llmRegistry,
            toolRegistry: config.toolRegistry,
            projectContext: config.projectContext,
            logger: config.logger ?? defaultLogger,
            maxSteps: config.maxSteps ?? 50,
            maxConcurrentAgents: config.maxConcurrentAgents ?? 10,
            maxAgentDepth: config.maxAgentDepth ?? 5,
            onEvent: config.onEvent,
        }
    }

    async run(params: RunParams): Promise<RunResult> {
        const { agent, prompt, params: agentParams, signal } = params

        const runId = crypto.randomUUID()
        const initialState = createInitialState(agent, {
            runId,
            maxSteps: this.config.maxSteps,
            systemPrompt: agent.systemPrompt,
            toolDefinitions: Object.fromEntries(
                this.config.toolRegistry.toLLMFormat(agent.tools ?? []).map(t => [
                    t.name,
                    { description: t.description, inputSchema: t.input_schema },
                ])
            ),
        })

        return runStepLoop(
            {
                llmRegistry: this.config.llmRegistry,
                toolRegistry: this.config.toolRegistry,
                projectContext: this.config.projectContext,
                logger: this.config.logger,
                emit: this.config.onEvent ?? (() => {}),
            },
            {
                definition: agent,
                initialState,
                prompt,
                params: agentParams,
                signal,
            }
        )
    }

    get llm(): LLMRegistry {
        return this.config.llmRegistry
    }

    get tools(): ToolRegistry {
        return this.config.toolRegistry
    }

    get project(): ProjectContext {
        return this.config.projectContext
    }

    get logger(): Logger {
        return this.config.logger
    }
}

export function createAgentRuntime(config: AgentRuntimeConfig): AgentRuntime {
    return new AgentRuntime(config)
}
