/**
 * Tool Registry
 * 
 * Manages tool definitions and provides lookup/conversion utilities.
 */

import type { ToolDefinition, LLMToolDefinition } from './types'
import { toolToLLMFormat } from './types'

export class ToolRegistry {
    private tools = new Map<string, ToolDefinition>()

    register<TInput>(tool: ToolDefinition<TInput>): void {
        this.tools.set(tool.name, tool as ToolDefinition)
    }

    registerAll(tools: ToolDefinition[]): void {
        for (const tool of tools) {
            this.register(tool)
        }
    }

    get(name: string): ToolDefinition | undefined {
        return this.tools.get(name)
    }

    has(name: string): boolean {
        return this.tools.has(name)
    }

    list(): ToolDefinition[] {
        return Array.from(this.tools.values())
    }

    names(): string[] {
        return Array.from(this.tools.keys())
    }

    getForAgent(toolNames: readonly string[]): Map<string, ToolDefinition> {
        const result = new Map<string, ToolDefinition>()
        for (const name of toolNames) {
            const tool = this.tools.get(name)
            if (tool) {
                result.set(name, tool)
            }
        }
        return result
    }

    toLLMFormat(toolNames: readonly string[]): LLMToolDefinition[] {
        return toolNames
            .map(name => this.tools.get(name))
            .filter((tool): tool is ToolDefinition => tool !== undefined)
            .map(toolToLLMFormat)
    }

    getSequentialTools(): Set<string> {
        return new Set(
            Array.from(this.tools.values())
                .filter(t => t.requiresSequential)
                .map(t => t.name)
        )
    }

    getEndTurnTools(): Set<string> {
        return new Set(
            Array.from(this.tools.values())
                .filter(t => t.endsAgentStep)
                .map(t => t.name)
        )
    }
}

export function createToolRegistry(): ToolRegistry {
    return new ToolRegistry()
}
