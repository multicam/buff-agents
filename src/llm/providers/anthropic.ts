/**
 * Anthropic Provider
 * 
 * Primary LLM provider using the Anthropic SDK.
 */

import Anthropic from '@anthropic-ai/sdk'
import type { Message, ToolCall } from '../../core/types'
import type {
    LLMProvider,
    LLMProviderConfig,
    CompletionRequest,
    CompletionResponse,
    StreamChunk,
    FinishReason,
} from '../types'

export class AnthropicProvider implements LLMProvider {
    readonly name = 'anthropic'
    readonly supportedModels = [/^anthropic\//]

    private client: Anthropic

    constructor(config: LLMProviderConfig) {
        this.client = new Anthropic({
            apiKey: config.apiKey,
            baseURL: config.baseUrl,
        })
    }

    supportsModel(model: string): boolean {
        return this.supportedModels.some(re => re.test(model))
    }

    async complete(request: CompletionRequest): Promise<CompletionResponse> {
        const response = await this.client.messages.create({
            model: this.extractModelName(request.model),
            messages: this.convertMessages(request.messages),
            tools: request.tools?.map(t => this.convertTool(t)),
            max_tokens: request.maxTokens ?? 4096,
            temperature: request.temperature,
            stop_sequences: request.stopSequences as string[] | undefined,
        })

        return this.convertResponse(response)
    }

    async *stream(request: CompletionRequest): AsyncIterable<StreamChunk> {
        const stream = this.client.messages.stream({
            model: this.extractModelName(request.model),
            messages: this.convertMessages(request.messages),
            tools: request.tools?.map(t => this.convertTool(t)),
            max_tokens: request.maxTokens ?? 4096,
            temperature: request.temperature,
            stop_sequences: request.stopSequences as string[] | undefined,
        })

        const toolCalls = new Map<number, { id: string; name: string; input: string }>()

        for await (const event of stream) {
            if (event.type === 'content_block_start') {
                if (event.content_block.type === 'tool_use') {
                    const block = event.content_block
                    toolCalls.set(event.index, {
                        id: block.id,
                        name: block.name,
                        input: '',
                    })
                    yield {
                        type: 'tool_call_start',
                        toolCallId: block.id,
                        toolName: block.name,
                    }
                }
            } else if (event.type === 'content_block_delta') {
                if (event.delta.type === 'text_delta') {
                    yield {
                        type: 'text',
                        content: event.delta.text,
                    }
                } else if (event.delta.type === 'input_json_delta') {
                    const toolCall = toolCalls.get(event.index)
                    if (toolCall) {
                        toolCall.input += event.delta.partial_json
                        yield {
                            type: 'tool_call_delta',
                            toolCallId: toolCall.id,
                            inputDelta: event.delta.partial_json,
                        }
                    }
                }
            } else if (event.type === 'content_block_stop') {
                const toolCall = toolCalls.get(event.index)
                if (toolCall) {
                    let parsedInput: Record<string, unknown> = {}
                    try {
                        parsedInput = JSON.parse(toolCall.input || '{}')
                    } catch {
                        // Keep empty object if parse fails
                    }
                    yield {
                        type: 'tool_call_end',
                        toolCall: {
                            toolCallId: toolCall.id,
                            toolName: toolCall.name,
                            input: parsedInput,
                        },
                    }
                }
            } else if (event.type === 'message_delta') {
                if (event.usage) {
                    yield {
                        type: 'usage',
                        usage: {
                            promptTokens: 0,
                            completionTokens: event.usage.output_tokens,
                            totalTokens: event.usage.output_tokens,
                        },
                    }
                }
            } else if (event.type === 'message_stop') {
                yield {
                    type: 'done',
                    finishReason: 'stop',
                }
            }
        }

        const finalMessage = await stream.finalMessage()
        yield {
            type: 'usage',
            usage: {
                promptTokens: finalMessage.usage.input_tokens,
                completionTokens: finalMessage.usage.output_tokens,
                totalTokens: finalMessage.usage.input_tokens + finalMessage.usage.output_tokens,
            },
        }

        yield {
            type: 'done',
            finishReason: this.convertStopReason(finalMessage.stop_reason),
        }
    }

    private extractModelName(model: string): string {
        return model.replace('anthropic/', '')
    }

    private convertMessages(messages: readonly Message[]): Anthropic.MessageParam[] {
        const result: Anthropic.MessageParam[] = []

        for (const msg of messages) {
            if (msg.role === 'system') {
                continue
            }

            if (msg.role === 'user') {
                const content = typeof msg.content === 'string'
                    ? msg.content
                    : msg.content.map(part => {
                          if (part.type === 'text') {
                              return { type: 'text' as const, text: part.text }
                          }
                          if (part.type === 'image') {
                              return {
                                  type: 'image' as const,
                                  source: {
                                      type: 'url' as const,
                                      url: part.url,
                                  },
                              }
                          }
                          return { type: 'text' as const, text: '' }
                      })
                result.push({ role: 'user', content: content as any })
            } else if (msg.role === 'assistant') {
                const content: Array<{ type: 'text'; text: string } | { type: 'tool_use'; id: string; name: string; input: Record<string, unknown> }> = []

                if (msg.content) {
                    content.push({ type: 'text', text: msg.content })
                }

                if (msg.toolCalls) {
                    for (const tc of msg.toolCalls) {
                        content.push({
                            type: 'tool_use',
                            id: tc.toolCallId,
                            name: tc.toolName,
                            input: tc.input as Record<string, unknown>,
                        })
                    }
                }

                result.push({ role: 'assistant', content: content as any })
            } else if (msg.role === 'tool') {
                const toolContent = typeof msg.content === 'string'
                    ? msg.content
                    : JSON.stringify(msg.content)

                result.push({
                    role: 'user',
                    content: [{
                        type: 'tool_result',
                        tool_use_id: msg.toolCallId,
                        content: toolContent,
                    }],
                })
            }
        }

        return result
    }

    private convertTool(tool: { name: string; description: string; input_schema: unknown }): Anthropic.Tool {
        return {
            name: tool.name,
            description: tool.description,
            input_schema: tool.input_schema as Anthropic.Tool.InputSchema,
        }
    }

    private convertResponse(response: Anthropic.Message): CompletionResponse {
        let content = ''
        const toolCalls: ToolCall[] = []

        for (const block of response.content) {
            if (block.type === 'text') {
                content += block.text
            } else if (block.type === 'tool_use') {
                toolCalls.push({
                    toolCallId: block.id,
                    toolName: block.name,
                    input: block.input as Record<string, unknown>,
                })
            }
        }

        return {
            content,
            toolCalls: toolCalls.length > 0 ? toolCalls : undefined,
            usage: {
                promptTokens: response.usage.input_tokens,
                completionTokens: response.usage.output_tokens,
                totalTokens: response.usage.input_tokens + response.usage.output_tokens,
            },
            finishReason: this.convertStopReason(response.stop_reason),
        }
    }

    private convertStopReason(reason: string | null): FinishReason {
        switch (reason) {
            case 'end_turn':
            case 'stop_sequence':
                return 'stop'
            case 'tool_use':
                return 'tool_calls'
            case 'max_tokens':
                return 'length'
            default:
                return 'stop'
        }
    }
}

export function createAnthropicProvider(config: LLMProviderConfig): AnthropicProvider {
    return new AnthropicProvider(config)
}
