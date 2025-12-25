/**
 * Agent Builder - Functional Composition Pattern
 * 
 * Create agents using a fluent builder API:
 * 
 * const editor = createAgent({
 *     id: 'editor',
 *     displayName: 'Code Editor',
 *     model: 'anthropic/claude-sonnet-4',
 * })
 *     .withTools('read_files', 'write_file', 'str_replace')
 *     .withSystemPrompt('You are a code editor...')
 *     .build()
 */

import type {
    AgentDefinition,
    AgentStepHandler,
    InputSchema,
    JsonSchema,
    ModelIdentifier,
    OutputMode,
} from '@/core/types'

export interface AgentBase {
    id: string
    displayName: string
    model: ModelIdentifier
}

export class AgentBuilder {
    private definition: Partial<AgentDefinition>

    constructor(base: AgentBase) {
        this.definition = {
            id: base.id,
            displayName: base.displayName,
            model: base.model,
        }
    }

    withTools(...tools: string[]): this {
        this.definition.tools = tools
        return this
    }

    withSpawnableAgents(...agents: string[]): this {
        this.definition.spawnableAgents = agents
        return this
    }

    withSystemPrompt(prompt: string): this {
        this.definition.systemPrompt = prompt
        return this
    }

    withInstructionsPrompt(prompt: string): this {
        this.definition.instructionsPrompt = prompt
        return this
    }

    withStepPrompt(prompt: string): this {
        this.definition.stepPrompt = prompt
        return this
    }

    withMessageHistory(include: boolean = true): this {
        this.definition.includeMessageHistory = include
        return this
    }

    withSetOutputEndsRun(ends: boolean = true): this {
        this.definition.setOutputEndsRun = ends
        return this
    }

    withHandleSteps(handler: AgentStepHandler): this {
        this.definition.handleSteps = handler
        return this
    }

    withInputSchema(schema: InputSchema): this {
        this.definition.inputSchema = schema
        return this
    }

    withOutputMode(mode: OutputMode): this {
        this.definition.outputMode = mode
        return this
    }

    withOutputSchema(schema: JsonSchema): this {
        this.definition.outputSchema = schema
        this.definition.outputMode = 'structured_output'
        return this
    }

    extend(overrides: Partial<AgentDefinition>): this {
        this.definition = { ...this.definition, ...overrides }
        return this
    }

    build(): AgentDefinition {
        if (!this.definition.id || !this.definition.displayName || !this.definition.model) {
            throw new Error('Agent must have id, displayName, and model')
        }
        return this.definition as AgentDefinition
    }
}

export function createAgent(base: AgentBase): AgentBuilder {
    return new AgentBuilder(base)
}

export function cloneAgent(agent: AgentDefinition, overrides?: Partial<AgentDefinition>): AgentDefinition {
    return {
        ...agent,
        ...overrides,
    }
}
