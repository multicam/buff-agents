/**
 * Perplexity Provider
 * 
 * LLM provider for Perplexity's models using OpenAI-compatible API.
 * Perplexity models are optimized for web search and real-time information retrieval.
 */

import OpenAI from 'openai'
import type { Message } from '@/core'
import type {
    LLMProvider,
    LLMProviderConfig,
    CompletionRequest,
    CompletionResponse,
    StreamChunk,
    FinishReason,
} from '@/llm'

export class PerplexityProvider implements LLMProvider {
    readonly name = 'perplexity'
    readonly supportedModels = [/^perplexity\//]

    private client: OpenAI

    constructor(config: LLMProviderConfig) {
        this.client = new OpenAI({
            apiKey: config.apiKey,
            baseURL: config.baseUrl ?? 'https://api.perplexity.ai',
        })
    }

    supportsModel(model: string): boolean {
        return this.supportedModels.some(re => re.test(model))
    }

    async complete(request: CompletionRequest): Promise<CompletionResponse> {
        const response = await this.client.chat.completions.create({
            model: this.extractModelName(request.model),
            messages: this.convertMessages(request.messages),
            max_tokens: request.maxTokens ?? 4096,
            temperature: request.temperature,
        })

        return this.convertResponse(response)
    }

    async *stream(request: CompletionRequest): AsyncIterable<StreamChunk> {
        const stream = await this.client.chat.completions.create({
            model: this.extractModelName(request.model),
            messages: this.convertMessages(request.messages),
            max_tokens: request.maxTokens ?? 4096,
            temperature: request.temperature,
            stream: true,
        })

        let finishReason: FinishReason = 'stop'

        for await (const chunk of stream) {
            const delta = chunk.choices[0]?.delta

            if (delta?.content) {
                yield {
                    type: 'text',
                    content: delta.content,
                }
            }

            if (chunk.choices[0]?.finish_reason) {
                finishReason = this.convertFinishReason(chunk.choices[0].finish_reason)
            }
        }

        yield {
            type: 'done',
            finishReason,
        }
    }

    private extractModelName(model: string): string {
        return model.replace('perplexity/', '')
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
                          return { type: 'text' as const, text: '' }
                      })
                result.push({ role: 'user', content: content as any })
            } else if (msg.role === 'assistant') {
                result.push({
                    role: 'assistant',
                    content: msg.content || null,
                })
            } else if (msg.role === 'tool') {
                const toolContent = typeof msg.content === 'string'
                    ? msg.content
                    : JSON.stringify(msg.content)

                result.push({
                    role: 'user',
                    content: `Tool result: ${toolContent}`,
                })
            }
        }

        return result
    }

    private convertResponse(response: OpenAI.ChatCompletion): CompletionResponse {
        const choice = response.choices[0]
        const message = choice?.message

        return {
            content: message?.content ?? '',
            toolCalls: undefined,
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
            case 'length':
                return 'length'
            default:
                return 'stop'
        }
    }
}

export function createPerplexityProvider(config: LLMProviderConfig): PerplexityProvider {
    return new PerplexityProvider(config)
}
