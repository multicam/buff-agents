/**
 * Message types for agent conversations
 * 
 * Messages flow through the system as immutable objects with optional
 * TTL tags for smart truncation.
 */

export type Message =
    | SystemMessage
    | UserMessage
    | AssistantMessage
    | ToolMessage

export interface SystemMessage {
    readonly role: 'system'
    readonly content: string
}

export interface UserMessage {
    readonly role: 'user'
    readonly content: string | readonly ContentPart[]
    readonly tags?: readonly string[]
    readonly timeToLive?: MessageTTL
    readonly keepDuringTruncation?: boolean
}

export interface AssistantMessage {
    readonly role: 'assistant'
    readonly content: string
    readonly toolCalls?: readonly ToolCall[]
    readonly tags?: readonly string[]
    readonly timeToLive?: MessageTTL
    readonly keepDuringTruncation?: boolean
}

export interface ToolMessage {
    readonly role: 'tool'
    readonly toolName: string
    readonly toolCallId: string
    readonly content: ToolResultContent
    readonly tags?: readonly string[]
    readonly timeToLive?: MessageTTL
    readonly keepDuringTruncation?: boolean
}

export type MessageTTL = 'userPrompt' | 'agentStep' | 'forever'

export type ContentPart =
    | TextPart
    | ImagePart

export interface TextPart {
    readonly type: 'text'
    readonly text: string
}

export interface ImagePart {
    readonly type: 'image'
    readonly url: string
    readonly mimeType?: string
}

export interface ToolCall {
    readonly toolCallId: string
    readonly toolName: string
    readonly input: Readonly<Record<string, unknown>>
}

export type ToolResultContent =
    | string
    | readonly ToolResultPart[]

export type ToolResultPart =
    | { readonly type: 'text'; readonly text: string }
    | { readonly type: 'json'; readonly data: unknown }
    | { readonly type: 'error'; readonly message: string }

export function systemMessage(content: string): SystemMessage {
    return { role: 'system', content }
}

export function userMessage(
    content: string | readonly ContentPart[],
    options?: {
        tags?: readonly string[]
        timeToLive?: MessageTTL
        keepDuringTruncation?: boolean
    }
): UserMessage {
    return {
        role: 'user',
        content,
        ...options,
    }
}

export function assistantMessage(
    content: string,
    options?: {
        toolCalls?: readonly ToolCall[]
        tags?: readonly string[]
        timeToLive?: MessageTTL
        keepDuringTruncation?: boolean
    }
): AssistantMessage {
    return {
        role: 'assistant',
        content,
        ...options,
    }
}

export function toolMessage(
    toolName: string,
    toolCallId: string,
    content: ToolResultContent,
    options?: {
        tags?: readonly string[]
        timeToLive?: MessageTTL
        keepDuringTruncation?: boolean
    }
): ToolMessage {
    return {
        role: 'tool',
        toolName,
        toolCallId,
        content,
        ...options,
    }
}

export function isSystemMessage(msg: Message): msg is SystemMessage {
    return msg.role === 'system'
}

export function isUserMessage(msg: Message): msg is UserMessage {
    return msg.role === 'user'
}

export function isAssistantMessage(msg: Message): msg is AssistantMessage {
    return msg.role === 'assistant'
}

export function isToolMessage(msg: Message): msg is ToolMessage {
    return msg.role === 'tool'
}
