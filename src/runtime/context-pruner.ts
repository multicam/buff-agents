/**
 * Context Pruner
 * 
 * Smart context management that summarizes and prunes message history
 * to stay within token limits while preserving important information.
 */

import type { Message } from '@/core'
import type { LLMRegistry } from '@/llm'

export interface ContextPrunerConfig {
    readonly maxTokens: number
    readonly targetTokens: number  // Target after pruning (should be < maxTokens)
    readonly summaryModel?: string
    readonly preserveSystemPrompt?: boolean
    readonly preserveRecentMessages?: number
    readonly preserveTaggedMessages?: readonly string[]
}

export interface PruneResult {
    readonly messages: Message[]
    readonly pruned: boolean
    readonly originalTokens: number
    readonly finalTokens: number
    readonly summarizedCount: number
}

export class ContextPruner {
    private readonly config: ContextPrunerConfig
    private readonly llmRegistry?: LLMRegistry

    constructor(config: ContextPrunerConfig, llmRegistry?: LLMRegistry) {
        this.config = {
            preserveSystemPrompt: true,
            preserveRecentMessages: 4,
            preserveTaggedMessages: ['USER_PROMPT', 'INSTRUCTIONS_PROMPT'],
            ...config,
        }
        this.llmRegistry = llmRegistry
    }

    async prune(messages: readonly Message[]): Promise<PruneResult> {
        const originalTokens = this.estimateTotalTokens(messages)

        if (originalTokens <= this.config.maxTokens) {
            return {
                messages: [...messages],
                pruned: false,
                originalTokens,
                finalTokens: originalTokens,
                summarizedCount: 0,
            }
        }

        // Separate messages into categories
        const { preserved, prunable } = this.categorizeMessages(messages)

        // If we can fit everything by just removing prunable messages, do that
        const preservedTokens = this.estimateTotalTokens(preserved)
        if (preservedTokens <= this.config.targetTokens) {
            // Try to keep as many recent prunable messages as possible
            const result = this.keepRecentPrunable(preserved, prunable)
            return {
                messages: result,
                pruned: true,
                originalTokens,
                finalTokens: this.estimateTotalTokens(result),
                summarizedCount: prunable.length - (result.length - preserved.length),
            }
        }

        // Need to summarize - create a summary of old messages
        if (this.llmRegistry && this.config.summaryModel) {
            const summary = await this.summarizeMessages(prunable)
            const summaryMessage = this.createSummaryMessage(summary)
            
            const result = [...preserved.slice(0, 1), summaryMessage, ...preserved.slice(1)]
            return {
                messages: result,
                pruned: true,
                originalTokens,
                finalTokens: this.estimateTotalTokens(result),
                summarizedCount: prunable.length,
            }
        }

        // Fallback: just truncate
        const result = this.truncateToFit(preserved, prunable)
        return {
            messages: result,
            pruned: true,
            originalTokens,
            finalTokens: this.estimateTotalTokens(result),
            summarizedCount: messages.length - result.length,
        }
    }

    private categorizeMessages(messages: readonly Message[]): {
        preserved: Message[]
        prunable: Message[]
    } {
        const preserved: Message[] = []
        const prunable: Message[] = []
        const recentCount = this.config.preserveRecentMessages ?? 4
        const preserveTags = new Set(this.config.preserveTaggedMessages ?? [])

        for (let i = 0; i < messages.length; i++) {
            const msg = messages[i]
            const isRecent = i >= messages.length - recentCount

            // Always preserve system messages if configured
            if (msg.role === 'system' && this.config.preserveSystemPrompt) {
                preserved.push(msg)
                continue
            }

            // Preserve tagged messages
            if ('tags' in msg && msg.tags?.some(t => preserveTags.has(t))) {
                preserved.push(msg)
                continue
            }

            // Preserve messages marked as important
            if ('keepDuringTruncation' in msg && msg.keepDuringTruncation) {
                preserved.push(msg)
                continue
            }

            // Preserve recent messages
            if (isRecent) {
                preserved.push(msg)
                continue
            }

            prunable.push(msg)
        }

        return { preserved, prunable }
    }

    private keepRecentPrunable(preserved: Message[], prunable: Message[]): Message[] {
        const result = [...preserved]
        let currentTokens = this.estimateTotalTokens(result)

        // Add prunable messages from most recent to oldest
        for (let i = prunable.length - 1; i >= 0; i--) {
            const msg = prunable[i]
            const msgTokens = this.estimateMessageTokens(msg)

            if (currentTokens + msgTokens <= this.config.targetTokens) {
                result.push(msg)
                currentTokens += msgTokens
            }
        }

        // Sort by original order
        return this.sortByOriginalOrder(result, [...preserved, ...prunable])
    }

    private truncateToFit(preserved: Message[], prunable: Message[]): Message[] {
        const result = [...preserved]
        let currentTokens = this.estimateTotalTokens(result)

        // Add prunable messages from most recent
        for (let i = prunable.length - 1; i >= 0; i--) {
            const msg = prunable[i]
            const msgTokens = this.estimateMessageTokens(msg)

            if (currentTokens + msgTokens <= this.config.targetTokens) {
                result.push(msg)
                currentTokens += msgTokens
            }
        }

        return this.sortByOriginalOrder(result, [...preserved, ...prunable])
    }

    private async summarizeMessages(messages: Message[]): Promise<string> {
        if (!this.llmRegistry || !this.config.summaryModel) {
            return this.createBasicSummary(messages)
        }

        const provider = this.llmRegistry.getProvider(this.config.summaryModel)
        
        const summaryPrompt = `Summarize the following conversation history concisely, preserving key information about:
- What tasks were requested
- What actions were taken
- What files were modified
- Any important decisions or outcomes

Conversation:
${messages.map(m => `[${m.role}]: ${this.getMessageContent(m)}`).join('\n\n')}

Summary:`

        try {
            const response = await provider.complete({
                model: this.config.summaryModel,
                messages: [{ role: 'user', content: summaryPrompt }],
                maxTokens: 500,
            })

            return response.content || this.createBasicSummary(messages)
        } catch {
            return this.createBasicSummary(messages)
        }
    }

    private createBasicSummary(messages: Message[]): string {
        const toolCalls: string[] = []
        const userRequests: string[] = []

        for (const msg of messages) {
            if (msg.role === 'user') {
                const content = this.getMessageContent(msg)
                if (content.length > 0 && content.length < 200) {
                    userRequests.push(content)
                }
            }
            if (msg.role === 'assistant' && 'toolCalls' in msg && msg.toolCalls) {
                for (const tc of msg.toolCalls) {
                    toolCalls.push(tc.toolName)
                }
            }
        }

        const parts: string[] = []
        if (userRequests.length > 0) {
            parts.push(`User requests: ${userRequests.slice(0, 3).join('; ')}`)
        }
        if (toolCalls.length > 0) {
            const uniqueTools = [...new Set(toolCalls)]
            parts.push(`Tools used: ${uniqueTools.join(', ')}`)
        }

        return parts.join('\n') || 'Previous conversation context (summarized)'
    }

    private createSummaryMessage(summary: string): Message {
        return {
            role: 'user',
            content: `[Previous conversation summary]\n${summary}`,
            tags: ['CONTEXT_SUMMARY'],
        } as Message
    }

    private getMessageContent(msg: Message): string {
        if (msg.role === 'system' || msg.role === 'assistant') {
            return msg.content
        }
        if (msg.role === 'user') {
            return typeof msg.content === 'string'
                ? msg.content
                : msg.content.map(p => p.type === 'text' ? p.text : '').join('')
        }
        if (msg.role === 'tool') {
            return typeof msg.content === 'string'
                ? msg.content
                : JSON.stringify(msg.content)
        }
        return ''
    }

    private estimateMessageTokens(msg: Message): number {
        const content = this.getMessageContent(msg)
        return Math.ceil(content.length / 4) + 10 // +10 for message overhead
    }

    private estimateTotalTokens(messages: readonly Message[]): number {
        return messages.reduce((sum, msg) => sum + this.estimateMessageTokens(msg), 0)
    }

    private sortByOriginalOrder(subset: Message[], original: Message[]): Message[] {
        const orderMap = new Map<Message, number>()
        original.forEach((msg, idx) => orderMap.set(msg, idx))
        return subset.sort((a, b) => (orderMap.get(a) ?? 0) - (orderMap.get(b) ?? 0))
    }
}

export function createContextPruner(
    config: ContextPrunerConfig,
    llmRegistry?: LLMRegistry
): ContextPruner {
    return new ContextPruner(config, llmRegistry)
}
