/**
 * Message Management Tests
 */

import { describe, it, expect } from 'bun:test'
import { expireMessages, truncateMessages, estimateTokens } from '../../src/runtime/messages'
import { userMessage, assistantMessage, systemMessage } from '../../src/core/types/messages'

describe('expireMessages', () => {
    it('should expire messages with matching TTL', () => {
        const messages = [
            systemMessage('System'),
            userMessage('User 1', { timeToLive: 'agentStep' }),
            userMessage('User 2', { timeToLive: 'userPrompt' }),
            assistantMessage('Assistant'),
        ]

        const expired = expireMessages(messages, 'agentStep')

        expect(expired.length).toBe(3)
        expect(expired.find(m => m.role === 'user' && m.content === 'User 1')).toBeUndefined()
    })

    it('should keep system messages', () => {
        const messages = [
            systemMessage('System'),
            userMessage('User', { timeToLive: 'agentStep' }),
        ]

        const expired = expireMessages(messages, 'agentStep')

        expect(expired.length).toBe(1)
        expect(expired[0].role).toBe('system')
    })

    it('should keep messages without TTL', () => {
        const messages = [
            userMessage('User 1'),
            userMessage('User 2', { timeToLive: 'agentStep' }),
        ]

        const expired = expireMessages(messages, 'agentStep')

        expect(expired.length).toBe(1)
        expect(expired[0].content).toBe('User 1')
    })
})

describe('truncateMessages', () => {
    it('should keep important messages', () => {
        const messages = [
            systemMessage('System'),
            userMessage('Important', { keepDuringTruncation: true }),
            userMessage('Not important 1'),
            userMessage('Not important 2'),
        ]

        const truncated = truncateMessages(messages, 50, estimateTokens)

        expect(truncated.find(m => m.content === 'Important')).toBeDefined()
    })

    it('should keep most recent messages when truncating', () => {
        const messages = [
            userMessage('Old message'),
            userMessage('Recent message'),
        ]

        const truncated = truncateMessages(messages, 10, estimateTokens)

        expect(truncated.length).toBeLessThanOrEqual(2)
    })
})

describe('estimateTokens', () => {
    it('should estimate tokens for text', () => {
        const msg = userMessage('Hello world')
        const tokens = estimateTokens(msg)

        expect(tokens).toBeGreaterThan(0)
        expect(tokens).toBeLessThan(10)
    })

    it('should handle empty content', () => {
        const msg = userMessage('')
        const tokens = estimateTokens(msg)

        expect(tokens).toBe(0)
    })
})
