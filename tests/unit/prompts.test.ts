/**
 * Prompts Module Tests
 * 
 * Tests for prompt generation, storage, and adaptation.
 */

import { describe, it, expect, beforeEach, afterEach } from 'bun:test'
import { mkdir, rm, readdir } from 'fs/promises'
import { join } from 'path'
import { PromptStorage, createPromptStorage } from '@/prompts/storage'
import { adaptPromptToAgent, createAgentFromPrompt } from '@/prompts/adapter'
import { AVAILABLE_TOOLS } from '@/prompts/types'
import type { GeneratedPrompt } from '@/prompts/types'

// Mock generated prompt for testing
const mockPrompt: GeneratedPrompt = {
    id: 'test-agent-abc123',
    name: 'Test Agent',
    originalRequest: 'Create a test agent',
    systemPrompt: 'You are a helpful test agent.',
    suggestedTools: ['read_files', 'write_file'],
    description: 'A test agent for unit testing',
    exampleTasks: ['Task 1', 'Task 2'],
    metadata: {
        generatedAt: '2024-01-01T00:00:00.000Z',
        model: 'claude-sonnet-4-20250514',
        cost: 0.001,
        tokensUsed: 500,
    },
}

describe('PromptStorage', () => {
    const testDir = join(process.cwd(), '.test-prompts-temp')
    let storage: PromptStorage

    beforeEach(async () => {
        await mkdir(testDir, { recursive: true })
        storage = createPromptStorage({ projectRoot: testDir })
    })

    afterEach(async () => {
        await rm(testDir, { recursive: true, force: true })
    })

    it('should save and load a prompt', async () => {
        const filepath = await storage.save(mockPrompt)
        
        expect(filepath).toContain('test-agent-abc123.json')
        
        const loaded = await storage.load(mockPrompt.id)
        
        expect(loaded.id).toBe(mockPrompt.id)
        expect(loaded.name).toBe(mockPrompt.name)
        expect(loaded.systemPrompt).toBe(mockPrompt.systemPrompt)
        expect(loaded.suggestedTools).toEqual(mockPrompt.suggestedTools)
    })

    it('should list all prompts', async () => {
        await storage.save(mockPrompt)
        
        const secondPrompt: GeneratedPrompt = {
            ...mockPrompt,
            id: 'second-agent-xyz789',
            name: 'Second Agent',
            metadata: {
                ...mockPrompt.metadata,
                generatedAt: '2024-01-02T00:00:00.000Z',
            },
        }
        await storage.save(secondPrompt)

        const prompts = await storage.list()
        
        expect(prompts.length).toBe(2)
        // Should be sorted by date descending (newest first)
        expect(prompts[0].id).toBe('second-agent-xyz789')
        expect(prompts[1].id).toBe('test-agent-abc123')
    })

    it('should check if prompt exists', async () => {
        expect(await storage.exists(mockPrompt.id)).toBe(false)
        
        await storage.save(mockPrompt)
        
        expect(await storage.exists(mockPrompt.id)).toBe(true)
    })

    it('should delete a prompt', async () => {
        await storage.save(mockPrompt)
        expect(await storage.exists(mockPrompt.id)).toBe(true)
        
        await storage.delete(mockPrompt.id)
        
        expect(await storage.exists(mockPrompt.id)).toBe(false)
    })

    it('should return empty list when no prompts exist', async () => {
        const prompts = await storage.list()
        expect(prompts).toEqual([])
    })
})

describe('adaptPromptToAgent', () => {
    it('should convert prompt to agent definition', () => {
        const agent = adaptPromptToAgent(mockPrompt)

        expect(agent.id).toBe(mockPrompt.id)
        expect(agent.displayName).toBe(mockPrompt.name)
        expect(agent.model).toBe('anthropic/claude-sonnet-4-20250514')
        expect(agent.systemPrompt).toContain(mockPrompt.systemPrompt)
    })

    it('should include suggested tools plus set_output and end_turn', () => {
        const agent = adaptPromptToAgent(mockPrompt)

        expect(agent.tools).toContain('read_files')
        expect(agent.tools).toContain('write_file')
        expect(agent.tools).toContain('set_output')
        expect(agent.tools).toContain('end_turn')
    })

    it('should allow overriding the model', () => {
        const agent = adaptPromptToAgent(mockPrompt, {
            model: 'openai/gpt-4',
        })

        expect(agent.model).toBe('openai/gpt-4')
    })

    it('should allow adding additional tools', () => {
        const agent = adaptPromptToAgent(mockPrompt, {
            additionalTools: ['grep_search', 'run_terminal_command'],
        })

        expect(agent.tools).toContain('read_files')
        expect(agent.tools).toContain('grep_search')
        expect(agent.tools).toContain('run_terminal_command')
    })

    it('should allow overriding tools entirely', () => {
        const agent = adaptPromptToAgent(mockPrompt, {
            overrideTools: ['web_search'],
        })

        expect(agent.tools).toContain('web_search')
        expect(agent.tools).toContain('set_output')
        expect(agent.tools).toContain('end_turn')
        expect(agent.tools).not.toContain('read_files')
    })

    it('should not duplicate set_output if already in suggested tools', () => {
        const promptWithSetOutput: GeneratedPrompt = {
            ...mockPrompt,
            suggestedTools: ['read_files', 'set_output'],
        }

        const agent = adaptPromptToAgent(promptWithSetOutput)
        const setOutputCount = agent.tools?.filter(t => t === 'set_output').length

        expect(setOutputCount).toBe(1)
    })

    it('should include example tasks in system prompt', () => {
        const agent = adaptPromptToAgent(mockPrompt)

        expect(agent.systemPrompt).toContain('Example Tasks')
        expect(agent.systemPrompt).toContain('Task 1')
        expect(agent.systemPrompt).toContain('Task 2')
    })

    it('should set setOutputEndsRun by default', () => {
        const agent = adaptPromptToAgent(mockPrompt)
        expect(agent.setOutputEndsRun).toBe(true)
    })

    it('should allow disabling setOutputEndsRun', () => {
        const agent = adaptPromptToAgent(mockPrompt, {
            setOutputEndsRun: false,
        })
        expect(agent.setOutputEndsRun).toBe(false)
    })
})

describe('createAgentFromPrompt', () => {
    it('should be an alias for adaptPromptToAgent', () => {
        const agent1 = adaptPromptToAgent(mockPrompt)
        const agent2 = createAgentFromPrompt(mockPrompt)

        expect(agent1.id).toBe(agent2.id)
        expect(agent1.displayName).toBe(agent2.displayName)
        expect(agent1.model).toBe(agent2.model)
    })
})

describe('AVAILABLE_TOOLS', () => {
    it('should contain expected tools', () => {
        expect(AVAILABLE_TOOLS).toContain('read_files')
        expect(AVAILABLE_TOOLS).toContain('write_file')
        expect(AVAILABLE_TOOLS).toContain('str_replace')
        expect(AVAILABLE_TOOLS).toContain('run_terminal_command')
        expect(AVAILABLE_TOOLS).toContain('web_search')
        expect(AVAILABLE_TOOLS).toContain('spawn_agents')
        expect(AVAILABLE_TOOLS).toContain('set_output')
        expect(AVAILABLE_TOOLS).toContain('end_turn')
    })

    it('should have exactly 11 tools', () => {
        expect(AVAILABLE_TOOLS.length).toBe(11)
    })
})
