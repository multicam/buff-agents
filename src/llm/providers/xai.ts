/**
 * xAI Provider
 * 
 * LLM provider for xAI's Grok models using OpenAI-compatible API.
 */

import OpenAI from 'openai'
import type { Message, ToolCall } from '@/core'
import type {
    LLMProvider,
    LLMProviderConfig,
    CompletionRequest,
    CompletionResponse,
    StreamChunk,
    FinishReason,
} from '../types'

export class XAIProvider implements LLMProvider {
    readonly name = 'xai'
    readonly supportedModels = [/^xai\//]

    private client: OpenAI

    constructor(config: LLMProviderConfig) {
        this.client = new OpenAI({
            apiKey: config.apiKey,
            baseURL: config.baseUrl ?? 'https://api.x.ai/v1',
        })
    }

    supportsModel(model: string): boolean {
        return this.supportedModels.some(re => re.test(model))
    }

    async complete(request: CompletionRequest): Promise<CompletionResponse> {
        const response = await this.client.chat.completions.create({
            model: this.extractModelName(request.model),
            messages: this.convertMessages(request.messages),
            tools: request.tools?.map(t => this.convertTool(t)),
            max_tokens: request.maxTokens ?? 4096,
            temperature: request.temperature,
            stop: request.stopSequences as string[] | undefined,
        })

        return this.convertResponse(response)
    }

    async *stream(request: CompletionRequest): AsyncIterable<StreamChunk> {
        const stream = await this.client.chat.completions.create({
            model: this.extractModelName(request.model),
            messages: this.convertMessages(request.messages),
            tools: request.tools?.map(t => this.convertTool(t)),
            max_tokens: request.maxTokens ?? 4096,
            temperature: request.temperature,
            stop: request.stopSequences as string[] | undefined,
            stream: true,
        })

        const toolCalls = new Map<number, { id: string; name: string; arguments: string }>()
        let finishReason: FinishReason = 'stop'

        for await (const chunk of stream) {
            const delta = chunk.choices[0]?.delta

            if (delta?.content) {
                yield {
                    type: 'text',
                    content: delta.content,
                }
            }

            if (delta?.tool_calls) {
                for (const tc of delta.tool_calls) {
                    if (tc.id) {
                        toolCalls.set(tc.index, {
                            id: tc.id,
                            name: tc.function?.name ?? '',
                            arguments: tc.function?.arguments ?? '',
                        })
                        yield {
                            type: 'tool_call_start',
                            toolCallId: tc.id,
                            toolName: tc.function?.name ?? '',
                        }
                    } else if (tc.function?.arguments) {
                        const existing = toolCalls.get(tc.index)
                        if (existing) {
                            existing.arguments += tc.function.arguments
                            yield {
                                type: 'tool_call_delta',
                                toolCallId: existing.id,
                                inputDelta: tc.function.arguments,
                            }
                        }
                    }
                }
            }

            if (chunk.choices[0]?.finish_reason) {
                finishReason = this.convertFinishReason(chunk.choices[0].finish_reason)
            }
        }

        for (const [, tc] of toolCalls) {
            let parsedInput: Record<string, unknown> = {}
            try {
                parsedInput = JSON.parse(tc.arguments || '{}')
            } catch {
                // Keep empty object if parse fails
            }
            yield {
                type: 'tool_call_end',
                toolCall: {
                    toolCallId: tc.id,
                    toolName: tc.name,
                    input: parsedInput,
                },
            }
        }

        yield {
            type: 'done',
            finishReason,
        }
    }

    private extractModelName(model: string): string {
        return model.replace('xai/', '')
    }

    private convertMessages(messages: readonly Message[]): OpenAI.ChatCompletionMessageParam[] {
        const result: OpenAI.ChatCompletionMessageParam[] = []

        for (const msg of messages) {
            if (msg.role === 'system') {
                result.push({ role: 'system', content: msg.content })
            } else if (msg.role === 'user') {
                const content = typeof msg.content === 'string'
                    ? msg.content
                    : msg.content.map(part => {
                          if (part.type === 'text') {
                              return { type: 'text' as const, text: part.text }
                          }
                          if (part.type === 'image') {
                              return {
                                  type: 'image_url' as const,
                                  image_url: { url: part.url },
                              }
                          }
                          return { type: 'text' as const, text: '' }
                      })
                result.push({ role: 'user', content: content as any })
            } else if (msg.role === 'assistant') {
                const toolCalls = msg.toolCalls?.map(tc => ({
                    id: tc.toolCallId,
                    type: 'function' as const,
                    function: {
                        name: tc.toolName,
                        arguments: JSON.stringify(tc.input),
                    },
                }))

                result.push({
                    role: 'assistant',
                    content: msg.content || null,
                    tool_calls: toolCalls,
                })
            } else if (msg.role === 'tool') {
                const toolContent = typeof msg.content === 'string'
                    ? msg.content
                    : JSON.stringify(msg.content)

                result.push({
                    role: 'tool',
                    tool_call_id: msg.toolCallId,
                    content: toolContent,
                })
            }
        }

        return result
    }

    private convertTool(tool: { name: string; description: string; input_schema: unknown }): OpenAI.ChatCompletionTool {
        return {
            type: 'function',
            function: {
                name: tool.name,
                description: tool.description,
                parameters: tool.input_schema as Record<string, unknown>,
            },
        }
    }

    private convertResponse(response: OpenAI.ChatCompletion): CompletionResponse {
        const choice = response.choices[0]
        const message = choice?.message

        const toolCalls: ToolCall[] = message?.tool_calls?.map(tc => ({
            toolCallId: tc.id,
            toolName: tc.function.name,
            input: JSON.parse(tc.function.arguments || '{}'),
        })) ?? []

        return {
            content: message?.content ?? '',
            toolCalls: toolCalls.length > 0 ? toolCalls : undefined,
            usage: {
                promptTokens: response.usage?.prompt_tokens ?? 0,
                completionTokens: response.usage?.completion_tokens ?? 0,
                totalTokens: response.usage?.total_tokens ?? 0,
            },
            finishReason: this.convertFinishReason(choice?.finish_reason ?? 'stop'),
        }
    }

    private convertFinishReason(reason: string): FinishReason {
        switch (reason) {
            case 'stop':
                return 'stop'
            case 'tool_calls':
                return 'tool_calls'
            case 'length':
                return 'length'
            default:
                return 'stop'
        }
    }
}

export function createXAIProvider(config: LLMProviderConfig): XAIProvider {
    return new XAIProvider(config)
}
