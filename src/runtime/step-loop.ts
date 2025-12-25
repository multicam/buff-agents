/**
 * Step Loop
 * 
 * The core agent execution loop:
 * 1. Run programmatic step (if handleSteps defined)
 * 2. Build messages for LLM
 * 3. Call LLM with streaming
 * 4. Parse and execute tool calls
 * 5. Update state (immutable)
 * 6. Check turn ending conditions
 * 7. Repeat until done
 */

import type {
    AgentDefinition,
    AgentState,
} from '../core/types'
import {
    addMessage,
    addMessages,
    addCredits,
    decrementSteps,
    setOutput,
    updateState,
} from '../core/types'
import { assistantMessage, systemMessage, userMessage } from '../core/types/messages'
import type { LLMRegistry } from '../llm/registry'
import type { ToolRegistry } from '../tools/registry'
import { executeTools } from '../tools/executor'
import type { ProjectContext, ToolEvent } from '../tools/types'
import type { Logger } from '../utils/logger'
import type { RuntimeEvent } from './events'
import { expireMessages } from './messages'
import { runProgrammaticStep, createStepGenerator } from './programmatic-step'

export interface StepLoopConfig {
    readonly llmRegistry: LLMRegistry
    readonly toolRegistry: ToolRegistry
    readonly projectContext: ProjectContext
    readonly logger: Logger
    readonly emit: (event: RuntimeEvent) => void
}

export interface StepLoopParams {
    readonly definition: AgentDefinition
    readonly initialState: AgentState
    readonly prompt?: string
    readonly params?: Record<string, unknown>
    readonly signal?: AbortSignal
}

export interface StepLoopResult {
    readonly state: AgentState
    readonly output: AgentOutput
    readonly totalCost: number
}

export type AgentOutput =
    | { readonly type: 'success'; readonly message: string; readonly data?: unknown }
    | { readonly type: 'error'; readonly message: string }

export async function runStepLoop(
    config: StepLoopConfig,
    params: StepLoopParams
): Promise<StepLoopResult> {
    const { llmRegistry, toolRegistry, projectContext, logger, emit } = config
    const { definition, initialState, prompt, params: agentParams, signal } = params

    let state = initialState
    let shouldContinue = true
    let stepNumber = 0

    const abortSignal = signal ?? new AbortController().signal

    const stepGenerator = createStepGenerator(definition, {
        agentState: state,
        prompt,
        params: agentParams,
        logger,
    })

    let nResponses: string[] | undefined

    if (prompt) {
        state = addMessage(state, userMessage(prompt, {
            tags: ['USER_PROMPT'],
            keepDuringTruncation: true,
        }))
    }

    if (definition.instructionsPrompt) {
        state = addMessage(state, userMessage(definition.instructionsPrompt, {
            tags: ['INSTRUCTIONS_PROMPT'],
            keepDuringTruncation: true,
        }))
    }

    while (shouldContinue && !abortSignal.aborted) {
        stepNumber++
        emit({ type: 'step_start', stepNumber, agentId: state.agentId })

        if (state.stepsRemaining <= 0) {
            emit({ type: 'step_limit_reached', agentId: state.agentId })
            break
        }

        if (stepGenerator) {
            const programmaticResult = await runProgrammaticStep(
                {
                    agentState: state,
                    definition,
                    toolRegistry,
                    projectContext,
                    logger,
                    signal: abortSignal,
                    stepsComplete: !shouldContinue,
                    nResponses,
                    emit,
                },
                stepGenerator
            )

            state = programmaticResult.state

            if (programmaticResult.endTurn) {
                shouldContinue = false
                continue
            }

            if (programmaticResult.skipLLM) {
                continue
            }
        }

        state = updateState(state, {
            messageHistory: expireMessages(state.messageHistory, 'agentStep'),
        })

        if (definition.stepPrompt) {
            state = addMessage(state, userMessage(definition.stepPrompt, {
                tags: ['STEP_PROMPT'],
                timeToLive: 'agentStep',
                keepDuringTruncation: true,
            }))
        }

        const provider = llmRegistry.getProvider(definition.model)
        const tools = toolRegistry.toLLMFormat(definition.tools ?? [])

        const messages = [
            systemMessage(state.systemPrompt),
            ...state.messageHistory,
        ]

        emit({
            type: 'llm_request',
            model: definition.model,
            messageCount: messages.length,
        })

        let content = ''
        const toolCalls: Array<{
            toolCallId: string
            toolName: string
            input: Record<string, unknown>
        }> = []

        try {
            for await (const chunk of provider.stream({
                model: definition.model,
                messages,
                tools: tools.length > 0 ? tools : undefined,
                signal: abortSignal,
            })) {
                if (chunk.type === 'text') {
                    content += chunk.content
                    emit({ type: 'llm_text', text: chunk.content })
                } else if (chunk.type === 'tool_call_end') {
                    toolCalls.push(chunk.toolCall)
                } else if (chunk.type === 'usage') {
                    state = addCredits(state, estimateCost(chunk.usage, definition.model))
                }
            }
        } catch (error) {
            const errorMsg = error instanceof Error ? error.message : String(error)
            emit({ type: 'error', error: error as Error, context: 'llm_stream' })

            state = addMessage(state, userMessage(
                `[System] LLM error: ${errorMsg}. Please retry or adjust your approach.`,
                { tags: ['ERROR'], timeToLive: 'agentStep' }
            ))

            state = decrementSteps(state)
            emit({ type: 'step_end', stepNumber, shouldContinue: true })
            continue
        }

        emit({
            type: 'llm_response',
            content,
            toolCalls,
        })

        state = addMessage(state, assistantMessage(content, {
            toolCalls: toolCalls.length > 0 ? toolCalls : undefined,
        }))

        if (toolCalls.length > 0) {
            const toolResults = await executeTools({
                toolCalls,
                registry: toolRegistry,
                agentState: state,
                projectContext,
                logger,
                signal: abortSignal,
                onResult: (id, result) => {
                    emit({ type: 'tool_result', toolCallId: id, result })

                    if (typeof result === 'object' && result !== null && 'output' in result) {
                        const setOutputResult = result as { output?: Record<string, unknown> }
                        if (setOutputResult.output) {
                            state = setOutput(state, setOutputResult.output)
                        }
                    }
                },
                onEvent: (event: ToolEvent) => {
                    emit({ type: 'tool_event', event })
                },
            })

            state = addMessages(state, toolResults)

            const endTurnTools = new Set(['end_turn', 'task_completed'])
            if (definition.setOutputEndsRun) {
                endTurnTools.add('set_output')
            }

            if (toolCalls.some(tc => endTurnTools.has(tc.toolName))) {
                shouldContinue = false
            }
        } else {
            shouldContinue = false
        }

        state = decrementSteps(state)
        emit({ type: 'step_end', stepNumber, shouldContinue })
    }

    const lastContent = state.messageHistory
        .filter(m => m.role === 'assistant')
        .map(m => m.content)
        .pop() ?? ''

    const output = getAgentOutput(state, definition, lastContent as string)

    emit({
        type: 'run_complete',
        agentId: state.agentId,
        output,
        totalCost: state.creditsUsed,
    })

    return {
        state,
        output,
        totalCost: state.creditsUsed,
    }
}

function getAgentOutput(
    state: AgentState,
    definition: AgentDefinition,
    lastContent: string
): AgentOutput {
    if (state.output) {
        return {
            type: 'success',
            message: 'Agent completed with output',
            data: state.output,
        }
    }

    if (definition.outputMode === 'last_message') {
        return {
            type: 'success',
            message: lastContent || 'Agent completed',
        }
    }

    return {
        type: 'success',
        message: lastContent || 'Agent completed',
    }
}

function estimateCost(usage: { promptTokens: number; completionTokens: number }, model: string): number {
    const pricing: Record<string, { prompt: number; completion: number }> = {
        'anthropic/claude-sonnet-4': { prompt: 0.003, completion: 0.015 },
        'anthropic/claude-opus-4': { prompt: 0.015, completion: 0.075 },
        'anthropic/claude-haiku-3.5': { prompt: 0.0008, completion: 0.004 },
    }

    const price = pricing[model] ?? { prompt: 0.003, completion: 0.015 }
    return (usage.promptTokens * price.prompt + usage.completionTokens * price.completion) / 1000
}
