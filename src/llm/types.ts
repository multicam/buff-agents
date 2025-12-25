/**
 * LLM Provider Types
 * 
 * Unified interface for LLM providers with AsyncIterable streaming.
 */

import type { Message, ToolCall } from '../core/types'
import type { LLMToolDefinition } from '../tools/types'

export interface LLMProvider {
    readonly name: string
    readonly supportedModels: RegExp[]

    supportsModel(model: string): boolean

    complete(request: CompletionRequest): Promise<CompletionResponse>

    stream(request: CompletionRequest): AsyncIterable<StreamChunk>
}

export interface CompletionRequest {
    readonly model: string
    readonly messages: readonly Message[]
    readonly tools?: readonly LLMToolDefinition[]
    readonly temperature?: number
    readonly maxTokens?: number
    readonly stopSequences?: readonly string[]
    readonly signal?: AbortSignal
}

export interface CompletionResponse {
    readonly content: string
    readonly toolCalls?: readonly ToolCall[]
    readonly usage: TokenUsage
    readonly finishReason: FinishReason
}

export type FinishReason = 'stop' | 'tool_calls' | 'length' | 'error'

export interface TokenUsage {
    readonly promptTokens: number
    readonly completionTokens: number
    readonly totalTokens: number
}

export type StreamChunk =
    | TextChunk
    | ToolCallStartChunk
    | ToolCallDeltaChunk
    | ToolCallEndChunk
    | UsageChunk
    | DoneChunk

export interface TextChunk {
    readonly type: 'text'
    readonly content: string
}

export interface ToolCallStartChunk {
    readonly type: 'tool_call_start'
    readonly toolCallId: string
    readonly toolName: string
}

export interface ToolCallDeltaChunk {
    readonly type: 'tool_call_delta'
    readonly toolCallId: string
    readonly inputDelta: string
}

export interface ToolCallEndChunk {
    readonly type: 'tool_call_end'
    readonly toolCall: ToolCall
}

export interface UsageChunk {
    readonly type: 'usage'
    readonly usage: TokenUsage
}

export interface DoneChunk {
    readonly type: 'done'
    readonly finishReason: FinishReason
}

export interface LLMProviderConfig {
    readonly apiKey: string
    readonly baseUrl?: string
}
