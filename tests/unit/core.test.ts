/**
 * Core Types and Agent Builder Tests
 */

import { describe, it, expect } from 'bun:test'
import {
    createAgent,
    cloneAgent,
    createInitialState,
    updateState,
    addMessage,
    userMessage,
    assistantMessage,
    systemMessage,
} from '@/core'

describe('AgentBuilder', () => {
    it('should create a basic agent', () => {
        const agent = createAgent({
            id: 'test-agent',
            displayName: 'Test Agent',
            model: 'anthropic/claude-sonnet-4',
        }).build()

        expect(agent.id).toBe('test-agent')
        expect(agent.displayName).toBe('Test Agent')
        expect(agent.model).toBe('anthropic/claude-sonnet-4')
    })

    it('should add tools via builder', () => {
        const agent = createAgent({
            id: 'test-agent',
            displayName: 'Test Agent',
            model: 'anthropic/claude-sonnet-4',
        })
            .withTools('read_files', 'write_file')
            .build()

        expect(agent.tools).toEqual(['read_files', 'write_file'])
    })

    it('should add system prompt via builder', () => {
        const agent = createAgent({
            id: 'test-agent',
            displayName: 'Test Agent',
            model: 'anthropic/claude-sonnet-4',
        })
            .withSystemPrompt('You are a helpful assistant.')
            .build()

        expect(agent.systemPrompt).toBe('You are a helpful assistant.')
    })

    it('should clone agent with overrides', () => {
        const original = createAgent({
            id: 'original',
            displayName: 'Original',
            model: 'anthropic/claude-sonnet-4',
        })
            .withTools('read_files')
            .build()

        const cloned = cloneAgent(original, { id: 'cloned', displayName: 'Cloned' })

        expect(cloned.id).toBe('cloned')
        expect(cloned.displayName).toBe('Cloned')
        expect(cloned.model).toBe('anthropic/claude-sonnet-4')
        expect(cloned.tools).toEqual(['read_files'])
    })
})

describe('AgentState', () => {
    it('should create initial state', () => {
        const agent = createAgent({
            id: 'test-agent',
            displayName: 'Test',
            model: 'anthropic/claude-sonnet-4',
        }).build()

        const state = createInitialState(agent, {
            runId: 'run-123',
            maxSteps: 10,
        })

        expect(state.runId).toBe('run-123')
        expect(state.agentId).toBe('test-agent')
        expect(state.stepsRemaining).toBe(10)
        expect(state.messageHistory).toEqual([])
        expect(state.creditsUsed).toBe(0)
    })

    it('should update state immutably', () => {
        const agent = createAgent({
            id: 'test-agent',
            displayName: 'Test',
            model: 'anthropic/claude-sonnet-4',
        }).build()

        const state1 = createInitialState(agent, { runId: 'run-123' })
        const state2 = updateState(state1, { creditsUsed: 0.5 })

        expect(state1.creditsUsed).toBe(0)
        expect(state2.creditsUsed).toBe(0.5)
        expect(state1).not.toBe(state2)
    })

    it('should add messages immutably', () => {
        const agent = createAgent({
            id: 'test-agent',
            displayName: 'Test',
            model: 'anthropic/claude-sonnet-4',
        }).build()

        const state1 = createInitialState(agent, { runId: 'run-123' })
        const state2 = addMessage(state1, userMessage('Hello'))

        expect(state1.messageHistory.length).toBe(0)
        expect(state2.messageHistory.length).toBe(1)
        expect(state2.messageHistory[0].role).toBe('user')
    })
})

describe('Messages', () => {
    it('should create user message', () => {
        const msg = userMessage('Hello', { tags: ['TEST'] })

        expect(msg.role).toBe('user')
        expect(msg.content).toBe('Hello')
        expect(msg.tags).toEqual(['TEST'])
    })

    it('should create assistant message with tool calls', () => {
        const msg = assistantMessage('Thinking...', {
            toolCalls: [{
                toolCallId: 'tc-1',
                toolName: 'read_files',
                input: { paths: ['test.txt'] },
            }],
        })

        expect(msg.role).toBe('assistant')
        expect(msg.toolCalls?.length).toBe(1)
        expect(msg.toolCalls?.[0].toolName).toBe('read_files')
    })

    it('should create system message', () => {
        const msg = systemMessage('You are helpful.')

        expect(msg.role).toBe('system')
        expect(msg.content).toBe('You are helpful.')
    })
})
