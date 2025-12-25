/**
 * Tool Registry and Executor Tests
 */

import { describe, it, expect } from 'bun:test'
import { ToolRegistry } from '@/tools/registry'
import { defineTool } from '@/tools/types'
import { builtinTools } from '@/tools/builtin'

describe('ToolRegistry', () => {
    it('should register and retrieve tools', () => {
        const registry = new ToolRegistry()

        const testTool = defineTool({
            name: 'test_tool',
            description: 'A test tool',
            inputSchema: { type: 'object', properties: {} },
            execute: async () => ({ success: true }),
        })

        registry.register(testTool)

        expect(registry.has('test_tool')).toBe(true)
        expect(registry.get('test_tool')).toBe(testTool)
    })

    it('should list all tools', () => {
        const registry = new ToolRegistry()
        registry.registerAll(builtinTools)

        const names = registry.names()

        expect(names).toContain('read_files')
        expect(names).toContain('write_file')
        expect(names).toContain('str_replace')
        expect(names).toContain('run_terminal_command')
    })

    it('should convert to LLM format', () => {
        const registry = new ToolRegistry()
        registry.registerAll(builtinTools)

        const llmTools = registry.toLLMFormat(['read_files', 'write_file'])

        expect(llmTools.length).toBe(2)
        expect(llmTools[0].name).toBe('read_files')
        expect(llmTools[0].description).toBeDefined()
        expect(llmTools[0].input_schema).toBeDefined()
    })

    it('should identify sequential tools', () => {
        const registry = new ToolRegistry()
        registry.registerAll(builtinTools)

        const sequential = registry.getSequentialTools()

        expect(sequential.has('run_terminal_command')).toBe(true)
    })

    it('should identify end-turn tools', () => {
        const registry = new ToolRegistry()
        registry.registerAll(builtinTools)

        const endTurn = registry.getEndTurnTools()

        expect(endTurn.has('end_turn')).toBe(true)
    })
})

describe('Tool Definitions', () => {
    it('should have valid input schemas', () => {
        for (const tool of builtinTools) {
            expect(tool.name).toBeDefined()
            expect(tool.description).toBeDefined()
            expect(tool.inputSchema).toBeDefined()
            expect(tool.inputSchema.type).toBe('object')
            expect(tool.execute).toBeInstanceOf(Function)
        }
    })
})
