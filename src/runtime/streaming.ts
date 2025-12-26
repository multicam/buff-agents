/**
 * Streaming Runtime
 * 
 * Real-time streaming of agent responses and events.
 */

import type { RuntimeEvent } from './events'

export interface RuntimeStreamChunk {
    readonly type: 'text' | 'tool_call' | 'tool_result' | 'event' | 'done' | 'error'
    readonly data: unknown
    readonly timestamp: number
}

export interface RuntimeTextChunk extends RuntimeStreamChunk {
    readonly type: 'text'
    readonly data: {
        readonly text: string
        readonly accumulated: string
    }
}

export interface RuntimeToolCallChunk extends RuntimeStreamChunk {
    readonly type: 'tool_call'
    readonly data: {
        readonly toolName: string
        readonly toolCallId: string
        readonly input: unknown
    }
}

export interface RuntimeToolResultChunk extends RuntimeStreamChunk {
    readonly type: 'tool_result'
    readonly data: {
        readonly toolCallId: string
        readonly result: unknown
        readonly duration: number
    }
}

export interface RuntimeEventChunk extends RuntimeStreamChunk {
    readonly type: 'event'
    readonly data: RuntimeEvent
}

export interface RuntimeDoneChunk extends RuntimeStreamChunk {
    readonly type: 'done'
    readonly data: {
        readonly output: unknown
        readonly totalSteps: number
        readonly totalTokens: { prompt: number; completion: number }
        readonly totalCost: number
    }
}

export interface RuntimeErrorChunk extends RuntimeStreamChunk {
    readonly type: 'error'
    readonly data: {
        readonly message: string
        readonly code?: string
        readonly recoverable: boolean
    }
}

export type AnyRuntimeStreamChunk = RuntimeTextChunk | RuntimeToolCallChunk | RuntimeToolResultChunk | RuntimeEventChunk | RuntimeDoneChunk | RuntimeErrorChunk

export interface StreamController {
    push(chunk: AnyRuntimeStreamChunk): void
    close(): void
    error(err: Error): void
}

export function createStreamController(): {
    controller: StreamController
    stream: AsyncIterable<AnyRuntimeStreamChunk>
} {
    const queue: AnyRuntimeStreamChunk[] = []
    let resolve: ((value: IteratorResult<AnyRuntimeStreamChunk>) => void) | null = null
    let closed = false
    let error: Error | null = null

    const controller: StreamController = {
        push(chunk: AnyRuntimeStreamChunk) {
            if (closed) return
            
            if (resolve) {
                resolve({ value: chunk, done: false })
                resolve = null
            } else {
                queue.push(chunk)
            }
        },

        close() {
            closed = true
            if (resolve) {
                resolve({ value: undefined as any, done: true })
                resolve = null
            }
        },

        error(err: Error) {
            error = err
            closed = true
            if (resolve) {
                resolve({ value: undefined as any, done: true })
                resolve = null
            }
        },
    }

    const stream: AsyncIterable<AnyRuntimeStreamChunk> = {
        [Symbol.asyncIterator]() {
            return {
                async next(): Promise<IteratorResult<AnyRuntimeStreamChunk>> {
                    if (error) {
                        throw error
                    }

                    if (queue.length > 0) {
                        return { value: queue.shift()!, done: false }
                    }

                    if (closed) {
                        return { value: undefined as any, done: true }
                    }

                    return new Promise(res => {
                        resolve = res
                    })
                },
            }
        },
    }

    return { controller, stream }
}

/**
 * Convert stream to Server-Sent Events format
 */
export function streamToSSE(stream: AsyncIterable<AnyRuntimeStreamChunk>): ReadableStream<Uint8Array> {
    const encoder = new TextEncoder()

    return new ReadableStream({
        async start(controller) {
            try {
                for await (const chunk of stream) {
                    const data = JSON.stringify(chunk)
                    const event = `data: ${data}\n\n`
                    controller.enqueue(encoder.encode(event))
                }
                controller.close()
            } catch (err) {
                controller.error(err)
            }
        },
    })
}

/**
 * Parse SSE stream back to chunks
 */
export async function* parseSSE(stream: ReadableStream<Uint8Array>): AsyncIterable<AnyRuntimeStreamChunk> {
    const decoder = new TextDecoder()
    const reader = stream.getReader()
    let buffer = ''

    try {
        while (true) {
            const { done, value } = await reader.read()
            if (done) break

            buffer += decoder.decode(value, { stream: true })
            const lines = buffer.split('\n\n')
            buffer = lines.pop() ?? ''

            for (const line of lines) {
                if (line.startsWith('data: ')) {
                    const data = line.slice(6)
                    try {
                        yield JSON.parse(data) as AnyRuntimeStreamChunk
                    } catch {
                        // Skip invalid JSON
                    }
                }
            }
        }
    } finally {
        reader.releaseLock()
    }
}

/**
 * Collect all text from a stream
 */
export async function collectStreamText(stream: AsyncIterable<AnyRuntimeStreamChunk>): Promise<string> {
    let text = ''
    for await (const chunk of stream) {
        if (chunk.type === 'text') {
            text = (chunk as RuntimeTextChunk).data.accumulated
        }
    }
    return text
}

/**
 * Create stream event helpers
 */
export function createStreamEvents(controller: StreamController) {
    return {
        text(text: string, accumulated: string) {
            controller.push({
                type: 'text',
                data: { text, accumulated },
                timestamp: Date.now(),
            })
        },

        toolCall(toolName: string, toolCallId: string, input: unknown) {
            controller.push({
                type: 'tool_call',
                data: { toolName, toolCallId, input },
                timestamp: Date.now(),
            })
        },

        toolResult(toolCallId: string, result: unknown, duration: number) {
            controller.push({
                type: 'tool_result',
                data: { toolCallId, result, duration },
                timestamp: Date.now(),
            })
        },

        event(event: RuntimeEvent) {
            controller.push({
                type: 'event',
                data: event,
                timestamp: Date.now(),
            })
        },

        done(output: unknown, totalSteps: number, totalTokens: { prompt: number; completion: number }, totalCost: number) {
            controller.push({
                type: 'done',
                data: { output, totalSteps, totalTokens, totalCost },
                timestamp: Date.now(),
            })
            controller.close()
        },

        error(message: string, code?: string, recoverable = false) {
            controller.push({
                type: 'error',
                data: { message, code, recoverable },
                timestamp: Date.now(),
            })
        },
    }
}
