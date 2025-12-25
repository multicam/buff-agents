/**
 * Tool System Types
 * 
 * Schema-first tool definitions with JSON Schema for input validation.
 * Tools return simple string/JSON results.
 */

import type { AgentState, JsonSchema } from '@/core'
import type { Logger } from '@/utils'

export interface ToolDefinition<TInput = unknown> {
    readonly name: string
    readonly description: string
    readonly inputSchema: JsonSchema
    
    readonly endsAgentStep?: boolean
    readonly requiresSequential?: boolean
    
    readonly permissions?: ToolPermissions
    
    readonly execute: ToolHandler<TInput>
}

export interface ToolPermissions {
    readonly fileSystem?: 'read' | 'write' | 'full' | 'none'
    readonly network?: 'local' | 'external' | 'none'
    readonly shell?: boolean
    readonly env?: boolean
}

export type ToolHandler<TInput> = (
    context: ToolExecutionContext<TInput>
) => Promise<ToolResult>

export interface ToolExecutionContext<TInput> {
    readonly input: TInput
    readonly toolCallId: string
    readonly agentState: Readonly<AgentState>
    readonly projectContext: ProjectContext
    readonly logger: Logger
    readonly signal: AbortSignal
    readonly emit: (event: ToolEvent) => void
}

export interface ProjectContext {
    readonly projectRoot: string
    readonly cwd: string
    readonly env?: Readonly<Record<string, string | undefined>>
}

export type ToolResult = string | Record<string, unknown>

export type ToolEvent =
    | ProgressEvent
    | LogEvent
    | FileChangedEvent
    | CommandOutputEvent

export interface ProgressEvent {
    readonly type: 'progress'
    readonly message: string
    readonly percent?: number
}

export interface LogEvent {
    readonly type: 'log'
    readonly level: 'debug' | 'info' | 'warn' | 'error'
    readonly message: string
}

export interface FileChangedEvent {
    readonly type: 'file_changed'
    readonly path: string
    readonly action: 'created' | 'modified' | 'deleted'
}

export interface CommandOutputEvent {
    readonly type: 'command_output'
    readonly stream: 'stdout' | 'stderr'
    readonly data: string
}

export interface LLMToolDefinition {
    readonly name: string
    readonly description: string
    readonly input_schema: JsonSchema
}

export function defineTool<TInput>(
    definition: ToolDefinition<TInput>
): ToolDefinition<TInput> {
    return definition
}

export function toolToLLMFormat(tool: ToolDefinition): LLMToolDefinition {
    return {
        name: tool.name,
        description: tool.description,
        input_schema: tool.inputSchema,
    }
}
