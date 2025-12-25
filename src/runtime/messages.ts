/**
 * Message Management
 * 
 * Smart truncation with TTL tags for context management.
 */

import type { Message, MessageTTL } from '@/core'

export function expireMessages(
    messages: readonly Message[],
    trigger: MessageTTL
): Message[] {
    return messages.filter(msg => {
        if (msg.role === 'system') return true
        if (!('timeToLive' in msg)) return true
        return msg.timeToLive !== trigger
    })
}

export function truncateMessages(
    messages: readonly Message[],
    maxTokens: number,
    tokenCounter: (msg: Message) => number
): Message[] {
    const important = messages.filter(msg => {
        if (msg.role === 'system') return true
        return 'keepDuringTruncation' in msg && msg.keepDuringTruncation
    })

    const removable = messages.filter(msg => {
        if (msg.role === 'system') return false
        return !('keepDuringTruncation' in msg) || !msg.keepDuringTruncation
    })

    let totalTokens = important.reduce((sum, m) => sum + tokenCounter(m), 0)
    const result: Message[] = [...important]

    for (let i = removable.length - 1; i >= 0; i--) {
        const tokens = tokenCounter(removable[i])
        if (totalTokens + tokens <= maxTokens) {
            result.push(removable[i])
            totalTokens += tokens
        }
    }

    return sortMessagesByOriginalOrder(messages, result)
}

function sortMessagesByOriginalOrder(
    original: readonly Message[],
    subset: Message[]
): Message[] {
    const orderMap = new Map<Message, number>()
    original.forEach((msg, idx) => orderMap.set(msg, idx))

    return subset.sort((a, b) => {
        const orderA = orderMap.get(a) ?? 0
        const orderB = orderMap.get(b) ?? 0
        return orderA - orderB
    })
}

export function estimateTokens(msg: Message): number {
    let text = ''

    if (msg.role === 'system' || msg.role === 'assistant') {
        text = msg.content
    } else if (msg.role === 'user') {
        text = typeof msg.content === 'string'
            ? msg.content
            : msg.content.map(p => p.type === 'text' ? p.text : '').join('')
    } else if (msg.role === 'tool') {
        text = typeof msg.content === 'string'
            ? msg.content
            : JSON.stringify(msg.content)
    }

    return Math.ceil(text.length / 4)
}

export function getSystemPrompt(messages: readonly Message[]): string | undefined {
    const systemMsg = messages.find(m => m.role === 'system')
    return systemMsg?.content
}
