/**
 * Programmatic Step Handler
 * 
 * Executes the handleSteps generator for programmatic control flow.
 */

import type {
    AgentDefinition,
    AgentState,
    StepYield,
    StepYieldResult,
    ToolCallYield,
} from '@/core'
import { addMessage, addMessages } from '@/core'
import { assistantMessage } from '@/core/types/messages'
import type { ToolRegistry } from '@/tools'
import { executeTools } from '@/tools/executor'
import type { ProjectContext, ToolEvent } from '@/tools'
import type { Logger } from '@/utils'
import type { RuntimeEvent } from './events'

export interface ProgrammaticStepContext {
    readonly agentState: AgentState
    readonly definition: AgentDefinition
    readonly toolRegistry: ToolRegistry
    readonly projectContext: ProjectContext
    readonly logger: Logger
    readonly signal: AbortSignal
    readonly stepsComplete: boolean
    readonly nResponses?: readonly string[]
    readonly emit: (event: RuntimeEvent) => void
}

export interface ProgrammaticStepResult {
    readonly state: AgentState
    readonly endTurn: boolean
    readonly skipLLM: boolean
    readonly generateN?: number
}

export async function runProgrammaticStep(
    context: ProgrammaticStepContext,
    generator: Generator<StepYield, void, StepYieldResult>
): Promise<ProgrammaticStepResult> {
    const {
        agentState,
        toolRegistry,
        projectContext,
        logger,
        signal,
        stepsComplete,
        nResponses,
        emit,
    } = context

    let state = agentState

    const yieldResult = generator.next({
        agentState: state,
        stepsComplete,
        nResponses,
    })

    if (yieldResult.done) {
        return { state, endTurn: true, skipLLM: true }
    }

    const yielded = yieldResult.value

    if (typeof yielded === 'object' && 'toolName' in yielded) {
        const toolCallYield = yielded as ToolCallYield
        const toolCallId = crypto.randomUUID()

        emit({
            type: 'tool_start',
            toolName: toolCallYield.toolName,
            toolCallId,
            input: toolCallYield.input,
        })

        const toolResults = await executeTools({
            toolCalls: [{
                toolCallId,
                toolName: toolCallYield.toolName,
                input: toolCallYield.input,
            }],
            registry: toolRegistry,
            agentState: state,
            projectContext,
            logger,
            signal,
            onResult: (id, result) => {
                emit({ type: 'tool_result', toolCallId: id, result })
            },
            onEvent: (event: ToolEvent) => {
                emit({ type: 'tool_event', event })
            },
        })

        if (toolCallYield.includeToolCall !== false) {
            state = addMessage(state, assistantMessage('', {
                toolCalls: [{
                    toolCallId,
                    toolName: toolCallYield.toolName,
                    input: toolCallYield.input,
                }],
            }))
            state = addMessages(state, toolResults)
        }

        return { state, endTurn: false, skipLLM: true }
    }

    if (yielded === 'STEP') {
        return { state, endTurn: false, skipLLM: false }
    }

    if (yielded === 'STEP_ALL') {
        return { state, endTurn: false, skipLLM: false }
    }

    return { state, endTurn: false, skipLLM: false }
}

export function createStepGenerator(
    definition: AgentDefinition,
    initialContext: {
        agentState: AgentState
        prompt?: string
        params?: Record<string, unknown>
        logger: Logger
    }
): Generator<StepYield, void, StepYieldResult> | undefined {
    if (!definition.handleSteps) {
        return undefined
    }

    return definition.handleSteps({
        agentState: initialContext.agentState,
        prompt: initialContext.prompt,
        params: initialContext.params,
        logger: initialContext.logger,
    })
}
