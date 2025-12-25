/**
 * Runtime Events
 * 
 * Events emitted during agent execution for observability.
 */

import type { ToolCall } from '../core/types'
import type { ToolEvent } from '../tools/types'
import type { TokenUsage } from '../llm/types'

export type RuntimeEvent =
    | StepStartEvent
    | StepEndEvent
    | LLMRequestEvent
    | LLMTextEvent
    | LLMResponseEvent
    | ToolStartEvent
    | ToolResultEvent
    | ToolEventWrapper
    | RunCompleteEvent
    | ErrorEvent
    | StepLimitReachedEvent

export interface StepStartEvent {
    readonly type: 'step_start'
    readonly stepNumber: number
    readonly agentId: string
}

export interface StepEndEvent {
    readonly type: 'step_end'
    readonly stepNumber: number
    readonly shouldContinue: boolean
}

export interface LLMRequestEvent {
    readonly type: 'llm_request'
    readonly model: string
    readonly messageCount: number
}

export interface LLMTextEvent {
    readonly type: 'llm_text'
    readonly text: string
}

export interface LLMResponseEvent {
    readonly type: 'llm_response'
    readonly content: string
    readonly toolCalls: readonly ToolCall[]
    readonly usage?: TokenUsage
}

export interface ToolStartEvent {
    readonly type: 'tool_start'
    readonly toolName: string
    readonly toolCallId: string
    readonly input: unknown
}

export interface ToolResultEvent {
    readonly type: 'tool_result'
    readonly toolCallId: string
    readonly result: unknown
}

export interface ToolEventWrapper {
    readonly type: 'tool_event'
    readonly event: ToolEvent
}

export interface RunCompleteEvent {
    readonly type: 'run_complete'
    readonly agentId: string
    readonly output: unknown
    readonly totalCost: number
}

export interface ErrorEvent {
    readonly type: 'error'
    readonly error: Error
    readonly context?: string
}

export interface StepLimitReachedEvent {
    readonly type: 'step_limit_reached'
    readonly agentId: string
}

export type EventHandler = (event: RuntimeEvent) => void

export function createEventEmitter(): {
    emit: EventHandler
    on: (handler: EventHandler) => () => void
} {
    const handlers = new Set<EventHandler>()

    return {
        emit: (event: RuntimeEvent) => {
            for (const handler of handlers) {
                handler(event)
            }
        },
        on: (handler: EventHandler) => {
            handlers.add(handler)
            return () => handlers.delete(handler)
        },
    }
}
