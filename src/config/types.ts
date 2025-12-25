/**
 * Configuration Types
 */

import type { ModelIdentifier } from '../core/types'
import type { LLMProviderConfig } from '../llm/types'

export interface BuffAgentsConfig {
    readonly providers?: {
        readonly anthropic?: LLMProviderConfig
        readonly openai?: LLMProviderConfig
        readonly google?: LLMProviderConfig
        readonly openrouter?: LLMProviderConfig
    }

    readonly defaultModel?: ModelIdentifier

    readonly agentsDir?: string

    readonly maxSteps?: number
    readonly maxConcurrentAgents?: number
    readonly maxAgentDepth?: number

    readonly mcp?: {
        readonly exposeAgents?: readonly string[]
        readonly exposePrimitives?: readonly string[]
    }
}

export const defaultConfig: BuffAgentsConfig = {
    defaultModel: 'anthropic/claude-sonnet-4',
    maxSteps: 50,
    maxConcurrentAgents: 10,
    maxAgentDepth: 5,
}
