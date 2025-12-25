/**
 * Agent Definition Types
 * 
 * The blueprint for an agent - what it can do, how it behaves.
 * Agents are created via functional composition (builder pattern).
 */

import type { Message } from './messages'
import type { Logger } from '../../utils/logger'

export interface AgentDefinition {
    id: string
    displayName: string
    model: ModelIdentifier
    
    tools?: string[]
    spawnableAgents?: string[]
    
    systemPrompt?: string
    instructionsPrompt?: string
    stepPrompt?: string
    
    includeMessageHistory?: boolean
    setOutputEndsRun?: boolean
    
    handleSteps?: AgentStepHandler
    
    inputSchema?: InputSchema
    
    outputMode?: OutputMode
    outputSchema?: JsonSchema
}

export type ModelIdentifier =
    | `anthropic/${string}`
    | `openai/${string}`
    | `google/${string}`
    | `openrouter/${string}`
    | (string & {})

export type OutputMode = 'last_message' | 'all_messages' | 'structured_output'

export interface InputSchema {
    readonly prompt?: {
        readonly type: 'string'
        readonly description?: string
    }
    readonly params?: JsonSchema
}

export interface JsonSchema {
    readonly type: string
    readonly properties?: Readonly<Record<string, JsonSchema>>
    readonly items?: JsonSchema
    readonly required?: readonly string[]
    readonly description?: string
    readonly enum?: readonly unknown[]
    readonly default?: unknown
    readonly [key: string]: unknown
}

export type AgentStepHandler = (
    context: AgentStepContext
) => Generator<StepYield, void, StepYieldResult>

export interface AgentStepContext {
    readonly agentState: AgentState
    readonly prompt?: string
    readonly params?: Readonly<Record<string, unknown>>
    readonly logger: Logger
}

export type StepYield =
    | ToolCallYield
    | 'STEP'
    | 'STEP_ALL'

export interface ToolCallYield {
    readonly toolName: string
    readonly input: Readonly<Record<string, unknown>>
    readonly includeToolCall?: boolean
}

export interface StepYieldResult {
    readonly agentState: AgentState
    readonly toolResult?: unknown
    readonly stepsComplete: boolean
    readonly nResponses?: readonly string[]
}

export interface AgentState {
    readonly runId: string
    readonly agentId: string
    readonly parentId?: string
    readonly ancestorRunIds: readonly string[]
    readonly childRunIds: readonly string[]
    
    readonly messageHistory: readonly Message[]
    readonly systemPrompt: string
    readonly toolDefinitions: Readonly<Record<string, ToolDefinitionMeta>>
    
    readonly output?: Readonly<Record<string, unknown>>
    readonly stepsRemaining: number
    readonly creditsUsed: number
    readonly context: Readonly<Record<string, unknown>>
}

export interface ToolDefinitionMeta {
    readonly description: string
    readonly inputSchema: JsonSchema
}

export function createInitialState(
    definition: AgentDefinition,
    options: {
        runId: string
        parentId?: string
        ancestorRunIds?: readonly string[]
        maxSteps?: number
        systemPrompt?: string
        toolDefinitions?: Readonly<Record<string, ToolDefinitionMeta>>
    }
): AgentState {
    return {
        runId: options.runId,
        agentId: definition.id,
        parentId: options.parentId,
        ancestorRunIds: options.ancestorRunIds ?? [],
        childRunIds: [],
        messageHistory: [],
        systemPrompt: options.systemPrompt ?? definition.systemPrompt ?? '',
        toolDefinitions: options.toolDefinitions ?? {},
        output: undefined,
        stepsRemaining: options.maxSteps ?? 50,
        creditsUsed: 0,
        context: {},
    }
}

export function updateState(
    state: AgentState,
    updates: Partial<AgentState>
): AgentState {
    return { ...state, ...updates }
}

export function addMessage(state: AgentState, message: Message): AgentState {
    return {
        ...state,
        messageHistory: [...state.messageHistory, message],
    }
}

export function addMessages(state: AgentState, messages: readonly Message[]): AgentState {
    return {
        ...state,
        messageHistory: [...state.messageHistory, ...messages],
    }
}

export function addChildRunId(state: AgentState, childRunId: string): AgentState {
    return {
        ...state,
        childRunIds: [...state.childRunIds, childRunId],
    }
}

export function setOutput(
    state: AgentState,
    output: Readonly<Record<string, unknown>>
): AgentState {
    return {
        ...state,
        output,
    }
}

export function decrementSteps(state: AgentState): AgentState {
    return {
        ...state,
        stepsRemaining: state.stepsRemaining - 1,
    }
}

export function addCredits(state: AgentState, credits: number): AgentState {
    return {
        ...state,
        creditsUsed: state.creditsUsed + credits,
    }
}
