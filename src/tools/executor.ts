/**
 * Tool Executor
 * 
 * Executes tool calls with parallel/sequential handling based on tool requirements.
 * Returns errors as results (retry with feedback pattern).
 */

import type { ToolCall, ToolMessage } from '@/core'
import { toolMessage } from '@/core'
import type { AgentState } from '@/core'
import type { Logger } from '@/utils'
import type { ToolRegistry } from './registry'
import type { ToolDefinition, ToolEvent, ToolExecutionContext, ToolResult, ProjectContext } from './types'

export interface ExecuteToolsOptions {
    readonly toolCalls: readonly ToolCall[]
    readonly registry: ToolRegistry
    readonly agentState: Readonly<AgentState>
    readonly projectContext: ProjectContext
    readonly logger: Logger
    readonly signal: AbortSignal
    readonly onResult?: (toolCallId: string, result: ToolResult) => void
    readonly onEvent?: (event: ToolEvent) => void
}

export async function executeTools(options: ExecuteToolsOptions): Promise<ToolMessage[]> {
    const {
        toolCalls,
        registry,
        agentState,
        projectContext,
        logger,
        signal,
        onResult,
        onEvent,
    } = options

    const sequentialTools = registry.getSequentialTools()

    const sequential: ToolCall[] = []
    const parallel: ToolCall[] = []

    for (const call of toolCalls) {
        if (sequentialTools.has(call.toolName)) {
            sequential.push(call)
        } else {
            parallel.push(call)
        }
    }

    const results: ToolMessage[] = []

    if (parallel.length > 0) {
        const parallelResults = await Promise.all(
            parallel.map(call =>
                executeToolCall({
                    toolCall: call,
                    registry,
                    agentState,
                    projectContext,
                    logger,
                    signal,
                    onEvent,
                })
            )
        )

        for (let i = 0; i < parallel.length; i++) {
            const result = parallelResults[i]
            onResult?.(parallel[i].toolCallId, result)
            results.push(createToolMessage(parallel[i], result))
        }
    }

    for (const call of sequential) {
        if (signal.aborted) break

        const result = await executeToolCall({
            toolCall: call,
            registry,
            agentState,
            projectContext,
            logger,
            signal,
            onEvent,
        })

        onResult?.(call.toolCallId, result)
        results.push(createToolMessage(call, result))
    }

    return results
}

interface ExecuteToolCallOptions {
    readonly toolCall: ToolCall
    readonly registry: ToolRegistry
    readonly agentState: Readonly<AgentState>
    readonly projectContext: ProjectContext
    readonly logger: Logger
    readonly signal: AbortSignal
    readonly onEvent?: (event: ToolEvent) => void
}

async function executeToolCall(options: ExecuteToolCallOptions): Promise<ToolResult> {
    const { toolCall, registry, agentState, projectContext, logger, signal, onEvent } = options

    const tool = registry.get(toolCall.toolName)
    if (!tool) {
        return { error: `Unknown tool: ${toolCall.toolName}` }
    }

    const context: ToolExecutionContext<unknown> = {
        input: toolCall.input,
        toolCallId: toolCall.toolCallId,
        agentState,
        projectContext,
        logger: logger.child({ tool: toolCall.toolName, toolCallId: toolCall.toolCallId }),
        signal,
        emit: onEvent ?? (() => {}),
    }

    try {
        return await tool.execute(context)
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error)
        logger.error({ error, toolCall }, `Tool execution failed: ${errorMessage}`)
        return { error: errorMessage }
    }
}

function createToolMessage(toolCall: ToolCall, result: ToolResult): ToolMessage {
    const content = typeof result === 'string'
        ? result
        : JSON.stringify(result)

    return toolMessage(toolCall.toolName, toolCall.toolCallId, content)
}

export async function executeSingleTool<TInput>(
    tool: ToolDefinition<TInput>,
    input: TInput,
    options: Omit<ExecuteToolCallOptions, 'toolCall' | 'registry'>
): Promise<ToolResult> {
    const context: ToolExecutionContext<TInput> = {
        input,
        toolCallId: crypto.randomUUID(),
        agentState: options.agentState,
        projectContext: options.projectContext,
        logger: options.logger.child({ tool: tool.name }),
        signal: options.signal,
        emit: options.onEvent ?? (() => {}),
    }

    try {
        return await tool.execute(context)
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error)
        return { error: errorMessage }
    }
}
